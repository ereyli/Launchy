# Starknet NFT Launchpad - Teknik Ogrenim Notlari ve Gelistirme Plani

Bu dokuman, Starkzap + Cairo + Starknet account abstraction + gasless islemler odakli teknik ozet ve sizin tarif ettiginiz OpenSea benzeri launchpad modeli icin uygulanabilir mimari planidir.

## 1) Incelenen Dokumanlar (kaynak listesi)

Aşağıdaki kaynaklar incelendi:

- Starkzap overview: https://docs.starknet.io/build/starkzap/overview
- Starkzap installation: https://docs.starknet.io/build/starkzap/installation
- Starkzap quick start: https://docs.starknet.io/build/starkzap/quick-start
- Starkzap wallets: https://docs.starknet.io/build/starkzap/connecting-wallets
- Starkzap transactions: https://docs.starknet.io/build/starkzap/transactions
- Starkzap paymasters: https://docs.starknet.io/build/starkzap/paymasters
- Starkzap AVNU integration: https://docs.starknet.io/build/starkzap/integrations/avnu-paymaster
- Starkzap Privy integration: https://docs.starknet.io/build/starkzap/integrations/privy
- Starkzap Cartridge integration: https://docs.starknet.io/build/starkzap/integrations/cartridge-controller
- Starkzap examples: https://docs.starknet.io/build/starkzap/examples
- Starkzap repo: https://github.com/keep-starknet-strange/starkzap
- awesome-starkzap: https://github.com/keep-starknet-strange/awesome-starkzap
- winky-starkzap tutorial repo: https://github.com/starkience/winky-starkzap
- Starknet factory pattern: https://docs.starknet.io/guides/starknet-by-example/factory-pattern/
- Starknet ERC721 example: https://docs.starknet.io/build/starknet-by-example/applications/erc721
- Starknet accounts/account abstraction: https://docs.starknet.io/learn/protocol/accounts
- Starknet tx reference (v3/paymaster_data): https://docs.starknet.io/learn/cheatsheets/transactions-reference
- OpenZeppelin Cairo ERC721: https://docs.openzeppelin.com/contracts-cairo/3.x/erc721
- Pinata uploads/presigned URLs: https://docs.pinata.cloud/files/uploading-files ve https://docs.pinata.cloud/files/presigned-urls
- Cairo Coder: https://www.cairo-coder.com/

Not: Verdiğiniz X (Twitter) linklerinin sayfa icerigi arac tarafinda okunabilir donmedi, bu nedenle teknik cikarim resmi dokumanlar + repolar uzerinden yapildi.

## 2) Starkzap teknik cikarim (Launchpad icin kritik)

- `starkzap` TypeScript SDK, cüzdan baglama + account deploy + execute + token operasyonlari + paymaster akislarini tek API’da birlestiriyor.
- Wallet stratejileri:
  - `StarkSigner` (private key, daha cok backend/server)
  - `PrivySigner` (social/email onboarding, server-side signing endpoint ile)
  - `Cartridge` (session/policy tabanli, oyun benzeri kesintisiz UX)
- Islem gonderimi:
  - `wallet.execute(calls)` ile tekli/coklu atomik call
  - `tx.wait()` ile confirmation
  - `wallet.preflight({ calls })` ile simulation
- Sponsored/gasless:
  - AVNU ile `feeMode: "sponsored"` (Privy veya signer flow’da)
  - Cartridge’ta policy uyumlu islemler otomatik paymasterli (ek AVNU setup gerekmiyor)
- `wallet.ensureReady()` cok onemli: hesap deploy edilmemisse deploy edip sonra isleme hazirliyor.

## 3) Cairo/Starknet teknik temel (Launchpad tasarimini belirleyen)

- Starknet’te contract class ve instance ayrimi var:
  - Bir class hash (kod)
  - Coklu instance (her koleksiyon ayri adres)
- Bu model launchpad icin ideal:
  - Tek bir `Collection` class hash once declare edilir
  - Her yeni koleksiyon factory ile yeni instance olarak deploy edilir
- Factory pattern resmi olarak onerilen model.
- Account abstraction native:
  - Accountlar smart contract
  - `__validate__`, `__execute__` ve declare/deploy validasyon fonksiyonlari
- ERC721 tarafinda OpenZeppelin Cairo `ERC721Component + SRC5Component` kullanimi guvenli ve standart yaklasim.

## 4) Gasless islemler: gercekci strateji

Iki yol:

