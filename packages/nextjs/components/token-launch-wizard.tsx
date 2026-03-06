'use client';

import { FormEvent, useMemo, useState } from 'react';
import { launchOnEkubo } from '~~/lib/token-launchpad/client';

type Props = {
  tokenAddress: string;
  strkAddress: string;
};

type Step = 1 | 2;

const DEFAULT_EKUBO_FEE = '1020847100762815390390123822295304634';
const DEFAULT_TICK_SPACING = '5982';
const DEFAULT_START_PRICE_MAG = '1000000';
const DEFAULT_START_PRICE_IS_NEGATIVE = false;
const DEFAULT_BOUND = '88712960';

export function TokenLaunchWizard({ tokenAddress, strkAddress }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [status, setStatus] = useState('');
  const [creatorAllocationPercent, setCreatorAllocationPercent] = useState(10);
  const maxBuyPercent = 10;
  const [txHash, setTxHash] = useState('');

  const lpPercent = 100 - creatorAllocationPercent;
  const maxBuyBps = maxBuyPercent * 100;

  const summary = useMemo(() => {
    return {
      creatorAllocationPercent,
      lpPercent,
      maxBuyPercent,
    };
  }, [creatorAllocationPercent, lpPercent, maxBuyPercent]);

  async function submitLaunch(e: FormEvent) {
    e.preventDefault();
    setStatus('Submitting launch transaction...');
    setTxHash('');
    try {
      const res = await launchOnEkubo({
        tokenAddress,
        quoteToken: strkAddress,
        quoteAmountStrk: '0',
        lpPercent,
        maxBuyBps,
        fee: DEFAULT_EKUBO_FEE,
        tickSpacing: DEFAULT_TICK_SPACING,
        startPriceMag: DEFAULT_START_PRICE_MAG,
        startPriceIsNegative: DEFAULT_START_PRICE_IS_NEGATIVE,
        bound: DEFAULT_BOUND,
      });
      setTxHash(res.txHash);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  return (
    <form className="panel form-grid form-ultra" onSubmit={submitLaunch}>
      <h3 className="card-title">Launch Token</h3>

      <div className="badges">
        <span className="badge">Step {step} / 2</span>
        <span className="badge">DEX: Ekubo</span>
      </div>

      {step === 1 ? (
        <div className="form-grid">
          <label>
            Deployer allocation (%)
            <input
              type="number"
              min={0}
              max={10}
              step={0.01}
              value={creatorAllocationPercent}
              onChange={(e) => {
                const value = Number.parseFloat(e.target.value);
                setCreatorAllocationPercent(Number.isFinite(value) ? Math.min(10, Math.max(0, value)) : 0);
              }}
            />
          </label>
          <small className="muted">System automatically uses the remaining {lpPercent}% for initial LP.</small>
          <button type="button" onClick={() => setStep(2)}>Next</button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="form-grid">
          <div className="stats">
            <article className="stat">
              <span className="muted">Creator allocation</span>
              <strong>{summary.creatorAllocationPercent}%</strong>
            </article>
            <article className="stat">
              <span className="muted">LP allocation</span>
              <strong>{summary.lpPercent}%</strong>
            </article>
            <article className="stat">
              <span className="muted">Max first buy</span>
              <strong>{summary.maxBuyPercent}%</strong>
            </article>
          </div>
          <div className="hero-actions">
            <button type="button" className="ghost-button" onClick={() => setStep(1)}>Back</button>
            <button type="submit">Launch on Ekubo</button>
          </div>
        </div>
      ) : null}

      {status ? <small className="muted">{status}</small> : null}
      {txHash ? (
        <div className="form-grid">
          <small className="muted">Launch transaction sent successfully.</small>
          <a href={`https://voyager.online/tx/${txHash}`} target="_blank" rel="noreferrer">
            <button type="button" className="ghost-button">View launch tx</button>
          </a>
        </div>
      ) : null}
    </form>
  );
}
