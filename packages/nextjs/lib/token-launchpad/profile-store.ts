import 'server-only';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalAddress } from '~~/lib/starknet/address';
import { getTokenProfileRow, getTokenProfilesRows, upsertTokenProfile } from '~~/lib/storage/market-store';

export type TokenProfileRecord = {
  tokenAddress: string;
  imageCid: string;
  imageUrl: string;
  name: string;
  symbol: string;
  createdAt: string;
};

type TokenProfileStore = Record<string, TokenProfileRecord>;

const DEPLOY_DIR = path.join(process.cwd(), '.deploy');
const STORE_FILE = path.join(DEPLOY_DIR, 'token-profiles.json');

function normalizeAddress(address: string) {
  return canonicalAddress(address).toLowerCase();
}

async function readStore(): Promise<TokenProfileStore> {
  try {
    const content = await readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(content) as TokenProfileStore;
    return parsed ?? {};
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeStore(store: TokenProfileStore) {
  await mkdir(DEPLOY_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export async function saveTokenProfile(input: Omit<TokenProfileRecord, 'createdAt'>) {
  const key = normalizeAddress(input.tokenAddress);
  const createdAt = new Date().toISOString();
  const next = {
    ...input,
    tokenAddress: key,
    createdAt,
  };
  await upsertTokenProfile({
    token_address: key,
    image_cid: input.imageCid,
    image_url: input.imageUrl,
    name: input.name,
    symbol: input.symbol,
  });
  const store = await readStore();
  store[key] = next;
  await writeStore(store);
  return next;
}

export async function getTokenProfile(tokenAddress: string) {
  const row = await getTokenProfileRow(tokenAddress);
  if (row) {
    return {
      tokenAddress: row.token_address,
      imageCid: row.image_cid,
      imageUrl: row.image_url,
      name: row.name,
      symbol: row.symbol,
      createdAt: row.created_at,
    };
  }
  const store = await readStore();
  return store[normalizeAddress(tokenAddress)] ?? null;
}

export async function getTokenProfilesMap() {
  const rows = await getTokenProfilesRows();
  if (Object.keys(rows).length) {
    const mapped: TokenProfileStore = {};
    for (const [key, row] of Object.entries(rows)) {
      mapped[key] = {
        tokenAddress: row.token_address,
        imageCid: row.image_cid,
        imageUrl: row.image_url,
        name: row.name,
        symbol: row.symbol,
        createdAt: row.created_at,
      };
    }
    return mapped;
  }
  return readStore();
}
