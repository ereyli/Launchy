import { NextResponse } from 'next/server';
import { getPinataAlias } from '~~/lib/pinata/alias-store';
import { ipfsGatewayUrl } from '~~/lib/pinata/server';

export async function GET(_: Request, { params }: { params: Promise<{ alias: string }> }) {
  const { alias } = await params;
  const record = await getPinataAlias(alias);

  if (!record) {
    return NextResponse.json({ error: 'Alias not found.' }, { status: 404 });
  }

  return NextResponse.json({
    alias,
    ...record,
    imageGatewayUrl: ipfsGatewayUrl(record.imageCid),
    metadataGatewayUrl: ipfsGatewayUrl(record.metadataCid),
    metadataIpfsUri: `ipfs://${record.metadataCid}`,
  });
}
