'use client';

export type PinataUploadInput = {
  file: File;
  name: string;
  symbol: string;
  description?: string;
};

export type PinataUploadResult = {
  ok: true;
  baseUriAlias: string;
  imageCid: string;
  metadataCid: string;
  collectionMetadataCid: string;
  imageGatewayUrl: string;
  metadataGatewayUrl: string;
  collectionMetadataGatewayUrl: string;
  metadataIpfsUri: string;
  collectionMetadataIpfsUri: string;
};

export async function uploadCollectionAssets(input: PinataUploadInput) {
  const body = new FormData();
  body.append('file', input.file);
  body.append('name', input.name);
  body.append('symbol', input.symbol);
  body.append('description', input.description ?? '');

  const response = await fetch('/api/pinata/upload', {
    method: 'POST',
    body,
  });

  const payload = (await response.json()) as PinataUploadResult | { error?: string };

  if (!response.ok) {
    throw new Error(payload && 'error' in payload ? payload.error || 'Pinata upload failed.' : 'Pinata upload failed.');
  }

  if (!('ok' in payload) || !payload.ok) {
    throw new Error('Pinata upload returned invalid response.');
  }

  return payload;
}

export type TokenLogoUploadResult = {
  ok: true;
  imageCid: string;
  imageGatewayUrl: string;
};

export async function uploadTokenLogo(input: { file: File; name: string; symbol: string }) {
  const body = new FormData();
  body.append('file', input.file);
  body.append('name', input.name);
  body.append('symbol', input.symbol);

  const response = await fetch('/api/pinata/upload-token-logo', {
    method: 'POST',
    body,
  });

  const payload = (await response.json()) as TokenLogoUploadResult | { error?: string };
  if (!response.ok) {
    throw new Error(payload && 'error' in payload ? payload.error || 'Token logo upload failed.' : 'Token logo upload failed.');
  }
  if (!('ok' in payload) || !payload.ok) {
    throw new Error('Token logo upload returned invalid response.');
  }
  return payload;
}
