#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CAIRO_DIR="$ROOT_DIR/packages/cairo"
DEPLOY_DIR="$ROOT_DIR/.deploy/sepolia"

RPC_URL="${RPC_URL:-https://starknet-sepolia-rpc.publicnode.com}"
EKUBO_CORE_ADDRESS="${EKUBO_CORE_ADDRESS:-0x0444a09d96389aa7148f1aada508e30b71299ffe650d9c97fdaae38cb9a23384}"
FEE_BPS="${FEE_BPS:-30}" # 0.3%

ACCOUNT_FILE="$DEPLOY_DIR/deployer.account.json"
KEYSTORE_FILE="$DEPLOY_DIR/deployer.keystore.json"
PASSWORD_FILE="$DEPLOY_DIR/deployer.password"
ADDRESS_FILE="$DEPLOY_DIR/deployer.address"
OUT_FILE="$DEPLOY_DIR/ekubo_fee_swapper_deployment.json"

ARTIFACT="$CAIRO_DIR/target/dev/launchpad_cairo_EkuboFeeSwapper.contract_class.json"

if [[ ! -f "$ACCOUNT_FILE" || ! -f "$KEYSTORE_FILE" || ! -f "$PASSWORD_FILE" || ! -f "$ADDRESS_FILE" ]]; then
  echo "Missing deployer files under $DEPLOY_DIR"
  exit 1
fi

if [[ ! -f "$ARTIFACT" ]]; then
  echo "Fee swapper artifact missing. Building..."
  (cd "$CAIRO_DIR" && scarb build)
fi

PASS="$(cat "$PASSWORD_FILE")"
ADMIN_ADDRESS="$(cat "$ADDRESS_FILE")"

declare_with_fallback() {
  local artifact="$1"
  local class_hash="$2"
  local label="$3"

  if starkli class-by-hash "$class_hash" --rpc "$RPC_URL" >/dev/null 2>&1; then
    echo "$label already declared."
    return
  fi

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
  expected="$(echo "$out" | rg -o "Expected: 0x[0-9a-fA-F]+" | awk '{print $2}' | tail -n 1)"
  if [[ -z "$expected" ]]; then
    echo "Failed to declare $label and could not parse expected CASM hash."
    exit 1
  fi

  starkli declare "$artifact" \
    --casm-hash "$expected" \
    --rpc "$RPC_URL" \
    --account "$ACCOUNT_FILE" \
    --keystore "$KEYSTORE_FILE" \
    --keystore-password "$PASS" \
    --watch
}

CLASS_HASH="$(starkli class-hash "$ARTIFACT")"
echo "Fee swapper class hash: $CLASS_HASH"

declare_with_fallback "$ARTIFACT" "$CLASS_HASH" "EkuboFeeSwapper"

DEPLOY_OUTPUT="$(
  starkli deploy "$CLASS_HASH" \
    "$ADMIN_ADDRESS" \
    "$ADMIN_ADDRESS" \
    "$EKUBO_CORE_ADDRESS" \
    "$FEE_BPS" \
    --rpc "$RPC_URL" \
    --account "$ACCOUNT_FILE" \
    --keystore "$KEYSTORE_FILE" \
    --keystore-password "$PASS" \
    --watch
)"
echo "$DEPLOY_OUTPUT"

SWAPPER_ADDRESS="$(
  echo "$DEPLOY_OUTPUT" | awk -F': ' '
    /Contract address/ {print $2}
    /Contract deployed:/ {getline; print $1}
    /The contract will be deployed at address/ {print $2}
  ' | rg -o "0x[0-9a-fA-F]+" | tail -n 1
)"
DEPLOY_TX_HASH="$(
  echo "$DEPLOY_OUTPUT" | awk -F': ' '
    /Transaction hash/ {print $2}
    /Contract deployment transaction/ {print $2}
  ' | rg -o "0x[0-9a-fA-F]+" | tail -n 1
)"

if [[ -z "$SWAPPER_ADDRESS" ]]; then
  echo "Failed parsing fee swapper address."
  exit 1
fi

jq -n \
  --arg network "sepolia" \
  --arg rpc "$RPC_URL" \
  --arg admin "$ADMIN_ADDRESS" \
  --arg treasury "$ADMIN_ADDRESS" \
  --arg ekubo_core "$EKUBO_CORE_ADDRESS" \
  --arg class_hash "$CLASS_HASH" \
  --arg swapper_address "$SWAPPER_ADDRESS" \
  --arg deploy_tx_hash "$DEPLOY_TX_HASH" \
  --arg fee_bps "$FEE_BPS" \
  '{
    network: $network,
    rpc: $rpc,
    admin: $admin,
    treasury: $treasury,
    ekubo_core: $ekubo_core,
    class_hash: $class_hash,
    fee_swapper_address: $swapper_address,
    deploy_tx_hash: $deploy_tx_hash,
    fee_bps: $fee_bps
  }' > "$OUT_FILE"

ENV_FILE="$ROOT_DIR/packages/nextjs/.env.local"
touch "$ENV_FILE"

if rg -n "^NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS=" "$ENV_FILE" >/dev/null 2>&1; then
  sed -i '' "s#^NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS=.*#NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS=$SWAPPER_ADDRESS#g" "$ENV_FILE"
else
  echo "NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS=$SWAPPER_ADDRESS" >> "$ENV_FILE"
fi

echo "Deployment saved: $OUT_FILE"
echo "NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS=$SWAPPER_ADDRESS"
