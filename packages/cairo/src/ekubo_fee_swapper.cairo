#[starknet::contract]
mod EkuboFeeSwapper {
    use core::array::SpanTrait;
    use core::num::traits::Zero;
    use core::result::ResultTrait;
    use core::serde::Serde;
    use starknet::event::EventEmitter;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::syscalls::call_contract_syscall;
    use starknet::{ContractAddress, get_caller_address, get_contract_address};

    #[derive(Copy, Drop, Serde)]
    struct I129 {
        mag: u128,
        sign: bool,
    }

    #[derive(Copy, Drop, Serde)]
    struct Delta {
        amount0: I129,
        amount1: I129,
    }

    #[derive(Copy, Drop, Serde)]
    struct SwapParameters {
        amount: I129,
        is_token1: bool,
        sqrt_ratio_limit: u256,
        skip_ahead: u128,
    }

    #[derive(Copy, Drop, Serde)]
    struct PoolKey {
        token0: ContractAddress,
        token1: ContractAddress,
        fee: u128,
        tick_spacing: u128,
        extension: ContractAddress,
    }

    #[derive(Copy, Drop, Serde)]
    struct QuoteExactInputResult {
        output_amount: u256,
        min_received: u256,
        platform_fee: u256,
        net_input: u256,
    }

    const DEFAULT_FEE_BPS: u16 = 30;
    const MAX_FEE_BPS: u16 = 1000;
    const BPS_DENOMINATOR: u256 = 10000;
    const MIN_SQRT_RATIO: u256 = 18446748437148339061;
    const MAX_SQRT_RATIO: u256 = 6277100250585753475930931601400621808602321654880405518632;
    const QUOTE_RESULT_FLAG: felt252 = 'quote_result';

