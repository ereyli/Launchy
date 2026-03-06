#[starknet::contract]
mod TokenFactory {
    use core::num::traits::Zero;
    use core::serde::Serde;
    use core::traits::TryInto;
    use crate::interfaces::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::event::EventEmitter;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::{ClassHash, ContractAddress, get_caller_address, get_contract_address, SyscallResultTrait};

    #[derive(Copy, Drop, Serde)]
    struct I129 {
        mag: u128,
        sign: bool,
    }

    #[derive(Copy, Drop, Serde)]
    struct Bounds {
        lower: I129,
        upper: I129,
    }

    #[derive(Copy, Drop, Serde)]
    struct PoolKey {
        token0: ContractAddress,
        token1: ContractAddress,
        fee: u128,
        tick_spacing: u128,
        extension: ContractAddress,
    }

    const DEFAULT_EKUBO_FEE: u128 = 1020847100762815390390123822295304634;
    const DEFAULT_EKUBO_TICK_SPACING: u128 = 5982;
    const DEFAULT_EKUBO_START_PRICE_MAG: u128 = 1000000;
    const DEFAULT_EKUBO_START_PRICE_NEGATIVE: bool = false;
    const DEFAULT_EKUBO_BOUND: u128 = 88712960;
    const DEFAULT_MAX_BUY_BPS: u16 = 1000;

