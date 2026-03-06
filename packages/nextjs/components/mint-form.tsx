'use client';

import { FormEvent, useMemo, useState } from 'react';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import { mintCollection } from '~~/lib/launchpad/client';

export function MintForm({
  collectionAddress,
  mintFeeStrk,
  mintPriceStrk,
  isFreeMintModel,
}: {
  collectionAddress: string;
  mintFeeStrk: string;
  mintPriceStrk: string;
  isFreeMintModel: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('');

  const mintFee = Number.parseFloat(mintFeeStrk || '0');
  const mintPrice = Number.parseFloat(mintPriceStrk || '0');
  const platformFeeEstimate = useMemo(
    () => (Number.isFinite(mintFee) ? mintFee * quantity : 0),
    [mintFee, quantity],
  );
  const collectionMintEstimate = useMemo(
    () => (isFreeMintModel || !Number.isFinite(mintPrice) ? 0 : mintPrice * quantity),
    [isFreeMintModel, mintPrice, quantity],
  );
  const totalEstimate = platformFeeEstimate + collectionMintEstimate;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('Submitting mint transaction...');

    try {
      const res = await mintCollection(collectionAddress, quantity);
      setStatus(`Success. Tx: ${res.txHash}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  return (
    <form className="panel form-grid form-ultra mint-form-ultra" onSubmit={onSubmit}>
      <h3 className="card-title">Mint now</h3>
      <label>
        Quantity
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            setQuantity(Number.isFinite(next) && next > 0 ? next : 1);
          }}
        />
      </label>

      <div className="mint-mini-grid">
        <div className="stat mint-mini-stat">
          <span className="muted">Platform fee</span>
          <strong>{formatDecimalDots(platformFeeEstimate.toFixed(2))} STRK</strong>
          <span className="muted">{formatDecimalDots(mintFeeStrk)} x {formatIntegerDots(quantity)}</span>
        </div>
        <div className="stat mint-mini-stat">
          <span className="muted">Collection price</span>
          <strong>{formatDecimalDots(collectionMintEstimate.toFixed(2))} STRK</strong>
          <span className="muted">
            {isFreeMintModel ? 'Free model: 0 STRK' : `${formatDecimalDots(mintPriceStrk)} STRK x ${formatIntegerDots(quantity)}`}
          </span>
        </div>
        <div className="stat mint-total-stat">
          <span className="muted">You pay</span>
          <strong>{formatDecimalDots(totalEstimate.toFixed(2))} STRK</strong>
          <span className="muted">Platform + collection fee</span>
        </div>
      </div>

      <button type="submit">Mint NFT</button>
      {status ? <small className="muted">{status}</small> : null}
    </form>
  );
}
