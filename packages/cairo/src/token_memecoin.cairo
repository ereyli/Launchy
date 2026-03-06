#[starknet::contract]
mod TokenMemecoin {
    use core::traits::TryInto;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use core::num::traits::Zero;

    #[derive(Copy, Drop, Serde, starknet::Store)]
    pub struct EkuboLaunchData {
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
        launched_at: u64,
    }

    #[storage]
    struct Storage {
        owner: ContractAddress,
        factory: ContractAddress,
        name: felt252,
        symbol: felt252,
        decimals: u8,
        total_supply: u256,
        balances: starknet::storage::Map<ContractAddress, u256>,
        allowances: starknet::storage::Map<(ContractAddress, ContractAddress), u256>,
        is_launched: bool,
        launch_data: Option<EkuboLaunchData>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Approval: Approval,
        LaunchedOnEkubo: LaunchedOnEkubo,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        from: ContractAddress,
        to: ContractAddress,
        amount_low: u128,
        amount_high: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct Approval {
        owner: ContractAddress,
        spender: ContractAddress,
        amount_low: u128,
        amount_high: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct LaunchedOnEkubo {
        quote_token: ContractAddress,
        quote_amount_low: u128,
        quote_amount_high: u128,
        anti_bot_seconds: u64,
        max_buy_bps: u16,
        fee: u128,
        tick_spacing: u128,
        start_price_mag: u128,
        start_price_is_negative: bool,
        bound: u128,
        launcher: ContractAddress,
        launched_at: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        factory: ContractAddress,
        name: felt252,
        symbol: felt252,
        initial_supply: u256,
    ) {
        assert(!owner.is_zero(), 'invalid owner');
        assert(!factory.is_zero(), 'invalid factory');
        self.owner.write(owner);
        self.factory.write(factory);
        self.name.write(name);
        self.symbol.write(symbol);
        self.decimals.write(18);
        self.total_supply.write(initial_supply);
        self.balances.write(owner, initial_supply);
        self.is_launched.write(false);
        self.launch_data.write(Option::None);
        self.emit(
            Event::Transfer(
                Transfer {
                    from: self.zero_address(),
                    to: owner,
                    amount_low: initial_supply.low,
                    amount_high: initial_supply.high,
                },
            ),
        );
    }

    #[abi(embed_v0)]
    impl External of ITokenMemecoin<ContractState> {
        fn owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn factory(self: @ContractState) -> ContractAddress {
            self.factory.read()
        }

        fn name(self: @ContractState) -> felt252 {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> felt252 {
            self.symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn totalSupply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balanceOf(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.write((caller, spender), amount);
            self.emit(
                Event::Approval(
                    Approval {
                        owner: caller,
                        spender,
                        amount_low: amount.low,
                        amount_high: amount.high,
                    },
                ),
            );
            true
        }

        fn transfer(ref self: ContractState, to: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.internal_transfer(caller, to, amount);
            true
        }

        fn transfer_from(ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            let allowed = self.allowances.read((from, caller));
            assert(allowed >= amount, 'insufficient allowance');
            self.allowances.write((from, caller), allowed - amount);
            self.internal_transfer(from, to, amount);
            true
        }

        fn transferFrom(
            ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256
        ) -> bool {
            let caller = get_caller_address();
            let allowed = self.allowances.read((from, caller));
            assert(allowed >= amount, 'insufficient allowance');
            self.allowances.write((from, caller), allowed - amount);
            self.internal_transfer(from, to, amount);
            true
        }

        fn is_launched(self: @ContractState) -> bool {
            self.is_launched.read()
        }

        fn launch_data(self: @ContractState) -> Option<EkuboLaunchData> {
            self.launch_data.read()
        }

        fn set_launched_on_ekubo(
            ref self: ContractState,
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
        ) {
            self.assert_only_factory();
            assert(!self.is_launched.read(), 'already launched');
            assert(!quote_token.is_zero(), 'quote token zero');
            assert(!launcher.is_zero(), 'launcher zero');
            let launched_at = get_block_timestamp();
            let data = EkuboLaunchData {
                quote_token,
                quote_amount,
                anti_bot_seconds,
                max_buy_bps,
                fee,
                tick_spacing,
                start_price_mag,
                start_price_is_negative,
                bound,
                launcher,
                launched_at,
            };
            self.is_launched.write(true);
            self.launch_data.write(Option::Some(data));
            self.emit(
                Event::LaunchedOnEkubo(
                    LaunchedOnEkubo {
                        quote_token,
                        quote_amount_low: quote_amount.low,
                        quote_amount_high: quote_amount.high,
                        anti_bot_seconds,
                        max_buy_bps,
                        fee,
                        tick_spacing,
                        start_price_mag,
                        start_price_is_negative,
                        bound,
                        launcher,
                        launched_at,
                    },
                ),
            );
        }

        fn factory_transfer_for_launch(
            ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256
        ) -> bool {
            self.assert_only_factory();
            assert(!self.is_launched.read(), 'already launched');
            self.internal_transfer(from, to, amount);
            true
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn internal_transfer(ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256) {
            assert(!to.is_zero(), 'to zero');
            let from_balance = self.balances.read(from);
            assert(from_balance >= amount, 'insufficient balance');
            self.balances.write(from, from_balance - amount);
            let to_balance = self.balances.read(to);
            self.balances.write(to, to_balance + amount);
            self.emit(
                Event::Transfer(
                    Transfer {
                        from,
                        to,
                        amount_low: amount.low,
                        amount_high: amount.high,
                    },
                ),
            );
        }

        fn assert_only_factory(self: @ContractState) {
            assert(get_caller_address() == self.factory.read(), 'only factory');
        }

        fn zero_address(self: @ContractState) -> ContractAddress {
            0.try_into().unwrap()
        }
    }

    #[starknet::interface]
    pub trait ITokenMemecoin<TContractState> {
        fn owner(self: @TContractState) -> ContractAddress;
        fn factory(self: @TContractState) -> ContractAddress;
        fn name(self: @TContractState) -> felt252;
        fn symbol(self: @TContractState) -> felt252;
        fn decimals(self: @TContractState) -> u8;
        fn total_supply(self: @TContractState) -> u256;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
        fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
        fn totalSupply(self: @TContractState) -> u256;
        fn balanceOf(self: @TContractState, account: ContractAddress) -> u256;
        fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
        fn transfer(ref self: TContractState, to: ContractAddress, amount: u256) -> bool;
        fn transfer_from(ref self: TContractState, from: ContractAddress, to: ContractAddress, amount: u256) -> bool;
        fn transferFrom(
            ref self: TContractState, from: ContractAddress, to: ContractAddress, amount: u256
        ) -> bool;

        fn is_launched(self: @TContractState) -> bool;
        fn launch_data(self: @TContractState) -> Option<EkuboLaunchData>;

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

        fn factory_transfer_for_launch(
            ref self: TContractState, from: ContractAddress, to: ContractAddress, amount: u256
        ) -> bool;
    }
}
