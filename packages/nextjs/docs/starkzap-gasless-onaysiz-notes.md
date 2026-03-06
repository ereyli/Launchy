# Starkzap Gasless + Onaysiz Islem Notlari

Bu projede "her islemde popup/onay" davranisini azaltmak icin Cartridge tarafi policy + session modeli kullanilir.

## Ozet

- Injected walletler (Ready/Braavos/Argent X) normalde her kritik islemde imza ister.
- Cartridge tarafinda `session policies` verilirse belirli method/kontrat cagrilari tekrar popup acmadan yurutulebilir.
- Gasless akis `feeMode: sponsored` ile denenecek, uyumsuz hesaplarda otomatik `user_pays` fallback uygulanacak.

## Starkzap tarafinda kritik noktalar

- `OnboardStrategy.Cartridge` ile baglanti acilir.
- `cartridge.policies` alani session policy tanimlamak icindir.
- Cartridge wallet `execute` icinde:
  - `feeMode: sponsored` ise `executePaymasterTransaction`
  - `feeMode: user_pays` ise normal `execute`
  akisi kullanir.

## Bu repoda uygulanan entegrasyon

- Cartridge onboarding policy set:
  - NFT Factory: `create_collection`
  - Token Factory: `create_memecoin`, `create_and_launch_memecoin`, `launch_on_ekubo`
  - Fee Router: `swap_exact_input`
  - STRK: `approve`
- Cartridge execute akisi:
  - once sponsored dener
  - SNIP-9 / paymaster / block-tag uyumsuzlugu olursa otomatik user_pays fallback

## Beklenen UX

- Policy kapsamina giren Cartridge islemlerinde tekrar popup sayisi belirgin azalir.
- Injected walletler eski davranisini korur (Ready dahil).

## Limitasyon

- Dynamic kontratlar (ornegin yeni token adresinde `approve`) policy kapsamina girmezse tekrar onay gelebilir.
- Tam "hic popup yok" icin policy kapsaminin is akislariyla birebir ve onceden sabitlenmis olmasi gerekir.
