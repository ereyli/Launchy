'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CopyButton } from '~~/components/copy-button';
import { TransactionFeedbackCard } from '~~/components/transaction-feedback-card';
import { uploadTokenLogo } from '~~/lib/pinata/client';
import { createAndLaunchMemecoin } from '~~/lib/token-launchpad/client';
import { env } from '~~/lib/config';
import { formatDecimalDots, formatIntegerDots, normalizeIntegerInput } from '~~/lib/format';
import { checksumAddress } from '~~/lib/starknet/address';

type DeployResult = {
  txHash: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  initialSupply: string;
  startingMarketCapUsd: string;
  estimatedOwnerBuyStrk: string;
};

export function TokenCreateForm() {
  const quickUsdCaps = [5000, 10000, 20000];
  const fallbackUsdRate = 0.04;

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [initialSupply, setInitialSupply] = useState('1000000');
  const [deployerAllocationPercent, setDeployerAllocationPercent] = useState(10);
  const [startingMarketCapUsd, setStartingMarketCapUsd] = useState('5000');
  const [strkUsdRate, setStrkUsdRate] = useState<number>(fallbackUsdRate);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadedLogoCid, setUploadedLogoCid] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');
  const [status, setStatus] = useState('');
  const [feedback, setFeedback] = useState<{ variant: 'pending' | 'success' | 'error'; title: string; description: string } | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      setUploadedLogoCid('');
      setLogoUploadError('');
      setIsUploadingLogo(false);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    let cancelled = false;
    async function uploadImmediately() {
      if (!logoFile) return;
      setIsUploadingLogo(true);
      setLogoUploadError('');
      try {
        const upload = await uploadTokenLogo({
          file: logoFile,
          name: name || logoFile.name || 'token',
          symbol: symbol || 'TOKEN',
        });
        if (!cancelled) {
          setUploadedLogoCid(upload.imageCid);
        }
      } catch (error) {
        if (!cancelled) {
          setUploadedLogoCid('');
          setLogoUploadError(error instanceof Error ? error.message : 'Logo upload failed.');
        }
      } finally {
        if (!cancelled) setIsUploadingLogo(false);
      }
    }
    void uploadImmediately();
    return () => {
      cancelled = true;
    };
  }, [logoFile, name, symbol]);

  useEffect(() => {
    let active = true;
    async function loadPrice() {
      try {
        const response = await fetch('/api/market/strk-usd', { cache: 'no-store' });
        if (!response.ok) throw new Error('Price API failed');
        const data = (await response.json()) as { priceUsd?: number };
        if (!active) return;
        if (typeof data.priceUsd === 'number' && Number.isFinite(data.priceUsd) && data.priceUsd > 0) {
          setStrkUsdRate(data.priceUsd);
          return;
        }
        throw new Error('Invalid price payload');
      } catch {
        if (!active) return;
        setStrkUsdRate(fallbackUsdRate);
      }
    }
    loadPrice();
    const timer = window.setInterval(loadPrice, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const lpPercent = useMemo(() => 100 - deployerAllocationPercent, [deployerAllocationPercent]);
  const startingMarketCapStrk = useMemo(() => {
    const usd = Number.parseFloat(startingMarketCapUsd || '0');
    const rate = strkUsdRate;
    if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rate) || rate <= 0) return '0';
    return (usd / rate).toFixed(6);
  }, [startingMarketCapUsd, strkUsdRate]);
  const estimatedQuoteStrk = useMemo(() => {
    const mcap = Number.parseFloat(startingMarketCapStrk || '0');
    if (!Number.isFinite(mcap) || mcap <= 0) return '0';
    return ((mcap * deployerAllocationPercent) / 100).toFixed(2);
  }, [startingMarketCapStrk, deployerAllocationPercent]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) {
      setStatus('Token factory is not configured. Set NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS.');
      return;
    }
    const usd = Number.parseFloat(startingMarketCapUsd || '0');
    const rate = strkUsdRate;
    if (!Number.isFinite(usd) || usd < 5000) {
      setStatus('Starting market cap must be at least $5,000.');
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setStatus('Could not load STRK price. Please try again.');
      return;
    }
    setIsDeploying(true);
    setStatus('Preparing launch transaction...');
    setFeedback(null);
    setDeployResult(null);
    try {
      if (logoFile && !uploadedLogoCid) {
        throw new Error(logoUploadError || 'Token logo is still uploading. Please wait a few seconds.');
      }

      setStatus('Submitting create + launch transaction...');
      const res = await createAndLaunchMemecoin({
        name,
        symbol,
        initialSupply,
        deployerAllocationPercent,
        startingMarketCapStrk,
        quoteToken: env.NEXT_PUBLIC_STRK_ADDRESS || '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
      });
      setStatus('Transaction submitted. Waiting for confirmation...');
      setFeedback({
        variant: 'pending',
        title: 'Token launch submitted',
        description: 'The token contract and launch transaction have been sent to the network. Waiting for confirmation.',
      });
      void res.confirmed.then(async (confirmed) => {
      if (uploadedLogoCid && confirmed.tokenAddress) {
        const profileRes = await fetch('/api/token/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress: confirmed.tokenAddress,
            txHash: confirmed.txHash,
            imageCid: uploadedLogoCid,
            name,
            symbol,
          }),
        });
        if (!profileRes.ok) {
          const payload = await profileRes.json().catch(() => ({}));
          throw new Error(payload?.error || 'Token logo saved to Pinata but profile link failed.');
        }
      } else if (uploadedLogoCid) {
        const profileRes = await fetch('/api/token/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: confirmed.txHash,
            imageCid: uploadedLogoCid,
            name,
            symbol,
          }),
        });
        if (!profileRes.ok) {
          const payload = await profileRes.json().catch(() => ({}));
          throw new Error(payload?.error || 'Token logo saved to Pinata but profile link failed.');
        }
      }

      {
        const launchMetaRes = await fetch('/api/token/launch-meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress: confirmed.tokenAddress,
            txHash: confirmed.txHash,
            startingMarketCapUsd,
          }),
        });
        if (!launchMetaRes.ok) {
          const payload = await launchMetaRes.json().catch(() => ({}));
          throw new Error(payload?.error || 'Launch metadata save failed.');
        }
      }
      setDeployResult({
        txHash: confirmed.txHash,
        tokenAddress: confirmed.tokenAddress,
        name,
        symbol,
        initialSupply,
        startingMarketCapUsd,
        estimatedOwnerBuyStrk: estimatedQuoteStrk,
      });
      setStatus('');
      setFeedback({
        variant: 'success',
        title: 'Token launch completed',
        description: 'The token has been deployed and the trade page is now ready.',
      });
      }).catch((error) => {
        setStatus(error instanceof Error ? error.message : 'Token confirmation failed');
        setFeedback({
          variant: 'error',
          title: 'Token launch failed',
          description: error instanceof Error ? error.message : 'Token confirmation failed',
        });
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown error');
      setFeedback({
        variant: 'error',
        title: 'Token launch could not start',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsDeploying(false);
    }
  }

  const tokenPath = deployResult?.tokenAddress ? `/token/${deployResult.tokenAddress}` : '/tokens';
  const tokenAddressLabel = deployResult?.tokenAddress
    ? checksumAddress(deployResult.tokenAddress)
    : 'Pending index';

  function dismissResult() {
    setDeployResult(null);
    setName('');
    setSymbol('');
    setInitialSupply('1000000');
    setDeployerAllocationPercent(10);
    setStartingMarketCapUsd('5000');
    setLogoFile(null);
    setUploadedLogoCid('');
    setLogoUploadError('');
    setIsUploadingLogo(false);
  }

  return (
    <>
      <form className="panel form-grid form-ultra" onSubmit={onSubmit}>
        <h2 className="card-title">Create + Launch Token</h2>
        <div className="token-logo-row">
          <label className="token-logo-label">
            Token logo (optional)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              disabled={isDeploying}
            />
          </label>
          <div className="token-logo-mini-preview">
            {logoPreview ? (
              <img src={logoPreview} alt="Token logo preview" />
            ) : (
              <span className="muted">No logo</span>
            )}
          </div>
        </div>
        {isUploadingLogo ? <small className="muted">Uploading logo to Pinata...</small> : null}
        {!isUploadingLogo && uploadedLogoCid ? <small className="muted">Logo uploaded.</small> : null}
        {logoUploadError ? <small className="wallet-error">{logoUploadError}</small> : null}
        <label>
          Token name
          <input value={name} onChange={(e) => setName(e.target.value)} required disabled={isDeploying} />
        </label>
        <label>
          Symbol
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} required disabled={isDeploying} />
        </label>
        <label>
          Initial supply
          <input
            value={formatIntegerDots(initialSupply)}
            onChange={(e) => setInitialSupply(normalizeIntegerInput(e.target.value))}
            inputMode="numeric"
            required
            disabled={isDeploying}
          />
        </label>
        <label>
          Deployer allocation (% max 10)
          <input
            type="number"
            min={0}
            max={10}
            step={0.01}
            value={deployerAllocationPercent}
            onChange={(e) => {
              const value = Number.parseFloat(e.target.value);
              if (!Number.isFinite(value)) {
                setDeployerAllocationPercent(0);
                return;
              }
              setDeployerAllocationPercent(Math.min(10, Math.max(0, value)));
            }}
            required
            disabled={isDeploying}
          />
        </label>
        <label>
          Starting market cap (USD)
          <div className="quick-cap-buttons" role="group" aria-label="Quick market cap presets">
            {quickUsdCaps.map((cap) => (
              <button
                type="button"
                key={cap}
                className={`ghost-button quick-cap-button ${Number.parseInt(startingMarketCapUsd || '0', 10) === cap ? 'quick-cap-button-active' : ''}`}
                onClick={() => setStartingMarketCapUsd(cap.toString())}
                disabled={isDeploying}
              >
                ${(cap / 1000).toFixed(0)}K
              </button>
            ))}
          </div>
          <input
            type="number"
            min={5000}
            step={100}
            value={startingMarketCapUsd}
            onChange={(e) => setStartingMarketCapUsd(e.target.value)}
            required
            disabled={isDeploying}
          />
        </label>
        <small className="muted">
          Min market cap: $5,000 · Converted: {formatDecimalDots(startingMarketCapStrk)} STRK
        </small>
        <small className="muted">
          Estimated owner buy amount: {formatDecimalDots(estimatedQuoteStrk)} STRK · LP: {lpPercent}%
        </small>
        <button type="submit" disabled={isDeploying}>
          {isDeploying ? 'Deploying...' : 'Create and Launch'}
        </button>
        {status ? <small className="muted">{status}</small> : null}
        <TransactionFeedbackCard
          open={Boolean(feedback)}
          variant={feedback?.variant || 'pending'}
          title={feedback?.title || ''}
          description={feedback?.description || ''}
        />
      </form>

      {isDeploying ? (
        <div className="deploy-loading-overlay" role="status" aria-live="polite">
          <div className="deploy-loading-modal">
            <h3>Deploy token</h3>
            <div className="deploy-spinner" />
            <p className="muted">{status || 'Transaction is being processed...'}</p>
          </div>
        </div>
      ) : null}

      {deployResult ? (
        <div className="deploy-result-overlay" onClick={(e) => { if (e.target === e.currentTarget) dismissResult(); }}>
          <div className="deploy-result-card">
            <button type="button" className="deploy-result-close" onClick={dismissResult} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="deploy-result-head">
              <span className="deploy-result-badge">Launch Completed</span>
              <h2 className="card-title">Token deployed on Mainnet</h2>
            </div>
            <div className="deploy-result-summary">
              <span className="badge">{deployResult.name}</span>
              <span className="badge">{deployResult.symbol}</span>
              <span className="badge">Supply {formatIntegerDots(deployResult.initialSupply)}</span>
              <span className="badge">MC ${formatDecimalDots(deployResult.startingMarketCapUsd, 0)}</span>
              <span className="badge">Owner buy {formatDecimalDots(deployResult.estimatedOwnerBuyStrk, 2)} STRK</span>
            </div>
            <div className="deploy-address-row">
              <span className="muted">Contract</span>
              <strong className="mono">{tokenAddressLabel}</strong>
              {deployResult.tokenAddress ? <CopyButton value={tokenAddressLabel} /> : null}
            </div>
            <div className="deploy-result-actions">
              <a href={tokenPath} className="deploy-result-link">
                <button type="button">Open Trade Page</button>
              </a>
              <button type="button" className="ghost-button" onClick={dismissResult}>
                Create another token
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
