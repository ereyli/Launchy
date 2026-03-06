'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CopyButton } from '~~/components/copy-button';
import { TransactionFeedbackCard } from '~~/components/transaction-feedback-card';
import { env } from '~~/lib/config';
import { formatDecimalDots, formatIntegerDots, normalizeIntegerInput } from '~~/lib/format';
import { createCollection } from '~~/lib/launchpad/client';
import { type PinataUploadResult, uploadCollectionAssets } from '~~/lib/pinata/client';
import { checksumAddress } from '~~/lib/starknet/address';

type State = {
  name: string;
  symbol: string;
  maxSupply: string;
  maxPerWallet: string;
  unlimitedPerWallet: boolean;
  mintPrice: string;
  isFreeMintModel: boolean;
  description: string;
  imageFile: File | null;
};

type DeployResult = {
  txHash: string;
  collectionAddress: string;
};

const initialState: State = {
  name: '',
  symbol: '',
  maxSupply: '1000',
  maxPerWallet: '1',
  unlimitedPerWallet: true,
  mintPrice: '0',
  isFreeMintModel: true,
  description: '',
  imageFile: null,
};

export function CreateForm({ deployFeeStrk, mintFeeStrk }: { deployFeeStrk: string; mintFeeStrk: string }) {
  const [state, setState] = useState<State>(initialState);
  const [status, setStatus] = useState<string>('');
  const [feedback, setFeedback] = useState<{ variant: 'pending' | 'success' | 'error'; title: string; description: string } | null>(null);
  const [uploadedImage, setUploadedImage] = useState<PinataUploadResult | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);

  useEffect(() => {
    if (!state.imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(state.imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [state.imageFile]);

  useEffect(() => {
    let cancelled = false;
    async function uploadImmediately() {
      if (!state.imageFile) {
        setUploadedImage(null);
        setImageUploadError('');
        setIsUploadingImage(false);
        return;
      }
      setIsUploadingImage(true);
      setImageUploadError('');
      try {
        const upload = await uploadCollectionAssets({
          file: state.imageFile,
          name: state.name || state.imageFile.name || 'collection',
          symbol: state.symbol || 'NFT',
          description: state.description,
        });
        if (!cancelled) setUploadedImage(upload);
      } catch (error) {
        if (!cancelled) {
          setUploadedImage(null);
          setImageUploadError(error instanceof Error ? error.message : 'Artwork upload failed.');
        }
      } finally {
        if (!cancelled) setIsUploadingImage(false);
      }
    }
    void uploadImmediately();
    return () => {
      cancelled = true;
    };
  }, [state.imageFile, state.name, state.symbol, state.description]);

  const summary = useMemo(() => {
    const price = Number.parseFloat(state.mintPrice || '0');
    return {
      deployFee: deployFeeStrk,
      mintFee: mintFeeStrk,
      creatorMintRevenue: state.isFreeMintModel ? '0' : Number.isFinite(price) ? state.mintPrice : '0',
    };
  }, [deployFeeStrk, mintFeeStrk, state.isFreeMintModel, state.mintPrice]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsDeploying(true);
    setFeedback(null);

    try {
      if (!env.NEXT_PUBLIC_FACTORY_ADDRESS) {
        throw new Error('NFT factory is not configured. Set NEXT_PUBLIC_FACTORY_ADDRESS.');
      }
      if (!state.imageFile) {
        throw new Error('Collection image is required.');
      }
      if (isUploadingImage || !uploadedImage) {
        throw new Error(imageUploadError || 'Collection image is still uploading. Please wait a few seconds.');
      }
      const baseUri = uploadedImage.baseUriAlias;
      const maxSupply = Number.parseInt(state.maxSupply, 10);
      if (!Number.isFinite(maxSupply) || maxSupply <= 0) {
        throw new Error('Max supply must be greater than zero.');
      }
      const maxPerWallet = state.unlimitedPerWallet ? 0 : Number.parseInt(state.maxPerWallet || '0', 10);
      if (!state.unlimitedPerWallet && (!Number.isFinite(maxPerWallet) || maxPerWallet <= 0)) {
        throw new Error('Max mint per wallet must be greater than zero, or choose unlimited.');
      }

      setStatus('Submitting deploy transaction...');
      const res = await createCollection({
        name: state.name,
        symbol: state.symbol,
        maxSupply,
        maxPerWallet,
        mintPrice: state.mintPrice,
        isFreeMintModel: state.isFreeMintModel,
        baseUri,
        metadataUri: uploadedImage.metadataIpfsUri,
        contractMetadataUri: uploadedImage.collectionMetadataIpfsUri,
      });
      setStatus('Transaction submitted. Waiting for confirmation...');
      setFeedback({
        variant: 'pending',
        title: 'Deployment submitted',
        description: 'The NFT contract has been sent to the network. The collection address will be prepared after confirmation.',
      });
      void res.confirmed
        .then(async (confirmed) => {
          if (!confirmed.collectionAddress) {
            throw new Error('Transaction confirmed but collection address was not indexed yet. Check dashboard after a few seconds.');
          }
          const metaRes = await fetch('/api/nft/collection-meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collectionAddress: confirmed.collectionAddress,
            txHash: confirmed.txHash,
            name: state.name,
            symbol: state.symbol,
            model: state.isFreeMintModel ? 'free' : 'paid',
            mintPriceStrk: state.isFreeMintModel ? '0' : state.mintPrice,
            maxSupply,
            baseUri,
            imageUrl: uploadedImage.imageGatewayUrl,
          }),
        });
          if (!metaRes.ok) {
            const payload = await metaRes.json().catch(() => ({}));
            throw new Error(payload?.error || 'Collection metadata save failed.');
          }
          setDeployResult({
            txHash: confirmed.txHash,
            collectionAddress: confirmed.collectionAddress,
          });
          setStatus('');
          setFeedback({
            variant: 'success',
            title: 'NFT deployed',
            description: 'The collection is live and the mint page is ready to use.',
          });
        })
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : 'Collection confirmation failed.');
          setFeedback({
            variant: 'error',
            title: 'NFT deployment failed',
            description: error instanceof Error ? error.message : 'Collection confirmation failed.',
          });
        });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown error');
      setFeedback({
        variant: 'error',
        title: 'NFT deployment could not start',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsDeploying(false);
    }
  }

  if (deployResult) {
    const mintPagePath = `/collection/${deployResult.collectionAddress}`;
    const mintLink = typeof window !== 'undefined' ? `${window.location.origin}${mintPagePath}` : mintPagePath;
    const collectionAddressLabel = checksumAddress(deployResult.collectionAddress);

    return (
      <div className="deploy-result-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeployResult(null); }}>
        <div className="deploy-result-card">
          <button type="button" className="deploy-result-close" onClick={() => setDeployResult(null)} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="deploy-result-head">
            <span className="deploy-result-badge">Launch Completed</span>
            <h2 className="card-title">NFT collection deployed on Mainnet</h2>
          </div>
          <div className="deploy-result-summary">
            <span className="badge">{state.name}</span>
            <span className="badge">{state.symbol}</span>
            <span className="badge">Supply {formatIntegerDots(state.maxSupply)}</span>
            <span className="badge">{state.isFreeMintModel ? 'Free mint' : `Mint ${formatDecimalDots(state.mintPrice)} STRK`}</span>
          </div>
          <div className="deploy-address-row">
            <span className="muted">Contract</span>
            <strong className="mono">{collectionAddressLabel}</strong>
            <CopyButton value={collectionAddressLabel} />
          </div>
          <div className="deploy-address-row">
            <span className="muted">Mint link</span>
            <strong className="mono">{mintPagePath}</strong>
            <CopyButton value={mintLink} />
          </div>
          <div className="deploy-result-actions">
            <a href={mintPagePath} className="deploy-result-link">
              <button type="button">Open Mint Page</button>
            </a>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setDeployResult(null);
                setStatus('');
                setUploadedImage(null);
                setImageUploadError('');
                setIsUploadingImage(false);
                setState(initialState);
              }}
            >
              Create another collection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-2">
      <form className="panel form-grid form-ultra" onSubmit={onSubmit}>
        <h2 className="card-title">Create collection</h2>

        <div className="row-2">
          <label>
            Collection name
            <input
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              disabled={isDeploying}
              required
            />
          </label>

          <label>
            Symbol
            <input
              value={state.symbol}
              onChange={(e) => setState((s) => ({ ...s, symbol: e.target.value }))}
              disabled={isDeploying}
              required
            />
          </label>
        </div>

        <div className="row-2">
          <label>
            Max supply
            <input
              value={formatIntegerDots(state.maxSupply)}
              onChange={(e) => setState((s) => ({ ...s, maxSupply: normalizeIntegerInput(e.target.value) }))}
              disabled={isDeploying}
              inputMode="numeric"
              required
            />
          </label>

          <label>
            Mint model
            <select
              value={state.isFreeMintModel ? 'free' : 'paid'}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  isFreeMintModel: e.target.value === 'free',
                  mintPrice: e.target.value === 'free' ? '0' : s.mintPrice,
                }))
              }
              disabled={isDeploying}
            >
              <option value="free">Free mint</option>
              <option value="paid">Paid mint</option>
            </select>
          </label>
        </div>

        <div className="row-2">
          <label>
            Per wallet mint
            <select
              value={state.unlimitedPerWallet ? 'unlimited' : 'limited'}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  unlimitedPerWallet: e.target.value === 'unlimited',
                }))
              }
              disabled={isDeploying}
            >
              <option value="unlimited">Unlimited</option>
              <option value="limited">Limited</option>
            </select>
          </label>

          {!state.unlimitedPerWallet ? (
            <label>
              Max mint per wallet
              <input
                value={formatIntegerDots(state.maxPerWallet)}
                onChange={(e) => setState((s) => ({ ...s, maxPerWallet: normalizeIntegerInput(e.target.value) }))}
                disabled={isDeploying}
                inputMode="numeric"
                required
              />
            </label>
          ) : (
            <div />
          )}
        </div>

        {!state.isFreeMintModel ? (
          <label>
            Mint price (STRK)
            <input
              value={state.mintPrice}
              onChange={(e) => setState((s) => ({ ...s, mintPrice: e.target.value }))}
              disabled={isDeploying}
            />
          </label>
        ) : null}

        <label>
          Collection image
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setState((s) => ({ ...s, imageFile: e.target.files?.[0] ?? null }))}
            disabled={isDeploying}
            required
          />
        </label>

        <label>
          Description
          <textarea
            rows={3}
            value={state.description}
            onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
            placeholder="Tell your story in one line"
            disabled={isDeploying}
          />
        </label>

        {previewUrl ? (
          <div className="upload-preview">
            <img src={previewUrl} alt="Uploaded artwork preview" className="upload-preview-image" />
            <div className="upload-preview-meta">
              <strong>{state.imageFile?.name}</strong>
              <span className="muted">
                {state.imageFile ? `${(state.imageFile.size / 1024 / 1024).toFixed(2)} MB` : ''}
              </span>
              {isUploadingImage ? <span className="muted">Uploading artwork to Pinata...</span> : null}
              {!isUploadingImage && uploadedImage ? <span className="muted">Artwork uploaded and ready for deploy.</span> : null}
              {imageUploadError ? <span className="wallet-error">{imageUploadError}</span> : null}
            </div>
          </div>
        ) : null}

        <button type="submit" disabled={isDeploying}>
          {isDeploying ? 'Deploying...' : 'Deploy collection'}
        </button>
        {status ? <small className="muted">{status}</small> : null}
        <TransactionFeedbackCard
          open={Boolean(feedback)}
          variant={feedback?.variant || 'pending'}
          title={feedback?.title || ''}
          description={feedback?.description || ''}
        />
      </form>

      <aside className="panel card-soft form-ultra">
        <h3 className="card-title">Fee summary</h3>
        <div className="stats">
          <div className="stat">
            <span className="muted">Deploy fee</span>
            <strong>{formatDecimalDots(summary.deployFee)} STRK</strong>
          </div>
          <div className="stat">
            <span className="muted">Mint fee</span>
            <strong>{formatDecimalDots(summary.mintFee)} STRK</strong>
          </div>
          <div className="stat">
            <span className="muted">Creator revenue</span>
            <strong>{formatDecimalDots(summary.creatorMintRevenue)} STRK</strong>
          </div>
        </div>
      </aside>

      {isDeploying ? (
        <div className="deploy-loading-overlay" role="status" aria-live="polite">
          <div className="deploy-loading-modal">
            <h3>Deploy NFT collection</h3>
            <div className="deploy-spinner" />
            <p className="muted">{status || 'Transaction is being processed...'}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
