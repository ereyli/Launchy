#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CAIRO_DIR="$ROOT_DIR/packages/cairo"
DEPLOY_DIR="$ROOT_DIR/.deploy/sepolia"

RPC_URL="${RPC_URL:-https://starknet-sepolia-rpc.publicnode.com}"
STRK_TOKEN="${STRK_TOKEN:-0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d}"

ACCOUNT_FILE="$DEPLOY_DIR/deployer.account.json"
KEYSTORE_FILE="$DEPLOY_DIR/deployer.keystore.json"
PASSWORD_FILE="$DEPLOY_DIR/deployer.password"
ADDRESS_FILE="$DEPLOY_DIR/deployer.address"
OUT_FILE="$DEPLOY_DIR/deployment.json"

COLLECTION_ARTIFACT="$CAIRO_DIR/target/dev/launchpad_cairo_LaunchpadCollection.contract_class.json"
FACTORY_ARTIFACT="$CAIRO_DIR/target/dev/launchpad_cairo_LaunchpadFactory.contract_class.json"

DEPLOY_FEE_LOW="50000000000000000000"   # 50 STRK
DEPLOY_FEE_HIGH="0"
MINT_FEE_LOW="500000000000000000"       # 0.5 STRK
MINT_FEE_HIGH="0"

if [[ ! -f "$ACCOUNT_FILE" || ! -f "$KEYSTORE_FILE" || ! -f "$PASSWORD_FILE" || ! -f "$ADDRESS_FILE" ]]; then
  echo "Missing deployer files under $DEPLOY_DIR"
  echo "Expected: deployer.account.json, deployer.keystore.json, deployer.password, deployer.address"
  exit 1
fi

if [[ ! -f "$COLLECTION_ARTIFACT" || ! -f "$FACTORY_ARTIFACT" ]]; then
  echo "Contract artifacts not found. Building Cairo contracts first..."
  (cd "$CAIRO_DIR" && scarb build)
fi

PASS="$(cat "$PASSWORD_FILE")"
ADMIN_ADDRESS="$(cat "$ADDRESS_FILE")"

declare_with_fallback() {
  local artifact="$1"
  local class_hash="$2"
  local label="$3"

  if starkli class-by-hash "$class_hash" --rpc "$RPC_URL" >/dev/null 2>&1; then
    echo "$label class already declared."
    return
  fi

  echo "Declaring $label class with local compiler..."
  set +e
  local out
  out="$(
    starkli declare "$artifact" \
      --rpc "$RPC_URL" \
      --account "$ACCOUNT_FILE" \
      --keystore "$KEYSTORE_FILE" \
      --keystore-password "$PASS" \
      --watch 2>&1
  )"
  local code=$?
  set -e

  if [[ $code -eq 0 ]]; then
    echo "$out"
    return
  fi

  echo "$out"
  local expected
  expected="$(echo "$out" | sed -n 's/.*Expected: \(0x[0-9a-fA-F]\+\).*/\1/p' | tail -n 1)"

  if [[ -z "$expected" ]]; then
    echo "Failed to declare $label class and could not parse expected compiled class hash."
    exit 1
  fi

  echo "Retrying $label declaration with expected CASM hash: $expected"
  starkli declare "$artifact" \
    --casm-hash "$expected" \
    --rpc "$RPC_URL" \
    --account "$ACCOUNT_FILE" \
    --keystore "$KEYSTORE_FILE" \
    --keystore-password "$PASS" \
    --watch
}

echo "RPC: $RPC_URL"
echo "Admin/Treasury: $ADMIN_ADDRESS"
echo "STRK token: $STRK_TOKEN"

echo "Checking deployer STRK balance..."
BALANCE_RAW="$(starkli call "$STRK_TOKEN" balanceOf "$ADMIN_ADDRESS" --rpc "$RPC_URL")"
BALANCE_LOW="$(echo "$BALANCE_RAW" | sed -n '2p' | tr -d ' ",')"
BALANCE_HIGH="$(echo "$BALANCE_RAW" | sed -n '3p' | tr -d ' ",')"
echo "Balance low:  $BALANCE_LOW"
echo "Balance high: $BALANCE_HIGH"
if [[ "$BALANCE_LOW" == "0x0000000000000000000000000000000000000000000000000000000000000000" && "$BALANCE_HIGH" == "0x0000000000000000000000000000000000000000000000000000000000000000" ]]; then
  echo "Deployer account has 0 STRK. Fund the address and rerun."
  exit 1
fi