    #[storage]
    struct Storage {
        admin: ContractAddress,
        treasury: ContractAddress,
        platform_fee_token: ContractAddress,
        platform_deploy_fee: u256,
        paused: bool,
        memecoin_class_hash: ClassHash,
        ekubo_core: ContractAddress,
        ekubo_positions: ContractAddress,
        deployed_count: u64,
        deployed_tokens: starknet::storage::Map<u64, ContractAddress>,
        is_memecoin: starknet::storage::Map<ContractAddress, bool>,
        locked_quote: starknet::storage::Map<ContractAddress, u256>,
        ekubo_position_id: starknet::storage::Map<ContractAddress, u64>,
        pool_token0: starknet::storage::Map<ContractAddress, ContractAddress>,
        pool_token1: starknet::storage::Map<ContractAddress, ContractAddress>,
        pool_fee: starknet::storage::Map<ContractAddress, u128>,
        pool_tick_spacing: starknet::storage::Map<ContractAddress, u128>,
        pool_extension: starknet::storage::Map<ContractAddress, ContractAddress>,
        pool_lower_mag: starknet::storage::Map<ContractAddress, u128>,
        pool_lower_sign: starknet::storage::Map<ContractAddress, bool>,
        pool_upper_mag: starknet::storage::Map<ContractAddress, u128>,
        pool_upper_sign: starknet::storage::Map<ContractAddress, bool>,
        launch_quote_token: starknet::storage::Map<ContractAddress, ContractAddress>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MemecoinCreated: MemecoinCreated,
        MemecoinLaunched: MemecoinLaunched,
        CreatorFeesWithdrawn: CreatorFeesWithdrawn,
        AdminUpdated: AdminUpdated,
        PlatformConfigUpdated: PlatformConfigUpdated,
        EkuboCoreUpdated: EkuboCoreUpdated,
        EkuboPositionsUpdated: EkuboPositionsUpdated,
        PauseUpdated: PauseUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct MemecoinCreated {
        owner: ContractAddress,
        name: felt252,
        symbol: felt252,
        initial_supply_low: u128,
        initial_supply_high: u128,
        memecoin_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct MemecoinLaunched {
        memecoin_address: ContractAddress,
        quote_token: ContractAddress,
        quote_amount_low: u128,
        quote_amount_high: u128,
        lp_amount_low: u128,
        lp_amount_high: u128,
        anti_bot_seconds: u64,
        max_buy_bps: u16,
        fee: u128,
        tick_spacing: u128,
        start_price_mag: u128,
        start_price_is_negative: bool,
        bound: u128,
        launcher: ContractAddress,
        position_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct CreatorFeesWithdrawn {
        memecoin_address: ContractAddress,
        recipient: ContractAddress,
        quote_token: ContractAddress,
        amount_low: u128,
        amount_high: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct AdminUpdated {
        admin: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct PlatformConfigUpdated {
        treasury: ContractAddress,
        fee_token: ContractAddress,
        deploy_fee_low: u128,
        deploy_fee_high: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct EkuboCoreUpdated {
        core: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct EkuboPositionsUpdated {
        positions: ContractAddress,
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
        platform_fee_token: ContractAddress,
        memecoin_class_hash: ClassHash,
        ekubo_core: ContractAddress,
        ekubo_positions: ContractAddress,
    ) {
        assert(!admin.is_zero(), 'invalid admin');
        assert(!treasury.is_zero(), 'invalid treasury');
        assert(!platform_fee_token.is_zero(), 'invalid fee token');
        assert(!ekubo_core.is_zero(), 'invalid core');
        assert(!ekubo_positions.is_zero(), 'invalid positions');
        self.admin.write(admin);
        self.treasury.write(treasury);
        self.platform_fee_token.write(platform_fee_token);
        self.platform_deploy_fee.write(u256 { low: 50000000000000000000, high: 0 });
        self.paused.write(false);
        self.memecoin_class_hash.write(memecoin_class_hash);
        self.ekubo_core.write(ekubo_core);
        self.ekubo_positions.write(ekubo_positions);
    }

    #[abi(embed_v0)]
    impl External of ITokenFactory<ContractState> {
        fn admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn memecoin_class_hash(self: @ContractState) -> ClassHash {
            self.memecoin_class_hash.read()
        }

        fn treasury(self: @ContractState) -> ContractAddress {
            self.treasury.read()
        }

        fn platform_fee_token(self: @ContractState) -> ContractAddress {
            self.platform_fee_token.read()
        }

        fn platform_deploy_fee(self: @ContractState) -> u256 {
            self.platform_deploy_fee.read()
        }

        fn paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn ekubo_core(self: @ContractState) -> ContractAddress {
            self.ekubo_core.read()
        }

        fn ekubo_positions(self: @ContractState) -> ContractAddress {
            self.ekubo_positions.read()
        }

        fn deployed_count(self: @ContractState) -> u64 {
            self.deployed_count.read()
        }

        fn deployed_token(self: @ContractState, index: u64) -> ContractAddress {
            self.deployed_tokens.read(index)
        }

        fn is_memecoin(self: @ContractState, token: ContractAddress) -> bool {
            self.is_memecoin.read(token)
        }

        fn locked_quote(self: @ContractState, token: ContractAddress) -> u256 {
            self.locked_quote.read(token)
        }

        fn ekubo_position_id(self: @ContractState, token: ContractAddress) -> u64 {
            self.ekubo_position_id.read(token)
        }

        fn set_platform_config(
            ref self: ContractState, treasury: ContractAddress, fee_token: ContractAddress, deploy_fee: u256
        ) {
            self.assert_only_admin();
            assert(!treasury.is_zero(), 'invalid treasury');
            assert(!fee_token.is_zero(), 'invalid fee token');
            self.treasury.write(treasury);
            self.platform_fee_token.write(fee_token);
            self.platform_deploy_fee.write(deploy_fee);
            self.emit(
                Event::PlatformConfigUpdated(
                    PlatformConfigUpdated {
                        treasury,
                        fee_token,
                        deploy_fee_low: deploy_fee.low,
                        deploy_fee_high: deploy_fee.high,
                    },
                ),
            );
        }

        fn set_admin(ref self: ContractState, admin: ContractAddress) {
            self.assert_only_admin();
            assert(!admin.is_zero(), 'invalid admin');
            self.admin.write(admin);
            self.emit(Event::AdminUpdated(AdminUpdated { admin }));
        }

        fn set_ekubo_core(ref self: ContractState, core: ContractAddress) {
            self.assert_only_admin();
            assert(!core.is_zero(), 'invalid core');
            self.ekubo_core.write(core);
            self.emit(Event::EkuboCoreUpdated(EkuboCoreUpdated { core }));
        }

        fn set_ekubo_positions(ref self: ContractState, positions: ContractAddress) {
            self.assert_only_admin();
            assert(!positions.is_zero(), 'invalid positions');
            self.ekubo_positions.write(positions);
            self.emit(Event::EkuboPositionsUpdated(EkuboPositionsUpdated { positions }));
        }

        fn set_paused(ref self: ContractState, paused: bool) {
            self.assert_only_admin();
            self.paused.write(paused);
            self.emit(Event::PauseUpdated(PauseUpdated { paused }));
        }

        fn create_memecoin(
            ref self: ContractState,
            owner: ContractAddress,
            name: felt252,
            symbol: felt252,
            initial_supply: u256,
            contract_address_salt: felt252,
        ) -> ContractAddress {
            self.assert_not_paused();
            assert(!owner.is_zero(), 'owner zero');
            assert(!(initial_supply.low == 0 && initial_supply.high == 0), 'supply zero');
            self.charge_platform_deploy_fee(get_caller_address());

            let mut calldata = array![];
            Serde::<ContractAddress>::serialize(@owner, ref calldata);
            Serde::<ContractAddress>::serialize(@get_contract_address(), ref calldata);
            Serde::<felt252>::serialize(@name, ref calldata);
            Serde::<felt252>::serialize(@symbol, ref calldata);
            Serde::<u256>::serialize(@initial_supply, ref calldata);

            let (memecoin_address, _) = deploy_syscall(
                self.memecoin_class_hash.read(),
                contract_address_salt,
                calldata.span(),
                false,
            ).unwrap_syscall();

            let i = self.deployed_count.read();
            self.deployed_tokens.write(i, memecoin_address);
            self.deployed_count.write(i + 1);
            self.is_memecoin.write(memecoin_address, true);

            self.emit(
                Event::MemecoinCreated(
                    MemecoinCreated {
                        owner,
                        name,
                        symbol,
                        initial_supply_low: initial_supply.low,
                        initial_supply_high: initial_supply.high,
                        memecoin_address,
                    },
                ),
            );
            memecoin_address
        }

        fn launch_on_ekubo(
            ref self: ContractState,
            memecoin_address: ContractAddress,
            quote_token: ContractAddress,
            quote_amount: u256,
            lp_amount: u256,
            anti_bot_seconds: u64,
            max_buy_bps: u16,
            fee: u128,
            tick_spacing: u128,
            start_price_mag: u128,
            start_price_is_negative: bool,
            bound: u128,
        ) {
            self.assert_not_paused();
            let caller = get_caller_address();
            self.launch_internal(
                memecoin_address,
                quote_token,
                quote_amount,
                lp_amount,
                anti_bot_seconds,
                max_buy_bps,
                fee,
                tick_spacing,
                start_price_mag,
                start_price_is_negative,
                bound,
                caller,
            );
        }

        fn create_and_launch_on_ekubo(
            ref self: ContractState,
            name: felt252,
            symbol: felt252,
            initial_supply: u256,
            lp_amount: u256,
            quote_amount: u256,
            anti_bot_seconds: u64,
            quote_token: ContractAddress,
            start_price_mag: u128,
            start_price_is_negative: bool,
            bound: u128,
            contract_address_salt: felt252,
        ) -> ContractAddress {
            self.assert_not_paused();
            let caller = get_caller_address();
            assert(!(initial_supply.low == 0 && initial_supply.high == 0), 'supply zero');
            self.charge_platform_deploy_fee(caller);

            let mut calldata = array![];
            Serde::<ContractAddress>::serialize(@caller, ref calldata);
            Serde::<ContractAddress>::serialize(@get_contract_address(), ref calldata);
            Serde::<felt252>::serialize(@name, ref calldata);
            Serde::<felt252>::serialize(@symbol, ref calldata);
            Serde::<u256>::serialize(@initial_supply, ref calldata);

            let (memecoin_address, _) = deploy_syscall(
                self.memecoin_class_hash.read(),
                contract_address_salt,
                calldata.span(),
                false,
            ).unwrap_syscall();

            let i = self.deployed_count.read();
            self.deployed_tokens.write(i, memecoin_address);
            self.deployed_count.write(i + 1);
            self.is_memecoin.write(memecoin_address, true);

            self.emit(
                Event::MemecoinCreated(
                    MemecoinCreated {
                        owner: caller,
                        name,
                        symbol,
                        initial_supply_low: initial_supply.low,
                        initial_supply_high: initial_supply.high,
                        memecoin_address,
                    },
                ),
            );

            assert(!(lp_amount.low == 0 && lp_amount.high == 0), 'lp amount zero');
            assert(lp_amount <= initial_supply, 'lp amount too high');
            let min_lp = (initial_supply * 9000_u256) / 10000_u256;
            assert(lp_amount >= min_lp, 'owner alloc >10%');

            self.launch_internal(
                memecoin_address,
                quote_token,
                quote_amount,
                lp_amount,
                anti_bot_seconds,
                DEFAULT_MAX_BUY_BPS,
                DEFAULT_EKUBO_FEE,
                DEFAULT_EKUBO_TICK_SPACING,
                start_price_mag,
                start_price_is_negative,
                bound,
                caller,
            );
            memecoin_address
        }

        fn withdraw_creator_fees(
            ref self: ContractState, memecoin_address: ContractAddress, recipient: ContractAddress
        ) -> u256 {
            assert(self.is_memecoin.read(memecoin_address), 'not memecoin');
            assert(!recipient.is_zero(), 'recipient zero');

            let caller = get_caller_address();
            let memecoin: ITokenMemecoinDispatcher = ITokenMemecoinDispatcher { contract_address: memecoin_address };
            assert(memecoin.owner() == caller, 'only token owner');
            assert(memecoin.is_launched(), 'not launched');

            let position_id = self.ekubo_position_id.read(memecoin_address);
            assert(position_id > 0, 'no position');

            let pool_key = PoolKey {
                token0: self.pool_token0.read(memecoin_address),
                token1: self.pool_token1.read(memecoin_address),
                fee: self.pool_fee.read(memecoin_address),
                tick_spacing: self.pool_tick_spacing.read(memecoin_address),
                extension: self.pool_extension.read(memecoin_address),
            };
            let bounds = Bounds {
                lower: I129 {
                    mag: self.pool_lower_mag.read(memecoin_address),
                    sign: self.pool_lower_sign.read(memecoin_address),
                },
                upper: I129 {
                    mag: self.pool_upper_mag.read(memecoin_address),
                    sign: self.pool_upper_sign.read(memecoin_address),
                },
            };

            let quote_token = self.launch_quote_token.read(memecoin_address);
            let positions = self.ekubo_positions.read();
            let ekubo_positions: IEkuboPositionsDispatcher = IEkuboPositionsDispatcher {
                contract_address: positions
            };

            let (amount0, amount1) = ekubo_positions.withdraw(
                position_id, pool_key, bounds, 0, 0, 0, true
            );
            let quote_amount_u128 = if quote_token == pool_key.token0 { amount0 } else { amount1 };
            let quote_amount = u256 { low: quote_amount_u128.into(), high: 0 };
            if quote_amount_u128 > 0 {
                let quote: IERC20Dispatcher = IERC20Dispatcher { contract_address: quote_token };
                let ok = quote.transfer(recipient, quote_amount);
                assert(ok, 'quote transfer failed');
            }

            self.emit(
                Event::CreatorFeesWithdrawn(
                    CreatorFeesWithdrawn {
                        memecoin_address,
                        recipient,
                        quote_token,
                        amount_low: quote_amount.low,
                        amount_high: quote_amount.high,
                    },
                ),
            );
            quote_amount
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_admin(self: @ContractState) {
            assert(get_caller_address() == self.admin.read(), 'only admin');
        }

        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'factory paused');
        }

        fn zero_address(self: @ContractState) -> ContractAddress {
            0.try_into().unwrap()
        }

        fn sort_tokens(
            self: @ContractState, token_a: ContractAddress, token_b: ContractAddress
        ) -> (ContractAddress, ContractAddress) {
            let a_felt: felt252 = token_a.into();
            let b_felt: felt252 = token_b.into();
            let a_u256: u256 = a_felt.into();
            let b_u256: u256 = b_felt.into();
            if a_u256 < b_u256 {
                (token_a, token_b)
            } else {
                (token_b, token_a)
            }
        }

        fn get_initial_tick_and_bounds(
            self: @ContractState, starting_price: I129, bound_mag: u128, is_token1_quote: bool
        ) -> (I129, Bounds) {
            if is_token1_quote {
                (
                    I129 { sign: starting_price.sign, mag: starting_price.mag },
                    Bounds {
                        lower: I129 { sign: starting_price.sign, mag: starting_price.mag },
                        upper: I129 { sign: false, mag: bound_mag },
                    },
                )
            } else {
                (
                    I129 { sign: !starting_price.sign, mag: starting_price.mag },
                    Bounds {
                        lower: I129 { sign: true, mag: bound_mag },
                        upper: I129 { sign: !starting_price.sign, mag: starting_price.mag },
                    },
                )
            }
        }

        fn align_down(self: @ContractState, value: u128, spacing: u128) -> u128 {
            (value / spacing) * spacing
        }

        fn launch_internal(
            ref self: ContractState,
            memecoin_address: ContractAddress,
            quote_token: ContractAddress,
            quote_amount: u256,
            lp_amount: u256,
            anti_bot_seconds: u64,
            max_buy_bps: u16,
            fee: u128,
            tick_spacing: u128,
            start_price_mag: u128,
            start_price_is_negative: bool,
            bound: u128,
            caller: ContractAddress,
        ) {
            assert(self.is_memecoin.read(memecoin_address), 'not memecoin');
            assert(!quote_token.is_zero(), 'quote token zero');
            assert(quote_token == self.platform_fee_token.read(), 'quote token not allowed');
            assert(max_buy_bps > 0, 'max buy bps zero');
            assert(max_buy_bps <= 1000, 'max buy >10%');
            assert(tick_spacing > 0, 'tick spacing zero');
            assert(start_price_mag > 0, 'start price zero');
            assert(bound > 0, 'bound zero');

            let core = self.ekubo_core.read();
            let positions = self.ekubo_positions.read();
            assert(!core.is_zero(), 'core not set');
            assert(!positions.is_zero(), 'positions not set');

            let memecoin: ITokenMemecoinDispatcher = ITokenMemecoinDispatcher { contract_address: memecoin_address };
            assert(memecoin.owner() == caller, 'only token owner');
            assert(!memecoin.is_launched(), 'already launched');

            if !(quote_amount.low == 0 && quote_amount.high == 0) {
                let quote: IERC20Dispatcher = IERC20Dispatcher { contract_address: quote_token };
                let ok = quote.transfer_from(caller, positions, quote_amount);
                assert(ok, 'quote transfer failed');
                let old_locked = self.locked_quote.read(memecoin_address);
                self.locked_quote.write(memecoin_address, old_locked + quote_amount);
            }

            let moved = memecoin.factory_transfer_for_launch(caller, positions, lp_amount);
            assert(moved, 'token transfer failed');

            let (token0, token1) = self.sort_tokens(memecoin_address, quote_token);
            let is_token1_quote = quote_token == token1;
            let start_price_mag_aligned = self.align_down(start_price_mag, tick_spacing);
            let mut bound_aligned = self.align_down(bound, tick_spacing);
            assert(start_price_mag_aligned > 0, 'start price align zero');
            if bound_aligned <= start_price_mag_aligned {
                bound_aligned = start_price_mag_aligned + tick_spacing;
            }
            let starting_price = I129 { mag: start_price_mag_aligned, sign: start_price_is_negative };
            let (initial_tick, bounds) = self
                .get_initial_tick_and_bounds(starting_price, bound_aligned, is_token1_quote);
            let pool_key = PoolKey {
                token0,
                token1,
                fee,
                tick_spacing,
                extension: self.zero_address(),
            };

            let ekubo_core: IEkuboCoreDispatcher = IEkuboCoreDispatcher { contract_address: core };
            ekubo_core.maybe_initialize_pool(pool_key, initial_tick);

            let ekubo_positions: IEkuboPositionsDispatcher = IEkuboPositionsDispatcher {
                contract_address: positions
            };
            let (position_id, _) = ekubo_positions.mint_and_deposit(pool_key, bounds, 0);
            self.ekubo_position_id.write(memecoin_address, position_id);
            self.pool_token0.write(memecoin_address, pool_key.token0);
            self.pool_token1.write(memecoin_address, pool_key.token1);
            self.pool_fee.write(memecoin_address, pool_key.fee);
            self.pool_tick_spacing.write(memecoin_address, pool_key.tick_spacing);
            self.pool_extension.write(memecoin_address, pool_key.extension);
            self.pool_lower_mag.write(memecoin_address, bounds.lower.mag);
            self.pool_lower_sign.write(memecoin_address, bounds.lower.sign);
            self.pool_upper_mag.write(memecoin_address, bounds.upper.mag);
            self.pool_upper_sign.write(memecoin_address, bounds.upper.sign);
            self.launch_quote_token.write(memecoin_address, quote_token);

            memecoin.set_launched_on_ekubo(
                quote_token,
                quote_amount,
                anti_bot_seconds,
                max_buy_bps,
                fee,
                tick_spacing,
                start_price_mag_aligned,
                start_price_is_negative,
                bound_aligned,
                core,
            );

            self.emit(
                Event::MemecoinLaunched(
                    MemecoinLaunched {
                        memecoin_address,
                        quote_token,
                        quote_amount_low: quote_amount.low,
                        quote_amount_high: quote_amount.high,
                        lp_amount_low: lp_amount.low,
                        lp_amount_high: lp_amount.high,
                        anti_bot_seconds,
                        max_buy_bps,
                        fee,
                        tick_spacing,
                        start_price_mag: start_price_mag_aligned,
                        start_price_is_negative,
                        bound: bound_aligned,
                        launcher: core,
                        position_id,
                    },
                ),
            );
        }

        fn charge_platform_deploy_fee(ref self: ContractState, payer: ContractAddress) {
            let fee = self.platform_deploy_fee.read();
            if fee.low == 0 && fee.high == 0 {
                return;
            }
            let fee_token = self.platform_fee_token.read();
            let treasury = self.treasury.read();
            let token: IERC20Dispatcher = IERC20Dispatcher { contract_address: fee_token };
            let ok = token.transfer_from(payer, treasury, fee);
            assert(ok, 'platform fee transfer failed');
        }
    }

    #[starknet::interface]
    pub trait ITokenFactory<TContractState> {
        fn admin(self: @TContractState) -> ContractAddress;
        fn treasury(self: @TContractState) -> ContractAddress;
        fn platform_fee_token(self: @TContractState) -> ContractAddress;
        fn platform_deploy_fee(self: @TContractState) -> u256;
        fn paused(self: @TContractState) -> bool;
        fn memecoin_class_hash(self: @TContractState) -> ClassHash;
        fn ekubo_core(self: @TContractState) -> ContractAddress;
        fn ekubo_positions(self: @TContractState) -> ContractAddress;
        fn deployed_count(self: @TContractState) -> u64;
        fn deployed_token(self: @TContractState, index: u64) -> ContractAddress;
        fn is_memecoin(self: @TContractState, token: ContractAddress) -> bool;
        fn locked_quote(self: @TContractState, token: ContractAddress) -> u256;
        fn ekubo_position_id(self: @TContractState, token: ContractAddress) -> u64;

        fn set_platform_config(
            ref self: TContractState, treasury: ContractAddress, fee_token: ContractAddress, deploy_fee: u256
        );
        fn set_admin(ref self: TContractState, admin: ContractAddress);
        fn set_ekubo_core(ref self: TContractState, core: ContractAddress);
        fn set_ekubo_positions(ref self: TContractState, positions: ContractAddress);
        fn set_paused(ref self: TContractState, paused: bool);

        fn create_memecoin(
            ref self: TContractState,
            owner: ContractAddress,
            name: felt252,
            symbol: felt252,
            initial_supply: u256,
            contract_address_salt: felt252,
        ) -> ContractAddress;

        fn launch_on_ekubo(
            ref self: TContractState,
            memecoin_address: ContractAddress,
            quote_token: ContractAddress,
            quote_amount: u256,
            lp_amount: u256,
            anti_bot_seconds: u64,
            max_buy_bps: u16,
            fee: u128,
            tick_spacing: u128,
            start_price_mag: u128,
            start_price_is_negative: bool,
            bound: u128,
        );

        fn create_and_launch_on_ekubo(
            ref self: TContractState,
            name: felt252,
            symbol: felt252,
            initial_supply: u256,
            lp_amount: u256,
            quote_amount: u256,
            anti_bot_seconds: u64,
            quote_token: ContractAddress,
            start_price_mag: u128,
            start_price_is_negative: bool,
            bound: u128,
            contract_address_salt: felt252,
        ) -> ContractAddress;

        fn withdraw_creator_fees(
            ref self: TContractState, memecoin_address: ContractAddress, recipient: ContractAddress
        ) -> u256;
    }

    #[starknet::interface]
    trait ITokenMemecoin<TContractState> {
        fn owner(self: @TContractState) -> ContractAddress;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
        fn transfer_from(
            ref self: TContractState, from: ContractAddress, to: ContractAddress, amount: u256
        ) -> bool;
        fn factory_transfer_for_launch(
            ref self: TContractState, from: ContractAddress, to: ContractAddress, amount: u256
        ) -> bool;
        fn is_launched(self: @TContractState) -> bool;
        fn set_launched_on_ekubo(
            ref self: TContractState,
            quote_token: ContractAddress,
            quote_amount: u256,
            anti_bot_seconds: u64,
            max_buy_bps: u16,
            fee: u128,
            tick_spacing: u128,
            start_price_mag: u128,
            start_price_is_negative: bool,
            bound: u128,
            launcher: ContractAddress,
        );
    }

    #[starknet::interface]
    trait IEkuboCore<TContractState> {
        fn maybe_initialize_pool(ref self: TContractState, pool_key: PoolKey, initial_tick: I129);
    }

    #[starknet::interface]
    trait IEkuboPositions<TContractState> {
        fn mint_and_deposit(
            ref self: TContractState, pool_key: PoolKey, bounds: Bounds, min_liquidity: u128
        ) -> (u64, u128);
        fn withdraw(
            ref self: TContractState,
            id: u64,
            pool_key: PoolKey,
            bounds: Bounds,
            liquidity: u128,
            min_token0: u128,
            min_token1: u128,
            collect_fees: bool,
        ) -> (u128, u128);
    }
}
