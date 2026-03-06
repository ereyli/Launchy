# Launchy

[![All Contributors](https://img.shields.io/badge/all_contributors-0-orange.svg?style=flat-square)](#contributors-)

Monorepo:
- `packages/cairo`: Cairo smart contracts
- `packages/nextjs`: Next.js frontend

## Commands

```bash
yarn compile
yarn test
yarn start
```

## Fee Model

- All collections: creator pays deploy platform fee (`50 STRK`)
- All mints: users pay platform fee (`0.5 STRK` per NFT)
- Paid mint collections: mint price goes to creator
- Free mint collections enforce `mint_price = 0` (creator mint geliri yok)

## All Contributors

Use the GitHub bot in an issue or pull request comment:

```text
@all-contributors please add @<username> for <contributions>
```

Example:

```text
@all-contributors please add @jane.doe23 for code, doc, infra
```

Valid contribution types are listed in the
[All Contributors emoji key](https://allcontributors.org/docs/en/emoji-key).

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- ALL-CONTRIBUTORS-LIST:END -->
