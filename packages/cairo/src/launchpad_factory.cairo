#[starknet::contract]
mod LaunchpadFactory {
    use core::serde::Serde;
    use core::byte_array::ByteArray;
    use core::num::traits::Zero;
    use crate::interfaces::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::event::EventEmitter;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::{ClassHash, ContractAddress, get_caller_address, get_contract_address, SyscallResultTrait};

    #[storage]
    struct Storage {
        admin: ContractAddress,
        collection_class_hash: ClassHash,

        strk_token: ContractAddress,
        platform_treasury: ContractAddress,

        deploy_fee: u256,
        mint_fee_per_mint: u256,

        collection_count: u64,
        collections: starknet::storage::Map<u64, ContractAddress>,
        collection_owner: starknet::storage::Map<ContractAddress, ContractAddress>,
        collection_is_free_model: starknet::storage::Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CollectionRegistered: CollectionRegistered,
        PlatformFeesUpdated: PlatformFeesUpdated,
        AdminUpdated: AdminUpdated,
        TreasuryUpdated: TreasuryUpdated,
        StrkTokenUpdated: StrkTokenUpdated,
        CollectionClassHashUpdated: CollectionClassHashUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct CollectionRegistered {
        collection: ContractAddress,
        owner: ContractAddress,
        is_free_mint_model: bool,
        mint_price_low: u128,
        mint_price_high: u128,
        max_supply: u64,
        max_per_wallet: u64,
        name: ByteArray,
        symbol: ByteArray,
    }

