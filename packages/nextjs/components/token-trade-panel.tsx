'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { TransactionFeedbackCard } from '~~/components/transaction-feedback-card';
import { executeEkuboTrade, quoteEkuboTrade, readTokenBalance, type EkuboQuoteResult, type PoolKeyInput } from '~~/lib/trade/ekubo';
import { formatDecimalDots } from '~~/lib/format';
import { getWalletSessionSnapshot, subscribeWalletSession } from '~~/lib/starknet/wallet-session';

type Side = 'buy' | 'sell';
type AssetSide = 'quote' | 'token';
type UiQuote = EkuboQuoteResult & {
  outputAmountUi: string;
  minReceivedUi: string;
  platformFeeUi: string;
};

type Props = {
  tokenAddress: string;
  quoteTokenAddress: string;
  quoteTokenSymbol?: string;
  tokenSymbol?: string;
  defaultSide?: Side;
  poolKey?: PoolKeyInput;
};

export function TokenTradePanel({
  tokenAddress,
  quoteTokenAddress,
  quoteTokenSymbol = 'STRK',
  tokenSymbol = 'TOKEN',
  defaultSide = 'buy',
  poolKey,
}: Props) {
  const wallet = useSyncExternalStore(
    subscribeWalletSession,
    getWalletSessionSnapshot,
    getWalletSessionSnapshot,
  );
  const [fromAsset, setFromAsset] = useState<AssetSide>(defaultSide === 'sell' ? 'token' : 'quote');
  const [amount, setAmount] = useState('1');
  const [slippage, setSlippage] = useState(1);
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quote, setQuote] = useState<UiQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [fromBalance, setFromBalance] = useState('0');
  const [toBalance, setToBalance] = useState('0');
  const [feedback, setFeedback] = useState<{ variant: 'pending' | 'success' | 'error'; title: string; description: string } | null>(null);

  const side: Side = fromAsset === 'quote' ? 'buy' : 'sell';
  const fromSymbol = useMemo(() => (fromAsset === 'quote' ? quoteTokenSymbol : tokenSymbol), [fromAsset, quoteTokenSymbol, tokenSymbol]);
  const toSymbol = useMemo(() => (fromAsset === 'quote' ? tokenSymbol : quoteTokenSymbol), [fromAsset, quoteTokenSymbol, tokenSymbol]);
  const fromAddress = useMemo(() => (fromAsset === 'quote' ? quoteTokenAddress : tokenAddress), [fromAsset, quoteTokenAddress, tokenAddress]);
  const toAddress = useMemo(() => (fromAsset === 'quote' ? tokenAddress : quoteTokenAddress), [fromAsset, quoteTokenAddress, tokenAddress]);
  const hasExecutableQuote = useMemo(() => (quote ? BigInt(quote.outputAmount) > 0n : true), [quote]);

  function toUi(value: string) {
    const n = BigInt(value || '0');
    const whole = n / 10n ** 18n;
    const frac = (n % 10n ** 18n).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
  }

  async function onTrade() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus('Submitting trade transaction...');
    setFeedback(null);
    try {
      const res = await executeEkuboTrade({
        side,
        tokenAddress,
        quoteTokenAddress,
        amount,
        slippage,
        poolKey,
      });
      setStatus('Transaction submitted. Waiting for confirmation...');
      setFeedback({
        variant: 'pending',
        title: 'Swap submitted',
        description: `${fromSymbol} -> ${toSymbol} has been sent to the network. Waiting for confirmation.`,
      });
      void res.confirmed
        .then(async () => {
          setStatus('Success. Swap confirmed.');
          setFeedback({
            variant: 'success',
            title: 'Swap completed',
            description: `${toSymbol} balance has been refreshed. The swap finished successfully.`,
          });
          if (wallet.connected && wallet.address) {
            const [fromBal, toBal] = await Promise.all([
              readTokenBalance(fromAddress, wallet.address),
              readTokenBalance(toAddress, wallet.address),
            ]);
            setFromBalance(fromBal);
            setToBalance(toBal);
          }
        })
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : 'Trade confirmation failed');
          setFeedback({
            variant: 'error',
            title: 'Swap failed',
            description: error instanceof Error ? error.message : 'Trade confirmation failed',
          });
        });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Trade failed');
      setFeedback({
        variant: 'error',
        title: 'Swap could not start',
        description: error instanceof Error ? error.message : 'Trade failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function flipDirection() {
    setFromAsset((prev) => (prev === 'quote' ? 'token' : 'quote'));
    setStatus('');
    setFeedback(null);
  }

  useEffect(() => {
    let cancelled = false;
    if (!wallet.connected || !wallet.address) {
      setFromBalance('0');
      setToBalance('0');
      return;
    }
    (async () => {
      const [fromBal, toBal] = await Promise.all([
        readTokenBalance(fromAddress, wallet.address!),
        readTokenBalance(toAddress, wallet.address!),
      ]);
      if (!cancelled) {
        setFromBalance(fromBal);
        setToBalance(toBal);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet.connected, wallet.address, fromAddress, toAddress]);

  useEffect(() => {
    let cancelled = false;
    if (!amount || Number(amount) <= 0 || !poolKey) {
      setQuote(null);
      return;
    }
    setLoadingQuote(true);
    (async () => {
      try {
        const q = await quoteEkuboTrade({
          side,
          tokenAddress,
          quoteTokenAddress,
          amount,
          slippage,
          poolKey,
        });
        if (!cancelled) {
          setQuote(
            q
              ? {
                  ...q,
                  outputAmountUi: formatDecimalDots(toUi(q.outputAmount)),
                  minReceivedUi: formatDecimalDots(toUi(q.minReceived)),
                  platformFeeUi: formatDecimalDots(toUi(q.platformFee)),
                }
              : null,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setQuote(null);
          setStatus(error instanceof Error ? error.message : 'Quote failed');
        }
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount, slippage, side, tokenAddress, quoteTokenAddress, poolKey]);

  function setMaxAmount() {
    setAmount(fromBalance || '0');
  }

  function setPercentAmount(percent: number) {
    const balance = Number.parseFloat(fromBalance || '0');
    if (!Number.isFinite(balance) || balance <= 0) {
      setAmount('0');
      return;
    }
    const next = (balance * percent) / 100;
    setAmount(next.toFixed(6).replace(/\.?0+$/, ''));
  }

  return (
    <section className="panel dex-trade">
      <div className="dex-topbar">
        <h3 className="card-title">Trade</h3>
        <div className="dex-side-toggle">
          <button type="button" className={fromAsset === 'quote' ? 'dex-side-active' : 'ghost-button'} onClick={() => setFromAsset('quote')}>
            Buy
          </button>
          <button type="button" className={fromAsset === 'token' ? 'dex-side-active' : 'ghost-button'} onClick={() => setFromAsset('token')}>
            Sell
          </button>
        </div>
      </div>

      <div className="dex-slippage-row">
        <span className="muted">Max slippage</span>
        <div className="dex-slippage-controls">
          {[0.5, 1, 2].map((value) => (
            <button
              key={value}
              type="button"
              className={Math.abs(slippage - value) < 0.001 ? 'dex-chip-active' : 'ghost-button dex-chip'}
              onClick={() => setSlippage(value)}
            >
              {value}%
            </button>
          ))}
          <input
            className="dex-slippage-input"
            type="number"
            min={0.1}
            step={0.1}
            value={slippage}
            onChange={(e) => setSlippage(Number.parseFloat(e.target.value) || 1)}
            aria-label="Custom slippage"
          />
        </div>
      </div>

      <div className="dex-swap-card">
        <div className="dex-token-block">
          <div className="dex-token-head">
            <span className="muted">From</span>
            <select
              className="dex-token-select"
              value={fromAsset}
              onChange={(e) => setFromAsset(e.target.value as AssetSide)}
            >
              <option value="quote">{quoteTokenSymbol}</option>
              <option value="token">{tokenSymbol}</option>
            </select>
          </div>
          <input
            className="dex-amount-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.0"
          />
          <div className="dex-balance-row">
            <span className="muted">Balance: {formatDecimalDots(fromBalance)} {fromSymbol}</span>
            <button type="button" className="ghost-button dex-chip" onClick={setMaxAmount}>Max</button>
          </div>
          <div className="dex-preset-row">
            {[10, 30, 50].map((preset) => (
              <button
                key={preset}
                type="button"
                className="ghost-button dex-chip"
                onClick={() => setPercentAmount(preset)}
              >
                %{preset}
              </button>
            ))}
            <button type="button" className="ghost-button dex-chip" onClick={setMaxAmount}>Max</button>
          </div>
        </div>

        <button type="button" className="dex-direction" onClick={flipDirection} aria-label="Switch direction">
          ↓
        </button>

        <div className="dex-token-block dex-token-block-readonly">
          <div className="dex-token-head">
            <span className="muted">To</span>
            <span className="dex-token-pill">{toSymbol}</span>
          </div>
          <div className="dex-output-value">{loadingQuote ? '...' : (quote ? quote.outputAmountUi : '-')}</div>
          <small className="muted">Balance: {formatDecimalDots(toBalance)} {toSymbol}</small>
        </div>
      </div>

      <div className="dex-summary">
        <div className="dex-summary-row">
          <span>Min received</span>
          <strong>{quote ? `${quote.minReceivedUi} ${toSymbol}` : '-'}</strong>
        </div>
        <div className="dex-summary-row"><span>Slippage</span><strong>{slippage}%</strong></div>
      </div>

      <button
        className="dex-submit"
        type="button"
        onClick={onTrade}
        disabled={isSubmitting || !wallet.connected || !amount || Number(amount) <= 0 || !hasExecutableQuote}
      >
        {!wallet.connected ? (
          'Connect wallet first'
        ) : isSubmitting ? (
          <span className="inline-row"><span className="button-spinner" />Submitting...</span>
        ) : (
          `Swap ${fromSymbol} → ${toSymbol}`
        )}
      </button>

      {quote && !hasExecutableQuote ? <small className="muted dex-status">No executable liquidity for this amount.</small> : null}
      {status ? <small className="muted dex-status">{status}</small> : null}
      <TransactionFeedbackCard
        open={Boolean(feedback)}
        variant={feedback?.variant || 'pending'}
        title={feedback?.title || ''}
        description={feedback?.description || ''}
      />
    </section>
  );
}
