# Launchy

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