1. AVNU Paymaster (onerilen genel consumer app modeli)
- Privy/signer wallet akisinda kullanilir.
- Dapp sponsor olabilir (gasfree) veya kullanici token ile odeyebilir (gasless mode).
- Prod ortamda API key backend’de tutulup paymaster proxy endpoint uzerinden kullanilmali.

2. Cartridge policy/session modeli
- Policy uyumlu metodlar otomatik sponsored.
- Ozellikle game benzeri yuksek frekansli islemlerde iyi.
- Launchpad icin de mint aksiyonlarinda kullanilabilir, ama consumer app’de Privy+AVNU genelde daha dogrudan olur.

Onemli not:
- Starknet tx v3 referansinda `paymaster_data` alani protokol seviyesinde "gelecek kullanim" olarak gecse de, Starkzap + AVNU pratiği bugun dapp seviyesinde sponsored UX sagliyor.

## 5) Sizin launchpad modelinizin on-chain urune cevirimi

Istenen is kurali:

- Kullanici koleksiyon olusturur: isim, sembol, arz, mint fiyati, baseURI vb.
- Deploy sirasinda platform fee oder.
- Eger koleksiyon `free mint` ise:
  - deploy aninda buyuk tek seferlik fee yok
  - her mint basina platform fee kesilir (ornegin `1 STRK`)
- Eger koleksiyon `paid mint` ise:
  - deployda tek seferlik yuksek fee (ornegin `50 STRK`)
  - mint basina platform fee alinmaz
- Her koleksiyon ayri mint contract adresine sahip olur.
- Koleksiyon sahibi mint sayfasi linkini paylasir, herkes o adresten mint eder.

Bu model teknik olarak uygulanabilir ve factory + per-collection config ile net sekilde cozulur.

## 6) Onerilen kontrat mimarisi (Cairo)

### A. `LaunchpadFactory.cairo`

Sorumluluklar:
- Collection class hash saklar.
- Yeni koleksiyon deploy eder (deploy_syscall/UDC modeli).
- Platform parametrelerini saklar:
  - `strk_token`
  - `platform_treasury`
  - `deploy_fee_paid_mint` (default 50 STRK)
  - `mint_fee_free_mint` (default 1 STRK)
- Koleksiyon kaydi tutar:
  - collection address
  - owner
  - model type (FREE veya PAID)

Fonksiyonlar:
- `create_collection(params)`
- `set_platform_fees(...)` (only admin)
- `set_collection_class_hash(...)` (only admin)
- `set_treasury(...)` (only admin)

### B. `LaunchpadCollectionERC721.cairo`

Temel:
- OpenZeppelin `ERC721Component` + `SRC5Component`
- Constructor’da metadata + owner + fee config + supply cap + mint windows

State:
- `owner`
- `factory`
- `max_supply`
- `mint_price`
- `mint_start` / `mint_end` (opsiyonel)
- `is_free_mint_model`
- `platform_fee_per_mint`
- `platform_fee_recipient`
- `payment_token` (STRK)
- `total_minted`
- `next_token_id`
- `base_uri`

Fonksiyonlar:
- `mint(quantity)` public
- `owner_mint(to, quantity)` only owner
- `set_base_uri(...)` only owner
- `withdraw_proceeds(...)` only owner
- `pause/unpause` only owner/admin (onerilir)

Mint odeme mantigi:
- FREE model:
  - Minter `platform_fee_per_mint * quantity` oder
  - Koleksiyon sahibine mint geliri yoksa 0 olabilir (tam free koleksiyon)
- PAID model:
  - Minter `mint_price * quantity` oder (koleksiyon sahibine)
  - Platform fee mint aninda 0 (deployda zaten odendi)

Not:
- `payment_token` olarak STRK ERC20 dispatcher ile `transferFrom` kullanilacak.
- UI tarafinda mint oncesi `approve` akisi gerekir.

### C. Opsiyonel `LaunchpadRegistry` (factory icinde de tutulabilir)

- Tum koleksiyonlarin listelenmesi
- Kullaniciya gore koleksiyon filtreleme
- Indexer kolayligi icin event-first tasarim

## 7) Backend mimarisi (Next.js API + servisler)

### A. Pinata servis

- API key client’a verilmez.
- Backend signed URL uretir.
- Client dosyayi signed URL ile dogrudan Pinata’ya upload eder.
- Sonuc CID ile metadata JSON uretilir ve yine Pinata’ya yuklenir.
- Son base token URI: `ipfs://<cid>/` veya gateway URL.

### B. Privy signing endpoint (eger Privy secilecekse)

