import { NextResponse } from 'next/server';
import { fetchLaunchpadMeta } from '~~/lib/launchpad/collections';
import { env } from '~~/lib/config';

export const revalidate = 120;

export async function GET() {
  let deployFeeStrk = '0';
  let mintFeeStrk = '0';

  if (env.NEXT_PUBLIC_FACTORY_ADDRESS) {
    try {
      const data = await fetchLaunchpadMeta();
      deployFeeStrk = data.deployFeeStrk;
      mintFeeStrk = data.mintFeeStrk;
    } catch {
      // fallback values are fine for UI shell
    }
  }

  return NextResponse.json({
    deployFeeStrk,
    mintFeeStrk,
    nftFactoryConfigured: Boolean(env.NEXT_PUBLIC_FACTORY_ADDRESS),
    tokenFactoryConfigured: Boolean(env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS),
  });
}
