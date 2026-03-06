# Starknet ERC-721 Metadata Notes (OZ)

## Sources
- OpenZeppelin Cairo Contracts (ERC-721 docs): https://github.com/OpenZeppelin/cairo-contracts/
- ERC-721 docs page: https://raw.githubusercontent.com/OpenZeppelin/cairo-contracts/main/docs/modules/ROOT/pages/erc721.adoc

## Key points used in Launchy
- ERC-721 on Starknet should integrate both:
  - `ERC721Component`
  - `SRC5Component`
- Constructor should initialize ERC-721 with:
  - `name`
  - `symbol`
  - `base_uri`
- Standard selectors expected by indexers:
  - `name`, `symbol`, `token_uri`
  - camelCase compatibility `tokenURI`
  - `supports_interface`

## Metadata compatibility decisions
- Collection deploys as an independent contract per collection.
- `token_uri/tokenURI` returns a fully qualified metadata URL (gateway URL).
- `contract_uri/contractURI` is exposed to improve collection-level metadata discovery on marketplaces.
- Pinata metadata payload includes:
  - `name`, `description`, `image`
  - `image_ipfs` (extra compatibility field)
  - `collection` object
  - `attributes`

## Mainnet operational note
- When class declaration reports compiled-class-hash mismatch, declaration must use the expected CASM hash required by the Sierra hash.