- `/api/wallet/starknet` -> wallet context (walletId/publicKey)
- `/api/wallet/sign` -> tx hash imzalama

### C. AVNU paymaster proxy (gasless UX icin)

- `/api/paymaster/*` endpointi
- AVNU API key sadece backend’de
- Frontend SDK config `nodeUrl` olarak proxy’yi kullanir

## 8) Frontend akislari (Next.js + Starkzap)

- `~~` alias kullanilarak moduler yapi.

Sayfalar:
- `/create`
  - koleksiyon formu (name, symbol, supply, mint model, mint price, image set)
  - image + metadata upload
  - factory `create_collection` call
- `/collection/[address]`
  - koleksiyon bilgisi
  - mint islemi
  - approve + mint adimlari
- `/dashboard`
  - creator’in koleksiyonlari
  - gelir/istatistik

Starkzap tarafi:
- Onboarding: Privy strategy (consumer UX)
- `ensureReady()` her kritik user actiondan once
- `execute` ile approve + mint multicall imkanlari
- `feeMode: "sponsored"` secili islem tiplerinde aktif

## 9) Ucret modeli: net on-chain formul

- Parametreler:
  - `D = deploy_fee_paid_mint` (ornek 50 STRK)
  - `F = mint_fee_free_mint` (ornek 1 STRK)

### PAID koleksiyon:
- Koleksiyon yaratirken: creator `D` oder
- Mint aninda: minter `mint_price` oder (creator’a)
- Platform mint fee: `0`

### FREE koleksiyon:
- Koleksiyon yaratirken: creator `0` (veya dusuk sabit)
- Mint aninda: minter `F` oder (platform treasury’ye)
- Creator geliri: `0` (tam free modelde)

Not:
- Isterseniz FREE modelde creator’a opsiyonel tip/bağış payi eklenebilir ama ilk MVP’de gerekmez.

## 10) Guvenlik ve kalite kontrol checklist

- Access control: sadece admin platform fee parametrelerini degistirebilmeli.
- Reentrancy korumasi: özellikle token transfer + mint kombinasyonunda dikkat.
- Checks-effects-interactions sirasi korunmali.
- Supply cap asimi test edilmeli.
- Time window testleri (`mint_start/end`) yazilmali.
- ERC20 transferFrom donus/hatali token edge-case kontrolu.
- Event coverage:
  - `CollectionCreated`
  - `Minted`
  - `PlatformFeePaid`
  - `Withdrawn`
- Unit test + integration test + fork/sepolia smoke test.

## 11) Adim adim delivery plani (MVP -> Production)

### Faz 1 - Kontrat cekirdegi
- `LaunchpadFactory` + `LaunchpadCollectionERC721`
- fee modeli birebir
- temel eventler
- local testler

### Faz 2 - Frontend MVP
- create form
- collection mint page
- wallet onboarding (Privy veya signer)
- basic transaction UX

### Faz 3 - Pinata entegrasyonu
- signed upload endpoint
- image + metadata pipeline
- CID/URI dogrulama

### Faz 4 - Gasless UX
- AVNU paymaster proxy
- sponsored deploy/mint stratejisi
- islem basarisizlik fallbackleri

### Faz 5 - Endeksleme ve analytics
- event indexer
- dashboard metrikleri
- popular collections / mint history

### Faz 6 - Security hardening
- kapsamli test
- static analysis
- audit oncesi checklist

## 12) Bu repository icin somut teknik yol haritasi

Repository kurallariyla uyumlu:
- `packages/cairo`: kontratlar + Scarb testleri
- `packages/nextjs`: UI + Starkzap SDK + API routes

Oncelik sirası:
1. Cairo kontratlarin iskeleti + testler
2. Next.js create/mint ekranlari
3. Pinata signed URL backend
4. Starkzap onboarding + paymaster
5. Sepolia end-to-end test

## 13) Sonuc

Sizin tarif ettiginiz model Starknet’te teknik olarak cok uygun:
- Factory pattern ile her koleksiyon ayri adres.
- Cairo ERC721 + STRK odeme akisi ile fee modeli birebir uygulanir.
- Starkzap + Privy + AVNU ile Web2-benzeri onboarding ve gassiz UX yakalanir.
- Pinata signed URL akisiyla guvenli medya/metadata pipeline kurulabilir.

Bir sonraki adimda dogrudan kodlamaya gecip `packages/cairo` ve `packages/nextjs` altinda MVP iskeletini olusturabiliriz.
