import 'server-only';

import { env } from '~~/lib/config';

const PIN_FILE_ENDPOINT = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PIN_JSON_ENDPOINT = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

type PinataFileResponse = {
  IpfsHash: string;
};

type PinataJsonResponse = {
  IpfsHash: string;
};

function requirePinataJwt() {
  if (!env.PINATA_JWT && (!env.PINATA_API_KEY || !env.PINATA_API_SECRET)) {
    throw new Error('Pinata credentials are not configured.');
  }

  return env.PINATA_JWT;
}

function buildPinataAuthHeaders(): Record<string, string> {
  if (env.PINATA_JWT) {
    return {
      Authorization: `Bearer ${env.PINATA_JWT}`,
    };
  }

  if (!env.PINATA_API_KEY || !env.PINATA_API_SECRET) {
    throw new Error('Pinata API key/secret are missing.');
  }

  return {
    pinata_api_key: env.PINATA_API_KEY,
    pinata_secret_api_key: env.PINATA_API_SECRET,
  };
}

async function parseError(response: Response) {
  const text = await response.text();
  if (text.includes('NO_SCOPES_FOUND')) {
    return 'Pinata API key/JWT has no pinning scopes. Enable pinFile/pinJSON scopes on your Pinata key.';
  }
  return text || `Pinata request failed with status ${response.status}.`;
}

export async function pinFileToIpfs(file: File, metadataName: string) {
  requirePinataJwt();
  const body = new FormData();
  body.append('file', file);
  body.append('pinataMetadata', JSON.stringify({ name: metadataName }));

  const response = await fetch(PIN_FILE_ENDPOINT, {
    method: 'POST',
    headers: {
      ...buildPinataAuthHeaders(),
    },
    body,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = (await response.json()) as PinataFileResponse;
  return payload.IpfsHash;
}

export async function pinJsonToIpfs(payload: unknown, metadataName: string) {
  requirePinataJwt();

  const response = await fetch(PIN_JSON_ENDPOINT, {
    method: 'POST',
    headers: {
      ...buildPinataAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataMetadata: { name: metadataName },
      pinataContent: payload,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as PinataJsonResponse;
  return data.IpfsHash;
}

export function ipfsGatewayUrl(cid: string) {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
