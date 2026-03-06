import 'server-only';

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type PinataAliasRecord = {
  metadataCid: string;
  imageCid: string;
  name: string;
  symbol: string;
  description: string;
  createdAt: string;
};

type PinataAliasStore = Record<string, PinataAliasRecord>;

const DEPLOY_DIR = path.join(process.cwd(), '.deploy');
const STORE_FILE = path.join(DEPLOY_DIR, 'pinata-aliases.json');

function buildAlias() {
  return `p_${randomBytes(14).toString('hex')}`;
}

function tryParseStore(content: string): PinataAliasStore | null {
  try {
    const parsed = JSON.parse(content) as PinataAliasStore;
    return parsed ?? {};
  } catch {
    return null;
  }
}

function repairStoreContent(raw: string): PinataAliasStore | null {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const direct = tryParseStore(trimmed);
  if (direct) return direct;

  // Recover from common corruption such as trailing extra braces/chars.
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) return null;

  for (let end = lastBrace; end > firstBrace; end -= 1) {
    const candidate = trimmed.slice(firstBrace, end + 1);
    const parsed = tryParseStore(candidate);
    if (parsed) return parsed;
  }
  return null;
}

async function readStore(): Promise<PinataAliasStore> {
  try {
    const content = await readFile(STORE_FILE, 'utf8');
    const parsed = repairStoreContent(content);
    if (!parsed) {
      throw new Error('Pinata alias store is corrupted and could not be repaired.');
    }
    return parsed;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeStore(store: PinataAliasStore) {
  await mkdir(DEPLOY_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export async function savePinataAlias(data: Omit<PinataAliasRecord, 'createdAt'>) {
  const store = await readStore();
  const alias = buildAlias();
  store[alias] = {
    ...data,
    createdAt: new Date().toISOString(),
  };
  await writeStore(store);
  return alias;
}

export async function getPinataAlias(alias: string) {
  const store = await readStore();
  return store[alias] ?? null;
}