    #[storage]
    struct Storage {
        admin: ContractAddress,
        treasury: ContractAddress,
        ekubo_core: ContractAddress,
        fee_bps: u16,
        paused: bool,
        pending_active: bool,
        pending_caller: ContractAddress,
        pending_recipient: ContractAddress,
        pending_token_in: ContractAddress,
        pending_token_out: ContractAddress,
        pending_amount_in: u128,
        pending_fee_amount: u128,
        pending_min_out: u128,
        pending_pool_token0: ContractAddress,
        pending_pool_token1: ContractAddress,
        pending_pool_fee: u128,
        pending_pool_tick_spacing: u128,
        pending_pool_extension: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        SwapExecuted: SwapExecuted,
        AdminUpdated: AdminUpdated,
        FeeConfigUpdated: FeeConfigUpdated,
        EkuboCoreUpdated: EkuboCoreUpdated,
        PauseUpdated: PauseUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct SwapExecuted {
        caller: ContractAddress,
        recipient: ContractAddress,
        token_in: ContractAddress,
        token_out: ContractAddress,
        input_amount: u128,
        platform_fee_amount: u128,
        consumed_amount: u128,
        output_amount: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct AdminUpdated {
        admin: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct FeeConfigUpdated {
        treasury: ContractAddress,
        fee_bps: u16,
    }

    #[derive(Drop, starknet::Event)]
    struct EkuboCoreUpdated {
        ekubo_core: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct PauseUpdated {
        paused: bool,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        treasury: ContractAddress,
        ekubo_core: ContractAddress,
        fee_bps: u16,
    ) {
        assert(!admin.is_zero(), 'invalid admin');
        assert(!treasury.is_zero(), 'invalid treasury');
        assert(!ekubo_core.is_zero(), 'invalid core');
        assert(fee_bps <= MAX_FEE_BPS, 'fee too high');

        self.admin.write(admin);
        self.treasury.write(treasury);
        self.ekubo_core.write(ekubo_core);
        self.fee_bps.write(if fee_bps == 0 { DEFAULT_FEE_BPS } else { fee_bps });
        self.paused.write(false);
        self.pending_active.write(false);
    }

    #[abi(embed_v0)]
    impl External of IEkuboFeeSwapper<ContractState> {
        fn admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn treasury(self: @ContractState) -> ContractAddress {
            self.treasury.read()
        }

        fn ekubo_core(self: @ContractState) -> ContractAddress {
            self.ekubo_core.read()
        }

        fn fee_bps(self: @ContractState) -> u16 {
            self.fee_bps.read()
        }

        fn paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn set_fee_config(ref self: ContractState, treasury: ContractAddress, fee_bps: u16) {
            self.assert_only_admin();
            assert(!treasury.is_zero(), 'invalid treasury');
            assert(fee_bps <= MAX_FEE_BPS, 'fee too high');
            self.treasury.write(treasury);
            self.fee_bps.write(fee_bps);
            self.emit(Event::FeeConfigUpdated(FeeConfigUpdated { treasury, fee_bps }));
        }

        fn set_admin(ref self: ContractState, admin: ContractAddress) {
            self.assert_only_admin();
            assert(!admin.is_zero(), 'invalid admin');
            self.admin.write(admin);
            self.emit(Event::AdminUpdated(AdminUpdated { admin }));
        }

        fn set_ekubo_core(ref self: ContractState, ekubo_core: ContractAddress) {
            self.assert_only_admin();
            assert(!ekubo_core.is_zero(), 'invalid core');
            self.ekubo_core.write(ekubo_core);
            self.emit(Event::EkuboCoreUpdated(EkuboCoreUpdated { ekubo_core }));
        }

        fn set_paused(ref self: ContractState, paused: bool) {
            self.assert_only_admin();
            self.paused.write(paused);
            self.emit(Event::PauseUpdated(PauseUpdated { paused }));
        }

        fn swap_exact_input(
            ref self: ContractState,
            pool_key: PoolKey,
            token_in: ContractAddress,
            amount_in: u256,
            min_out: u256,
            recipient: ContractAddress,
        ) -> u256 {
            assert(!self.paused.read(), 'router paused');
            assert(!self.pending_active.read(), 'swap in progress');
            assert(!recipient.is_zero(), 'invalid recipient');

            let caller = get_caller_address();
            let amount_in_u128 = self.to_u128(amount_in);
            let min_out_u128 = self.to_u128(min_out);
            assert(amount_in_u128 > 0, 'amount zero');
            assert(token_in == pool_key.token0 || token_in == pool_key.token1, 'token mismatch');

            let token_out = if token_in == pool_key.token0 { pool_key.token1 } else { pool_key.token0 };
            let fee_amount = self.compute_fee(amount_in_u128, self.fee_bps.read());
            assert(fee_amount < amount_in_u128, 'fee >= amount');
            let swap_amount = amount_in_u128 - fee_amount;
            assert(swap_amount > 0, 'swap amount zero');

            self.pending_active.write(true);
            self.pending_caller.write(caller);
            self.pending_recipient.write(recipient);
            self.pending_token_in.write(token_in);
            self.pending_token_out.write(token_out);
            self.pending_amount_in.write(swap_amount);
            self.pending_fee_amount.write(fee_amount);
            self.pending_min_out.write(min_out_u128);
            self.pending_pool_token0.write(pool_key.token0);
            self.pending_pool_token1.write(pool_key.token1);
            self.pending_pool_fee.write(pool_key.fee);
            self.pending_pool_tick_spacing.write(pool_key.tick_spacing);
            self.pending_pool_extension.write(pool_key.extension);

            let token: IERC20Dispatcher = IERC20Dispatcher { contract_address: token_in };
            let transfer_in_ok = token.transfer_from(
                caller, get_contract_address(), u256 { low: amount_in_u128, high: 0 }
            );
            assert(transfer_in_ok, 'transfer in failed');

            if fee_amount > 0 {
                let fee_ok = token.transfer(self.treasury.read(), u256 { low: fee_amount, high: 0 });
                assert(fee_ok, 'fee transfer failed');
            }

            let core: IEkuboCoreDispatcher = IEkuboCoreDispatcher { contract_address: self.ekubo_core.read() };
            let mut lock_payload = array![];
            Serde::<felt252>::serialize(@'swap', ref lock_payload);
            let mut result = core.lock(lock_payload.span());
            let output: u128 = Serde::<u128>::deserialize(ref result).expect('bad output');
            self.pending_active.write(false);
            u256 { low: output, high: 0 }
        }

        fn quote_exact_input(
            self: @ContractState,
            pool_key: PoolKey,
            token_in: ContractAddress,
            amount_in: u256,
            slippage_bps: u16,
        ) -> QuoteExactInputResult {
            assert(token_in == pool_key.token0 || token_in == pool_key.token1, 'token mismatch');
            assert(slippage_bps <= 5000, 'slippage too high');
            let amount_in_u128 = self.to_u128(amount_in);
            assert(amount_in_u128 > 0, 'amount zero');

            let fee_amount = self.compute_fee(amount_in_u128, self.fee_bps.read());
            assert(fee_amount < amount_in_u128, 'fee >= amount');
            let net_input = amount_in_u128 - fee_amount;
            assert(net_input > 0, 'net input zero');

            let mut lock_payload = array![];
            Serde::<felt252>::serialize(@'quote', ref lock_payload);
            Serde::<PoolKey>::serialize(@pool_key, ref lock_payload);
            Serde::<ContractAddress>::serialize(@token_in, ref lock_payload);
            Serde::<u128>::serialize(@net_input, ref lock_payload);
            Serde::<u16>::serialize(@slippage_bps, ref lock_payload);
            Serde::<u128>::serialize(@fee_amount, ref lock_payload);

            let core = self.ekubo_core.read();
            let mut lock_call_arguments = array![];
            Serde::<Array<felt252>>::serialize(@lock_payload, ref lock_call_arguments);
            let mut raw = call_contract_syscall(core, selector!("lock"), lock_call_arguments.span())
                .unwrap_err()
                .span();
            let flag = *raw.pop_front().expect('missing flag');
            assert(flag == QUOTE_RESULT_FLAG, 'quote failed');
            Serde::<QuoteExactInputResult>::deserialize(ref raw).expect('decode quote')
        }
    }

    #[abi(embed_v0)]
    impl LockerImpl of ILocker<ContractState> {
        fn locked(ref self: ContractState, id: u32, data: Span<felt252>) -> Span<felt252> {
            let _ = id;
            let core: IEkuboCoreDispatcher = IEkuboCoreDispatcher { contract_address: self.ekubo_core.read() };
            assert(get_caller_address() == core.contract_address, 'core only');

            let mut callback_data = data;
            let tag: felt252 = Serde::<felt252>::deserialize(ref callback_data).expect('bad callback');
            if tag == 'quote' {
                let pool_key: PoolKey = Serde::<PoolKey>::deserialize(ref callback_data).expect('bad pool');
                let token_in: ContractAddress =
                    Serde::<ContractAddress>::deserialize(ref callback_data).expect('bad token in');
                let net_input: u128 = Serde::<u128>::deserialize(ref callback_data).expect('bad net in');
                let slippage_bps: u16 = Serde::<u16>::deserialize(ref callback_data).expect('bad slippage');
                let fee_amount: u128 = Serde::<u128>::deserialize(ref callback_data).expect('bad fee');
                let is_token1 = token_in == pool_key.token1;
                let sqrt_ratio_limit = if is_token1 { MAX_SQRT_RATIO } else { MIN_SQRT_RATIO };

                let delta = core
                    .swap(
                        pool_key,
                        SwapParameters {
                            amount: I129 { mag: net_input, sign: false },
                            is_token1,
                            sqrt_ratio_limit,
                            skip_ahead: 0,
                        },
                    );

                let output_delta = if is_token1 { delta.amount0 } else { delta.amount1 };
                assert(output_delta.sign, 'no output');
                let output_amount = output_delta.mag;
                let min_received = self.to_u128(
                    (u256 { low: output_amount, high: 0 } * u256 { low: (10000_u16 - slippage_bps).into(), high: 0 })
                        / BPS_DENOMINATOR,
                );
                let result = QuoteExactInputResult {
                    output_amount: u256 { low: output_amount, high: 0 },
                    min_received: u256 { low: min_received, high: 0 },
                    platform_fee: u256 { low: fee_amount, high: 0 },
                    net_input: u256 { low: net_input, high: 0 },
                };

                let mut panic_data = array![];
                Serde::<felt252>::serialize(@QUOTE_RESULT_FLAG, ref panic_data);
                Serde::<QuoteExactInputResult>::serialize(@result, ref panic_data);
                panic(panic_data);
            }
            assert(tag == 'swap', 'invalid callback');
            assert(self.pending_active.read(), 'no active swap');

            let pool_key = PoolKey {
                token0: self.pending_pool_token0.read(),
                token1: self.pending_pool_token1.read(),
                fee: self.pending_pool_fee.read(),
                tick_spacing: self.pending_pool_tick_spacing.read(),
                extension: self.pending_pool_extension.read(),
            };
            let token_in = self.pending_token_in.read();
            let token_out = self.pending_token_out.read();
            let caller = self.pending_caller.read();
            let recipient = self.pending_recipient.read();
            let amount_in = self.pending_amount_in.read();
            let min_out = self.pending_min_out.read();
            let platform_fee_amount = self.pending_fee_amount.read();
            let is_token1 = token_in == pool_key.token1;

            let sqrt_ratio_limit = if is_token1 { MAX_SQRT_RATIO } else { MIN_SQRT_RATIO };
            let delta = core
                .swap(
                    pool_key,
                    SwapParameters {
                        amount: I129 { mag: amount_in, sign: false },
                        is_token1,
                        sqrt_ratio_limit,
                        skip_ahead: 0,
                    },
                );

            let consumed_amount = if is_token1 { delta.amount1.mag } else { delta.amount0.mag };
            let output_delta = if is_token1 { delta.amount0 } else { delta.amount1 };
            assert(output_delta.sign, 'no output');
            let output_amount = output_delta.mag;

            assert(consumed_amount <= amount_in, 'consumed > input');
            assert(output_amount >= min_out, 'min out');

            let input_token: IERC20Dispatcher = IERC20Dispatcher { contract_address: token_in };
            let approve_ok = input_token.approve(core.contract_address, u256 { low: consumed_amount, high: 0 });
            assert(approve_ok, 'approve failed');
            core.pay(token_in);
            core.withdraw(token_out, recipient, output_amount);

            let refund = amount_in - consumed_amount;
            if refund > 0 {
                let refund_ok = input_token.transfer(caller, u256 { low: refund, high: 0 });
                assert(refund_ok, 'refund failed');
            }

            self.emit(
                Event::SwapExecuted(
                    SwapExecuted {
                        caller,
                        recipient,
                        token_in,
                        token_out,
                        input_amount: amount_in,
                        platform_fee_amount,
                        consumed_amount,
                        output_amount,
                    },
                ),
            );

            let mut ret = array![];
            Serde::<u128>::serialize(@output_amount, ref ret);
            ret.span()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_admin(self: @ContractState) {
            assert(get_caller_address() == self.admin.read(), 'only admin');
        }

        fn compute_fee(self: @ContractState, amount: u128, fee_bps: u16) -> u128 {
            let fee_u256 = (u256 { low: amount, high: 0 } * u256 { low: fee_bps.into(), high: 0 })
                / BPS_DENOMINATOR;
            self.to_u128(fee_u256)
        }

        fn to_u128(self: @ContractState, value: u256) -> u128 {
            assert(value.high == 0, 'u256 overflow');
            value.low
        }
    }

    #[starknet::interface]
    pub trait IEkuboFeeSwapper<TContractState> {
        fn admin(self: @TContractState) -> ContractAddress;
        fn treasury(self: @TContractState) -> ContractAddress;
        fn ekubo_core(self: @TContractState) -> ContractAddress;
        fn fee_bps(self: @TContractState) -> u16;
        fn paused(self: @TContractState) -> bool;
        fn set_fee_config(ref self: TContractState, treasury: ContractAddress, fee_bps: u16);
        fn set_admin(ref self: TContractState, admin: ContractAddress);
        fn set_ekubo_core(ref self: TContractState, ekubo_core: ContractAddress);
        fn set_paused(ref self: TContractState, paused: bool);
        fn swap_exact_input(
            ref self: TContractState,
            pool_key: PoolKey,
            token_in: ContractAddress,
            amount_in: u256,
            min_out: u256,
            recipient: ContractAddress,
        ) -> u256;
        fn quote_exact_input(
            self: @TContractState,
            pool_key: PoolKey,
            token_in: ContractAddress,
            amount_in: u256,
            slippage_bps: u16,
        ) -> QuoteExactInputResult;
    }

    #[starknet::interface]
    trait ILocker<TContractState> {
        fn locked(ref self: TContractState, id: u32, data: Span<felt252>) -> Span<felt252>;
    }

    #[starknet::interface]
    trait IEkuboCore<TContractState> {
        fn lock(ref self: TContractState, data: Span<felt252>) -> Span<felt252>;
        fn swap(ref self: TContractState, pool_key: PoolKey, params: SwapParameters) -> Delta;
        fn pay(ref self: TContractState, token_address: ContractAddress);
        fn withdraw(
            ref self: TContractState,
            token_address: ContractAddress,
            recipient: ContractAddress,
            amount: u128,
        );
    }

    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(
            ref self: TContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool;
        fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    }
}
