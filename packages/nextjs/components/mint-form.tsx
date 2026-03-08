'use client';

import { FormEvent, useMemo, useState } from 'react';
import { TransactionFeedbackCard } from '~~/components/transaction-feedback-card';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import { mintCollection } from '~~/lib/launchpad/client';

export function MintForm({
  collectionAddress,
  mintFeeStrk,
  mintPriceStrk,
  isFreeMintModel,
  maxPerWallet,
}: {
  collectionAddress: string;
  mintFeeStrk: string;
  mintPriceStrk: string;
  isFreeMintModel: boolean;
  maxPerWallet: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('');
  const [feedback, setFeedback] = useState<{ variant: 'pending' | 'success' | 'error'; title: string; description: string } | null>(null);

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
    setFeedback(null);

    try {
      const res = await mintCollection(collectionAddress, quantity);
      setStatus('Transaction submitted. Waiting for confirmation...');
      setFeedback({
        variant: 'pending',
        title: 'Mint submitted',
        description: `${quantity} NFT mint request has been sent to the network. Waiting for confirmation.`,
      });
      void res.confirmed
        .then(() => {
          setStatus(`Success. Tx: ${res.txHash}`);
          setFeedback({
            variant: 'success',
            title: 'Mint successful',
            description: `${quantity} NFT${quantity > 1 ? 's were' : ' was'} minted successfully.`,
          });
        })
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : 'Mint confirmation failed');
          setFeedback({
            variant: 'error',
            title: 'Mint failed',
            description: error instanceof Error ? error.message : 'Mint confirmation failed',
          });
        });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown error');
      setFeedback({
        variant: 'error',
        title: 'Mint could not start',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
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
          max={maxPerWallet > 0 ? maxPerWallet : undefined}
          value={quantity}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            const normalized = Number.isFinite(next) && next > 0 ? next : 1;
            setQuantity(maxPerWallet > 0 ? Math.min(normalized, maxPerWallet) : normalized);
          }}
        />
      </label>

      <div className="mint-limit-note muted">
        {maxPerWallet > 0
          ? `Per wallet limit: ${formatIntegerDots(maxPerWallet)} NFT${maxPerWallet > 1 ? 's' : ''}`
          : 'Per wallet limit: Unlimited'}
      </div>

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
      <TransactionFeedbackCard
        open={Boolean(feedback)}
        variant={feedback?.variant || 'pending'}
        title={feedback?.title || ''}
        description={feedback?.description || ''}
      />
    </form>
  );
}
