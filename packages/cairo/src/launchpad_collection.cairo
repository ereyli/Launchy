#[starknet::contract]
mod LaunchpadCollection {
    use core::byte_array::ByteArray;
    use core::num::traits::Zero;
    use crate::interfaces::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_token::erc721::{ERC721Component, ERC721HooksEmptyImpl};
    use openzeppelin_token::erc721::interface::{IERC721Metadata, IERC721MetadataCamelOnly};
    use starknet::event::EventEmitter;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    // Standard ERC721 + camelCase methods
    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC721CamelOnlyImpl = ERC721Component::ERC721CamelOnlyImpl<ContractState>;

    // Standard SRC5 (supports_interface)
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    // Internal helpers from OZ ERC721
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;

    // Empty hooks implementation required by ERC721 component bounds
    impl ERC721HooksImpl = ERC721HooksEmptyImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,

        owner: ContractAddress,
        factory: ContractAddress,
        payment_token: ContractAddress,
        platform_treasury: ContractAddress,

        name_value: ByteArray,
        symbol_value: ByteArray,
        base_uri_value: ByteArray,
        metadata_uri: ByteArray,
        contract_metadata_uri: ByteArray,

        max_supply: u64,
        mint_price: u256,
        platform_fee_per_mint: u256,
        is_free_mint_model: bool,
        max_per_wallet: u64,

