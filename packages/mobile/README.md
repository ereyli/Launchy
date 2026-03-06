# Launchy Mobile (Starkzap)

React Native/Expo mobil uygulama paketi.
Web uygulamasına dokunmadan ayrı çalışır.

## Özellikler

- Starkzap SDK ile wallet onboarding
- Cartridge bağlantısı (sponsored)
- Privy bağlantısı (opsiyonel resolve endpoint ile)
- Token/NFT liste ekranları (API üzerinden)
- Mobil-first dark UI (Launchy theme)

## Kurulum

1. Root'ta bağımlılıkları kur:

```bash
yarn install
```

2. Ortam değişkenleri:

```bash
cp packages/mobile/.env.example packages/mobile/.env
```

3. Mobil başlat:

```bash
yarn start:mobile
```

## Komutlar

```bash
yarn start:mobile
yarn ios:mobile
yarn android:mobile
```

## Notlar

- `EXPO_PUBLIC_API_BASE_URL` Next.js API'nı göstermeli.
- `EXPO_PUBLIC_PAYMASTER_URL` AVNU paymaster endpoint.
- `EXPO_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS` swap tx için router kontratı.
- Privy için `EXPO_PUBLIC_PRIVY_RESOLVE_URL` backend endpoint gerekir.
