#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CAIRO_DIR="$ROOT_DIR/packages/cairo"
DEPLOY_DIR="$ROOT_DIR/.deploy/mainnet"

RPC_URL="${RPC_URL:-https://starknet-mainnet-rpc.publicnode.com}"
EKUBO_CORE_ADDRESS="${EKUBO_CORE_ADDRESS:-0x00000005dd3d2f4429af886cd1a3b08289dbcea99a294197e9eb43b0e0325b4b}"
EKUBO_POSITIONS_ADDRESS="${EKUBO_POSITIONS_ADDRESS:-0x02e0af29598b407c8716b17f6d2795eca1b471413fa03fb145a5e33722184067}"
STRK_ADDRESS="${STRK_ADDRESS:-0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d}"

ACCOUNT_FILE="$DEPLOY_DIR/deployer.account.json"
KEYSTORE_FILE="$DEPLOY_DIR/deployer.keystore.json"
PASSWORD_FILE="$DEPLOY_DIR/deployer.password"
ADDRESS_FILE="$DEPLOY_DIR/deployer.address"
OUT_FILE="$DEPLOY_DIR/token_deployment.json"

MEMECOIN_ARTIFACT="$CAIRO_DIR/target/dev/launchpad_cairo_TokenMemecoin.contract_class.json"
FACTORY_ARTIFACT="$CAIRO_DIR/target/dev/launchpad_cairo_TokenFactory.contract_class.json"

if [[ ! -f "$ACCOUNT_FILE" || ! -f "$KEYSTORE_FILE" || ! -f "$PASSWORD_FILE" || ! -f "$ADDRESS_FILE" ]]; then
  echo "Missing deployer files under $DEPLOY_DIR"
  exit 1
fi

if [[ ! -f "$MEMECOIN_ARTIFACT" || ! -f "$FACTORY_ARTIFACT" ]]; then
  echo "Token artifacts missing. Building..."
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

echo "RPC: $RPC_URL"
echo "Admin: $ADMIN_ADDRESS"
echo "Treasury:        $ADMIN_ADDRESS"
echo "Platform token:  $STRK_ADDRESS"
echo "Ekubo core:      $EKUBO_CORE_ADDRESS"
echo "Ekubo positions: $EKUBO_POSITIONS_ADDRESS"

MEMECOIN_CLASS_HASH="$(starkli class-hash "$MEMECOIN_ARTIFACT")"
FACTORY_CLASS_HASH="$(starkli class-hash "$FACTORY_ARTIFACT")"

echo "Memecoin class hash: $MEMECOIN_CLASS_HASH"
echo "Factory class hash:  $FACTORY_CLASS_HASH"

declare_with_fallback "$MEMECOIN_ARTIFACT" "$MEMECOIN_CLASS_HASH" "TokenMemecoin"
declare_with_fallback "$FACTORY_ARTIFACT" "$FACTORY_CLASS_HASH" "TokenFactory"

DEPLOY_OUTPUT="$(
  starkli deploy "$FACTORY_CLASS_HASH" \
    "$ADMIN_ADDRESS" \
    "$ADMIN_ADDRESS" \
    "$STRK_ADDRESS" \
    "$MEMECOIN_CLASS_HASH" \
    "$EKUBO_CORE_ADDRESS" \
    "$EKUBO_POSITIONS_ADDRESS" \
    --rpc "$RPC_URL" \
    --account "$ACCOUNT_FILE" \
    --keystore "$KEYSTORE_FILE" \
    --keystore-password "$PASS" \
    --watch
)"
echo "$DEPLOY_OUTPUT"

FACTORY_ADDRESS="$(
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

if [[ -z "$FACTORY_ADDRESS" ]]; then
  echo "Failed parsing token factory address."
  exit 1
fi

jq -n \
  --arg network "mainnet" \
  --arg rpc "$RPC_URL" \
  --arg admin "$ADMIN_ADDRESS" \
  --arg memecoin_class_hash "$MEMECOIN_CLASS_HASH" \
  --arg treasury "$ADMIN_ADDRESS" \
  --arg platform_fee_token "$STRK_ADDRESS" \
  --arg factory_class_hash "$FACTORY_CLASS_HASH" \
  --arg factory_address "$FACTORY_ADDRESS" \
  --arg deploy_tx_hash "$DEPLOY_TX_HASH" \
  --arg ekubo_core "$EKUBO_CORE_ADDRESS" \
  --arg ekubo_positions "$EKUBO_POSITIONS_ADDRESS" \
  '{
    network: $network,
    rpc: $rpc,
    admin: $admin,
    treasury: $treasury,
    platform_fee_token: $platform_fee_token,
    memecoin_class_hash: $memecoin_class_hash,
    factory_class_hash: $factory_class_hash,
    factory_address: $factory_address,
    factory_deploy_tx_hash: $deploy_tx_hash,
    ekubo_core: $ekubo_core,
    ekubo_positions: $ekubo_positions
  }' > "$OUT_FILE"

ENV_FILE="$ROOT_DIR/packages/nextjs/.env.local"
touch "$ENV_FILE"
if rg -n "^NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=" "$ENV_FILE" >/dev/null 2>&1; then
  sed -i '' "s#^NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=.*#NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=$FACTORY_ADDRESS#g" "$ENV_FILE"
else
  echo "NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=$FACTORY_ADDRESS" >> "$ENV_FILE"
fi

echo "Token deployment saved: $OUT_FILE"
echo "NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=$FACTORY_ADDRESS"
