const DEFAULT_RPC = 'https://starknet-mainnet-rpc.publicnode.com';

export const CLIENT_RPC_PROXY_PATH = '/api/rpc';

export function getServerRpcUrl() {
  return process.env.STARKNET_RPC_URL || DEFAULT_RPC;
}