        total_minted: u64,
        next_token_id: u64,
        minted_by_wallet: starknet::storage::Map<ContractAddress, u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        Minted: Minted,
    }

    #[derive(Drop, starknet::Event)]
    struct Minted {
        minter: ContractAddress,
        quantity: u64,
        from_token_id: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        factory: ContractAddress,
        payment_token: ContractAddress,
        platform_treasury: ContractAddress,
        name: ByteArray,
        symbol: ByteArray,
        base_uri: ByteArray,
        metadata_uri: ByteArray,
        contract_metadata_uri: ByteArray,
        max_supply: u64,
        max_per_wallet: u64,
        mint_price: u256,
        platform_fee_per_mint: u256,
        is_free_mint_model: bool,
    ) {
        assert(!owner.is_zero(), 'invalid owner');
        assert(!factory.is_zero(), 'invalid factory');
        assert(!payment_token.is_zero(), 'invalid payment token');
        assert(!platform_treasury.is_zero(), 'invalid treasury');
        assert(max_supply > 0, 'max supply is zero');

        self.owner.write(owner);
        self.factory.write(factory);
        self.payment_token.write(payment_token);
        self.platform_treasury.write(platform_treasury);

        self.name_value.write(name.clone());
        self.symbol_value.write(symbol.clone());
        self.base_uri_value.write(base_uri.clone());
        self.metadata_uri.write(metadata_uri);
        self.contract_metadata_uri.write(contract_metadata_uri);

        self.max_supply.write(max_supply);
        self.max_per_wallet.write(max_per_wallet);
        self.mint_price.write(mint_price);
        self.platform_fee_per_mint.write(platform_fee_per_mint);
        self.is_free_mint_model.write(is_free_mint_model);

        self.next_token_id.write(1);

        // Registers IERC721 + IERC721Metadata + ISRC5
        self.erc721.initializer(name, symbol, base_uri);
    }

    // Explicit metadata ABI implementation (snake_case)
    #[abi(embed_v0)]
    impl ERC721MetadataImpl of IERC721Metadata<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.name_value.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.symbol_value.read()
        }

        fn token_uri(self: @ContractState, token_id: u256) -> ByteArray {
            // Revert with standard ERC721 error if token does not exist.
            self.erc721.owner_of(token_id);
            self.metadata_uri.read()
        }
    }

    // Explicit metadata ABI implementation (camelCase)
    #[abi(embed_v0)]
    impl ERC721MetadataCamelImpl of IERC721MetadataCamelOnly<ContractState> {
        fn tokenURI(self: @ContractState, tokenId: u256) -> ByteArray {
            // Revert with standard ERC721 error if token does not exist.
            self.erc721.owner_of(tokenId);
            self.metadata_uri.read()
        }
    }

    #[abi(embed_v0)]
    impl External of ILaunchpadCollection<ContractState> {
        fn owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn factory(self: @ContractState) -> ContractAddress {
            self.factory.read()
        }

        fn payment_token(self: @ContractState) -> ContractAddress {
            self.payment_token.read()
        }

        fn base_uri(self: @ContractState) -> ByteArray {
            self.base_uri_value.read()
        }

        fn metadata_uri(self: @ContractState) -> ByteArray {
            self.metadata_uri.read()
        }

        fn get_base_uri(self: @ContractState) -> ByteArray {
            self.base_uri_value.read()
        }

        fn get_token_uri(self: @ContractState, token_id: u256) -> ByteArray {
            self.erc721.owner_of(token_id);
            self.metadata_uri.read()
        }

        fn contract_uri(self: @ContractState) -> ByteArray {
            self.contract_metadata_uri.read()
        }

        fn contractURI(self: @ContractState) -> ByteArray {
            self.contract_metadata_uri.read()
        }

        fn get_contract_uri(self: @ContractState) -> ByteArray {
            self.contract_metadata_uri.read()
        }

        fn total_supply(self: @ContractState) -> u64 {
            self.total_minted.read()
        }

        fn max_supply(self: @ContractState) -> u64 {
            self.max_supply.read()
        }

        fn mint_price(self: @ContractState) -> u256 {
            self.mint_price.read()
        }

        fn platform_fee_per_mint(self: @ContractState) -> u256 {
            self.platform_fee_per_mint.read()
        }

        fn is_free_mint_model(self: @ContractState) -> bool {
            self.is_free_mint_model.read()
        }

        fn max_per_wallet(self: @ContractState) -> u64 {
            self.max_per_wallet.read()
        }

        fn minted_by_wallet(self: @ContractState, wallet: ContractAddress) -> u64 {
            self.minted_by_wallet.read(wallet)
        }

        fn mint(ref self: ContractState, quantity: u64) {
            assert(quantity > 0, 'quantity zero');

            let minted = self.total_minted.read();
            let max_supply = self.max_supply.read();
            assert(minted + quantity <= max_supply, 'sold out');

            let caller = get_caller_address();
            let per_wallet_limit = self.max_per_wallet.read();
            if per_wallet_limit > 0 {
                let current_wallet_minted = self.minted_by_wallet.read(caller);
                assert(current_wallet_minted + quantity <= per_wallet_limit, 'wallet limit');
                self.minted_by_wallet.write(caller, current_wallet_minted + quantity);
            }
            let payment_token = IERC20Dispatcher { contract_address: self.payment_token.read() };

            let qty_u256: u256 = quantity.into();
            let fee = self.platform_fee_per_mint.read() * qty_u256;
            let fee_ok = payment_token.transfer_from(caller, self.platform_treasury.read(), fee);
            assert(fee_ok, 'fee transfer failed');

            if !self.is_free_mint_model.read() {
                let payment = self.mint_price.read() * qty_u256;
                let payment_ok = payment_token.transfer_from(caller, self.owner.read(), payment);
                assert(payment_ok, 'mint payment failed');
            }

            let mut token_id = self.next_token_id.read();
            let first_token_id = token_id;
            let mut i: u64 = 0;
            loop {
                if i == quantity {
                    break;
                };
                let token_id_u256: u256 = token_id.into();
                self.erc721.mint(caller, token_id_u256);
                i += 1;
                token_id += 1;
            };

            self.total_minted.write(minted + quantity);
            self.next_token_id.write(token_id);
            self.emit(Event::Minted(Minted { minter: caller, quantity, from_token_id: first_token_id }));
        }

        fn owner_mint(ref self: ContractState, to: ContractAddress, quantity: u64) {
            assert(!to.is_zero(), 'zero to');
            self.assert_only_owner();
            assert(quantity > 0, 'quantity zero');

            let minted = self.total_minted.read();
            let max_supply = self.max_supply.read();
            assert(minted + quantity <= max_supply, 'sold out');

            let mut token_id = self.next_token_id.read();
            let first_token_id = token_id;
            let mut i: u64 = 0;
            loop {
                if i == quantity {
                    break;
                };
                let token_id_u256: u256 = token_id.into();
                self.erc721.mint(to, token_id_u256);
                i += 1;
                token_id += 1;
            };

            self.total_minted.write(minted + quantity);
            self.next_token_id.write(token_id);
            self.emit(Event::Minted(Minted { minter: to, quantity, from_token_id: first_token_id }));
        }

        fn set_base_uri(ref self: ContractState, base_uri: ByteArray) {
            self.assert_only_owner();
            self.base_uri_value.write(base_uri.clone());
            self.erc721._set_base_uri(base_uri);
        }

        fn set_contract_uri(ref self: ContractState, uri: ByteArray) {
            self.assert_only_owner();
            self.contract_metadata_uri.write(uri);
        }

        fn set_max_per_wallet(ref self: ContractState, limit: u64) {
            self.assert_only_owner();
            self.max_per_wallet.write(limit);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'only owner');
        }
    }

    #[starknet::interface]
    pub trait ILaunchpadCollection<TContractState> {
        fn owner(self: @TContractState) -> ContractAddress;
        fn factory(self: @TContractState) -> ContractAddress;
        fn payment_token(self: @TContractState) -> ContractAddress;
        fn base_uri(self: @TContractState) -> ByteArray;
        fn metadata_uri(self: @TContractState) -> ByteArray;
        fn get_base_uri(self: @TContractState) -> ByteArray;
        fn get_token_uri(self: @TContractState, token_id: u256) -> ByteArray;
        fn contract_uri(self: @TContractState) -> ByteArray;
        fn contractURI(self: @TContractState) -> ByteArray;
        fn get_contract_uri(self: @TContractState) -> ByteArray;
        fn total_supply(self: @TContractState) -> u64;
        fn max_supply(self: @TContractState) -> u64;
        fn mint_price(self: @TContractState) -> u256;
        fn platform_fee_per_mint(self: @TContractState) -> u256;
        fn is_free_mint_model(self: @TContractState) -> bool;
        fn max_per_wallet(self: @TContractState) -> u64;
        fn minted_by_wallet(self: @TContractState, wallet: ContractAddress) -> u64;

        fn mint(ref self: TContractState, quantity: u64);
        fn owner_mint(ref self: TContractState, to: ContractAddress, quantity: u64);
        fn set_base_uri(ref self: TContractState, base_uri: ByteArray);
        fn set_contract_uri(ref self: TContractState, uri: ByteArray);
        fn set_max_per_wallet(ref self: TContractState, limit: u64);
    }
}
