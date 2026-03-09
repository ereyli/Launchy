import { NextResponse } from 'next/server';
import { pinFileToIpfs, pinJsonToIpfs, ipfsGatewayUrl } from '~~/lib/pinata/server';
import {
  assertImageUpload,
  assertRateLimit,
  assertReasonableTokenText,
  assertSameOrigin,
  RouteGuardError,
} from '~~/lib/server/mutation-guard';

function asString(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertRateLimit(request, { key: 'pinata-upload', limit: 8, windowMs: 10 * 60 * 1000 });

    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const name = asString(formData.get('name'));
    const symbol = asString(formData.get('symbol'));
    const description = asString(formData.get('description'));
    const file = fileEntry as File;

    assertImageUpload(file, 4 * 1024 * 1024);
    assertReasonableTokenText(name, 'Name', 80);
    assertReasonableTokenText(symbol, 'Symbol', 20);
    if (description.length > 500) {
      return NextResponse.json({ error: 'Description is too long.' }, { status: 400 });
    }

    const imageCid = await pinFileToIpfs(file, `${name}-image`);
    const imageGateway = ipfsGatewayUrl(imageCid);
    const tokenMetadata = {
      name,
      symbol,
      description: description || `${name} collection metadata`,
      image: imageGateway,
      image_ipfs: `ipfs://${imageCid}`,
      external_url: imageGateway,
      collection: {
        name,
        family: symbol,
      },
      attributes: [
        { trait_type: 'Collection', value: name },
        { trait_type: 'Symbol', value: symbol },
      ],
    };
    const collectionMetadata = {
      name,
      symbol,
      description: description || `${name} collection`,
      image: imageGateway,
      banner_image: imageGateway,
      featured_image: imageGateway,
      external_link: imageGateway,
      seller_fee_basis_points: 0,
      fee_recipient: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };
    const metadataCid = await pinJsonToIpfs(tokenMetadata, `${name}-token-metadata`);
    const collectionMetadataCid = await pinJsonToIpfs(collectionMetadata, `${name}-collection-metadata`);

    // Serverless environments cannot rely on local alias-store persistence.
    // The collection contract already stores direct metadata/contract URIs, so
    // base_uri can safely use the token metadata IPFS URI as a stable value.
    const baseUriAlias = `ipfs://${metadataCid}`;

    return NextResponse.json({
      ok: true,
      baseUriAlias,
      imageCid,
      metadataCid,
      collectionMetadataCid,
      imageGatewayUrl: imageGateway,
      metadataGatewayUrl: ipfsGatewayUrl(metadataCid),
      collectionMetadataGatewayUrl: ipfsGatewayUrl(collectionMetadataCid),
      metadataIpfsUri: `ipfs://${metadataCid}`,
      collectionMetadataIpfsUri: `ipfs://${collectionMetadataCid}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Pinata upload failed.',
      },
      { status: error instanceof RouteGuardError ? error.status : 500 },
    );
  }
}