    #[derive(Drop, starknet::Event)]
    struct PlatformFeesUpdated {
        deploy_fee_low: u128,
        deploy_fee_high: u128,
        mint_fee_per_mint_low: u128,
        mint_fee_per_mint_high: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct AdminUpdated {
        admin: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct TreasuryUpdated {
        treasury: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct StrkTokenUpdated {
        strk_token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct CollectionClassHashUpdated {
        class_hash: ClassHash,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        collection_class_hash: ClassHash,
        strk_token: ContractAddress,
        platform_treasury: ContractAddress,
        deploy_fee: u256,
        mint_fee_per_mint: u256,
    ) {
        assert(!admin.is_zero(), 'invalid admin');
        assert(!strk_token.is_zero(), 'invalid strk token');
        assert(!platform_treasury.is_zero(), 'invalid treasury');

        self.admin.write(admin);
        self.collection_class_hash.write(collection_class_hash);
        self.strk_token.write(strk_token);
        self.platform_treasury.write(platform_treasury);
        self.deploy_fee.write(deploy_fee);
        self.mint_fee_per_mint.write(mint_fee_per_mint);
    }

    #[abi(embed_v0)]
    impl External of ILaunchpadFactory<ContractState> {
        fn admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn collection_class_hash(self: @ContractState) -> ClassHash {
            self.collection_class_hash.read()
        }

        fn strk_token(self: @ContractState) -> ContractAddress {
            self.strk_token.read()
        }

        fn platform_treasury(self: @ContractState) -> ContractAddress {
            self.platform_treasury.read()
        }

        fn deploy_fee(self: @ContractState) -> u256 {
            self.deploy_fee.read()
        }

        fn mint_fee_per_mint(self: @ContractState) -> u256 {
            self.mint_fee_per_mint.read()
        }

        fn collection_count(self: @ContractState) -> u64 {
            self.collection_count.read()
        }

        fn collection_at(self: @ContractState, index: u64) -> ContractAddress {
            self.collections.read(index)
        }

        fn collection_owner(self: @ContractState, collection: ContractAddress) -> ContractAddress {
            self.collection_owner.read(collection)
        }

        fn collection_is_free_model(self: @ContractState, collection: ContractAddress) -> bool {
            self.collection_is_free_model.read(collection)
        }

        fn set_platform_fees(ref self: ContractState, deploy_fee: u256, mint_fee_per_mint: u256) {
            self.assert_only_admin();

            self.deploy_fee.write(deploy_fee);
            self.mint_fee_per_mint.write(mint_fee_per_mint);
            self.emit(
                Event::PlatformFeesUpdated(
                    PlatformFeesUpdated {
                        deploy_fee_low: deploy_fee.low,
                        deploy_fee_high: deploy_fee.high,
                        mint_fee_per_mint_low: mint_fee_per_mint.low,
                        mint_fee_per_mint_high: mint_fee_per_mint.high,
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

        fn set_treasury(ref self: ContractState, treasury: ContractAddress) {
            self.assert_only_admin();
            assert(!treasury.is_zero(), 'invalid treasury');
            self.platform_treasury.write(treasury);
            self.emit(Event::TreasuryUpdated(TreasuryUpdated { treasury }));
        }

        fn set_strk_token(ref self: ContractState, strk_token: ContractAddress) {
            self.assert_only_admin();
            assert(!strk_token.is_zero(), 'invalid strk token');
            self.strk_token.write(strk_token);
            self.emit(Event::StrkTokenUpdated(StrkTokenUpdated { strk_token }));
        }

        fn set_collection_class_hash(ref self: ContractState, class_hash: ClassHash) {
            self.assert_only_admin();
            self.collection_class_hash.write(class_hash);
            self.emit(Event::CollectionClassHashUpdated(CollectionClassHashUpdated { class_hash }));
        }

        fn create_collection(
            ref self: ContractState,
            name: ByteArray,
            symbol: ByteArray,
            base_uri: ByteArray,
            metadata_uri: ByteArray,
            contract_metadata_uri: ByteArray,
            max_supply: u64,
            max_per_wallet: u64,
            mint_price: u256,
            is_free_mint_model: bool,
            salt: felt252,
        ) -> ContractAddress {
            assert(max_supply > 0, 'max supply zero');

            // Free koleksiyonlarda creator geliri yok: mint_price sifir olmali.
            if is_free_mint_model {
                assert(self.is_zero_u256(mint_price), 'free mint price must be 0');
            } else {
                assert(!self.is_zero_u256(mint_price), 'paid mint price must be > 0');
            }

            let caller = get_caller_address();
            let payment_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let deploy_fee = self.deploy_fee.read();
            let ok = payment_token.transfer_from(caller, self.platform_treasury.read(), deploy_fee);
            assert(ok, 'deploy fee transfer failed');

            let mut calldata = array![];
            Serde::<ContractAddress>::serialize(@caller, ref calldata);
            Serde::<ContractAddress>::serialize(@get_contract_address(), ref calldata);
            Serde::<ContractAddress>::serialize(@self.strk_token.read(), ref calldata);
            Serde::<ContractAddress>::serialize(@self.platform_treasury.read(), ref calldata);
            Serde::<ByteArray>::serialize(@name, ref calldata);
            Serde::<ByteArray>::serialize(@symbol, ref calldata);
            Serde::<ByteArray>::serialize(@base_uri, ref calldata);
            Serde::<ByteArray>::serialize(@metadata_uri, ref calldata);
            Serde::<ByteArray>::serialize(@contract_metadata_uri, ref calldata);
            Serde::<u64>::serialize(@max_supply, ref calldata);
            Serde::<u64>::serialize(@max_per_wallet, ref calldata);
            Serde::<u256>::serialize(@mint_price, ref calldata);
            Serde::<u256>::serialize(@self.mint_fee_per_mint.read(), ref calldata);
            Serde::<bool>::serialize(@is_free_mint_model, ref calldata);

            let (collection, _) = deploy_syscall(
                self.collection_class_hash.read(),
                salt,
                calldata.span(),
                false,
            )
                .unwrap_syscall();

            let idx = self.collection_count.read();
            self.collections.write(idx, collection);
            self.collection_count.write(idx + 1);
            self.collection_owner.write(collection, caller);
            self.collection_is_free_model.write(collection, is_free_mint_model);

            self.emit(
                Event::CollectionRegistered(
                    CollectionRegistered {
                        collection,
                        owner: caller,
                        is_free_mint_model,
                        mint_price_low: mint_price.low,
                        mint_price_high: mint_price.high,
                        max_supply,
                        max_per_wallet,
                        name,
                        symbol,
                    },
                ),
            );
            collection
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn is_zero_u256(self: @ContractState, value: u256) -> bool {
            value.low == 0 && value.high == 0
        }

        fn assert_only_admin(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'only admin');
        }
    }

    #[starknet::interface]
    pub trait ILaunchpadFactory<TContractState> {
        fn admin(self: @TContractState) -> ContractAddress;
        fn collection_class_hash(self: @TContractState) -> ClassHash;
        fn strk_token(self: @TContractState) -> ContractAddress;
        fn platform_treasury(self: @TContractState) -> ContractAddress;
        fn deploy_fee(self: @TContractState) -> u256;
        fn mint_fee_per_mint(self: @TContractState) -> u256;
        fn collection_count(self: @TContractState) -> u64;

        fn collection_at(self: @TContractState, index: u64) -> ContractAddress;
        fn collection_owner(self: @TContractState, collection: ContractAddress) -> ContractAddress;
        fn collection_is_free_model(self: @TContractState, collection: ContractAddress) -> bool;

        fn set_platform_fees(ref self: TContractState, deploy_fee: u256, mint_fee_per_mint: u256);
        fn set_admin(ref self: TContractState, admin: ContractAddress);
        fn set_treasury(ref self: TContractState, treasury: ContractAddress);
        fn set_strk_token(ref self: TContractState, strk_token: ContractAddress);
        fn set_collection_class_hash(ref self: TContractState, class_hash: ClassHash);

        fn create_collection(
            ref self: TContractState,
            name: ByteArray,
            symbol: ByteArray,
            base_uri: ByteArray,
            metadata_uri: ByteArray,
            contract_metadata_uri: ByteArray,
            max_supply: u64,
            max_per_wallet: u64,
            mint_price: u256,
            is_free_mint_model: bool,
            salt: felt252,
        ) -> ContractAddress;
    }
}