echo "Checking whether account is already deployed..."
if starkli class-hash-at "$ADMIN_ADDRESS" --rpc "$RPC_URL" >/dev/null 2>&1; then
  echo "Account already deployed."
else
  echo "Deploying account..."
  starkli account deploy "$ACCOUNT_FILE" \
    --rpc "$RPC_URL" \
    --keystore "$KEYSTORE_FILE" \
    --keystore-password "$PASS"
fi

echo "Computing local class hashes..."
COLLECTION_CLASS_HASH="$(starkli class-hash "$COLLECTION_ARTIFACT")"
FACTORY_CLASS_HASH="$(starkli class-hash "$FACTORY_ARTIFACT")"
echo "Collection class hash: $COLLECTION_CLASS_HASH"
echo "Factory class hash:    $FACTORY_CLASS_HASH"

echo "Ensuring collection class is declared..."
declare_with_fallback "$COLLECTION_ARTIFACT" "$COLLECTION_CLASS_HASH" "Collection"

echo "Ensuring factory class is declared..."
declare_with_fallback "$FACTORY_ARTIFACT" "$FACTORY_CLASS_HASH" "Factory"

echo "Deploying factory..."
DEPLOY_OUTPUT="$(
  starkli deploy "$FACTORY_CLASS_HASH" \
    "$ADMIN_ADDRESS" \
    "$COLLECTION_CLASS_HASH" \
    "$STRK_TOKEN" \
    "$ADMIN_ADDRESS" \
    "$DEPLOY_FEE_LOW" \
    "$DEPLOY_FEE_HIGH" \
    "$MINT_FEE_LOW" \
    "$MINT_FEE_HIGH" \
    --rpc "$RPC_URL" \
    --account "$ACCOUNT_FILE" \
    --keystore "$KEYSTORE_FILE" \
    --keystore-password "$PASS" \
    --watch
)"
echo "$DEPLOY_OUTPUT"

FACTORY_ADDRESS="$(echo "$DEPLOY_OUTPUT" | awk -F': ' '/Contract address/ {print $2}' | tail -n 1)"
DEPLOY_TX_HASH="$(echo "$DEPLOY_OUTPUT" | awk -F': ' '/Transaction hash/ {print $2}' | tail -n 1)"

if [[ -z "$FACTORY_ADDRESS" ]]; then
  echo "Failed to parse factory address from deploy output."
  exit 1
fi

jq -n \
  --arg network "sepolia" \
  --arg rpc "$RPC_URL" \
  --arg admin "$ADMIN_ADDRESS" \
  --arg treasury "$ADMIN_ADDRESS" \
  --arg strk "$STRK_TOKEN" \
  --arg collection_class_hash "$COLLECTION_CLASS_HASH" \
  --arg factory_class_hash "$FACTORY_CLASS_HASH" \
  --arg factory_address "$FACTORY_ADDRESS" \
  --arg deploy_tx_hash "$DEPLOY_TX_HASH" \
  --arg deploy_fee_low "$DEPLOY_FEE_LOW" \
  --arg mint_fee_low "$MINT_FEE_LOW" \
  '{
    network: $network,
    rpc: $rpc,
    admin: $admin,
    treasury: $treasury,
    strk_token: $strk,
    collection_class_hash: $collection_class_hash,
    factory_class_hash: $factory_class_hash,
    factory_address: $factory_address,
    factory_deploy_tx_hash: $deploy_tx_hash,
    deploy_fee_low_wei: $deploy_fee_low,
    mint_fee_low_wei: $mint_fee_low
  }' > "$OUT_FILE"

echo "Deployment output saved: $OUT_FILE"

ENV_FILE="$ROOT_DIR/packages/nextjs/.env.local"
touch "$ENV_FILE"

upsert_env() {
  local key="$1"
  local value="$2"
  if rg -n "^${key}=" "$ENV_FILE" >/dev/null 2>&1; then
    sed -i '' "s#^${key}=.*#${key}=${value}#g" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

upsert_env "NEXT_PUBLIC_STARKNET_RPC" "$RPC_URL"
upsert_env "NEXT_PUBLIC_FACTORY_ADDRESS" "$FACTORY_ADDRESS"
upsert_env "NEXT_PUBLIC_STRK_ADDRESS" "$STRK_TOKEN"

echo "Updated frontend env file: $ENV_FILE"
echo "NEXT_PUBLIC_FACTORY_ADDRESS=$FACTORY_ADDRESS"
echo "NEXT_PUBLIC_STRK_ADDRESS=$STRK_TOKEN"
