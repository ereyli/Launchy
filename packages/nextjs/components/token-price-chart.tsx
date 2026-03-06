'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDecimalDots } from '~~/lib/format';
import { shortAddress } from '~~/lib/starknet/address';

type Point = { x: number; y: number; label: string; volume?: number };
type CandleBar = {
  x: number;
  start: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
type TradeRow = {
  id?: string;
  eventIndex?: number;
  account: string;
  side: 'buy' | 'sell';
  quoteAmount: number;
  tokenAmount: number;
  quotePerToken?: number;
  ts: number;
  txHash: string;
};

type Props = {
  tokenAddress: string;
  quoteTokenAddress: string;
  tokenSymbol?: string;
  totalSupply?: string;
  quoteTokenSymbol?: string;
  poolKey?: {
    token0: string;
    token1: string;
    fee: string;
    tickSpacing: string;
    extension?: string;
  };
};

function compactUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function parseLocaleNumber(input: string) {
  const raw = (input || '').trim();
  if (!raw) return 0;
  if (raw.includes('.') && raw.includes(',')) {
    return Number.parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  }
  if (raw.includes('.') && raw.split('.').length > 2) {
    return Number.parseFloat(raw.replace(/\./g, ''));
  }
  if (raw.includes(',')) {
    return Number.parseFloat(raw.replace(',', '.'));
  }
  return Number.parseFloat(raw);
}

function aggregateCandles(points: Point[], bucketSec: number, limit: number) {
  if (!points.length) return [];
  const buckets = new Map<number, CandleBar>();
  for (const point of points) {
    const stamp = Number(point.label || 0);
    const bucket = Math.floor(stamp / bucketSec) * bucketSec;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, {
        x: 0,
        start: bucket,
        open: point.y,
        high: point.y,
        low: point.y,
        close: point.y,
        volume: Number(point.volume || 0),
      });
      continue;
    }
    existing.high = Math.max(existing.high, point.y);
    existing.low = Math.min(existing.low, point.y);
    existing.close = point.y;
    existing.volume += Number(point.volume || 0);
  }
  const sorted = [...buckets.values()].sort((a, b) => a.start - b.start);
  if (!sorted.length) return [];
  const endBucket = sorted[sorted.length - 1].start;
  const startBucket = endBucket - (limit - 1) * bucketSec;
  const bucketByStart = new Map(sorted.map((candle) => [candle.start, candle]));
  const filled: CandleBar[] = [];
  let previous = sorted[0];

  for (let bucket = startBucket; bucket <= endBucket; bucket += bucketSec) {
    const exact = bucketByStart.get(bucket);
    if (exact) {
      filled.push({ ...exact, x: filled.length });
      previous = exact;
      continue;
    }
    filled.push({
      x: filled.length,
      start: bucket,
      open: previous.close,
      high: previous.close,
      low: previous.close,
      close: previous.close,
      volume: 0,
    });
  }

  return filled.slice(-limit).map((candle, index) => ({ ...candle, x: index }));
}

function smoothLine(values: CandleBar[]) {
  if (values.length < 3) return values;
  let prev = values[0].close;
  return values.map((item, index) => {
    if (index === 0) return item;
    const next = prev + (item.close - prev) * 0.35;
    prev = next;
    return {
      ...item,
      open: index === 0 ? item.open : values[index - 1].close,
      high: Math.max(item.high, next),
      low: Math.min(item.low, next),
      close: next,
    };
  });
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cp1x = prev.x + (curr.x - prev.x) * 0.35;
    const cp2x = prev.x + (curr.x - prev.x) * 0.65;
    path += ` C ${cp1x.toFixed(2)} ${prev.y.toFixed(2)}, ${cp2x.toFixed(2)} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }
  return path;
}

function formatRelativeTradeTime(nowSec: number | null, ts: number) {
  if (nowSec === null) return '--';
  const diffSec = Math.max(0, nowSec - ts);
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(diffSec / 3600);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function TokenPriceChart({
  tokenAddress,
  quoteTokenAddress,
  tokenSymbol,
  totalSupply,
  quoteTokenSymbol,
  poolKey,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [points, setPoints] = useState<Point[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [strkUsd, setStrkUsd] = useState(0.04);
  const [nowSec, setNowSec] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNowSec(Math.floor(Date.now() / 1000));
    tick();
    timer = setInterval(tick, 30000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchTradesPoints() {
      try {
        const res = await fetch(
          `/api/market/trades?base=${encodeURIComponent(tokenAddress)}&quote=${encodeURIComponent(quoteTokenAddress)}&limit=96`,
          { cache: 'no-store' },
        );
        if (!res.ok) return [];
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload?.trades) ? payload.trades : [];
        return rows
          .sort((a: TradeRow, b: TradeRow) => a.ts - b.ts)
          .map((trade: TradeRow, idx: number) => {
            const price = Number(trade.quotePerToken || 0);
            if (!Number.isFinite(price) || price <= 0) return null;
            return { x: idx, y: price, label: String(trade.ts), volume: trade.quoteAmount } as Point;
          })
          .filter((p: Point | null): p is Point => p !== null)
          .slice(-120);
      } catch {
        return [];
      }
    }

    async function loadChart(silent = false) {
      if (!silent && points.length === 0) setLoading(true);
      if (!silent) {
        setError('');
        setIsFallback(false);
      }
      try {
        const indexedRes = await fetch(
          `/api/market/candles?base=${encodeURIComponent(tokenAddress)}&quote=${encodeURIComponent(
            quoteTokenAddress,
          )}&timeframe=3600`,
          { cache: 'no-store' },
        );
        const indexedPayload = await indexedRes.json().catch(() => ({}));
        if (indexedRes.ok) {
          const series = Array.isArray(indexedPayload?.series) ? indexedPayload.series : [];
          const mappedIndexed = series
            .map((row: any, idx: number) => {
              const value = Number(row?.close ?? 0);
              if (!Number.isFinite(value) || value <= 0) return null;
              return {
                x: idx,
                y: value,
                label: String(row?.start ?? idx),
                volume: Number(row?.volume ?? row?.volume_quote ?? 0),
              } as Point;
            })
            .filter((p: Point | null): p is Point => p !== null);
          if (mappedIndexed.length >= 1) {
            if (!cancelled) {
              setPoints(mappedIndexed.slice(-96));
              setIsFallback(false);
              setError('');
            }
            return;
          }
        }

        const res = await fetch(
          `/api/ekubo/price-history?base=${encodeURIComponent(tokenAddress)}&quote=${encodeURIComponent(quoteTokenAddress)}&interval=3600`,
          { cache: 'no-store' },
        );
        const payload = await res.json();
        if (!res.ok) throw new Error('Chart data is temporarily unavailable.');

        const raw = Array.isArray(payload?.data) ? payload.data : [];
        const reversed = Boolean(payload?.reversed);
        const mapped = raw
          .map((row: any, idx: number) => {
            const source = Number(row?.vwap ?? row?.max ?? row?.min ?? 0);
            const value = reversed && source > 0 ? 1 / source : source;
            if (!Number.isFinite(value) || value <= 0) return null;
            return {
              x: idx,
              y: value,
              label: String(row?.start ?? idx),
              volume: Number(row?.volume ?? 0),
            } as Point;
          })
          .filter((p: Point | null): p is Point => p !== null);
        if (!cancelled) {
          if (mapped.length >= 1) {
            setPoints(mapped.slice(-48));
            setIsFallback(false);
            setError('');
          } else {
            const tradePoints = await fetchTradesPoints();
            if (tradePoints.length > 0) {
              setPoints(tradePoints);
              setIsFallback(true);
              setError('');
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (points.length === 0) setError('Chart data syncing...');
          const tradePoints = await fetchTradesPoints();
          if (tradePoints.length > 0) {
            setPoints(tradePoints);
            setIsFallback(true);
            setError('');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadChart(false);

    return () => {
      cancelled = true;
    };
  }, [tokenAddress, quoteTokenAddress, poolKey, points.length]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function loadTrades() {
      try {
        const res = await fetch(
          `/api/market/trades?base=${encodeURIComponent(tokenAddress)}&quote=${encodeURIComponent(quoteTokenAddress)}&limit=8`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        if (!cancelled) {
          setTrades(Array.isArray(payload?.trades) ? payload.trades.slice(0, 8) : []);
        }
      } catch {
        // keep old list
      }
    }
    void loadTrades();
    timer = setInterval(() => void loadTrades(), 12000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [tokenAddress, quoteTokenAddress]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function loadStrkUsd() {
      try {
        const res = await fetch('/api/market/strk-usd', { cache: 'no-store' });
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        const value = Number(payload?.price || 0);
        if (!cancelled && Number.isFinite(value) && value > 0) {
          setStrkUsd(value);
        }
      } catch {
        // fallback value remains
      }
    }
    void loadStrkUsd();
    timer = setInterval(() => void loadStrkUsd(), 45000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (points.length > 0 || !trades.length) return;
    const tradePoints = [...trades]
      .sort((a, b) => a.ts - b.ts)
      .map((trade, idx) => {
        const price = Number(trade.quotePerToken || 0);
        if (!Number.isFinite(price) || price <= 0) return null;
        return { x: idx, y: price, label: String(trade.ts), volume: trade.quoteAmount } as Point;
      })
      .filter((p: Point | null): p is Point => p !== null);
    if (tradePoints.length > 0) {
      setPoints(tradePoints.slice(-120));
      setIsFallback(true);
      setError('');
    }
  }, [trades, points.length]);

  const supplyFloat = useMemo(() => {
    const parsed = parseLocaleNumber(totalSupply || '0');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [totalSupply]);

  const quoteUsd = useMemo(() => {
    const symbol = (quoteTokenSymbol || '').toUpperCase();
    return symbol === 'STRK' ? strkUsd : 1;
  }, [quoteTokenSymbol, strkUsd]);

  const chartPoints = useMemo(() => {
    if (supplyFloat <= 0) return points;
    return points.map((p) => ({
      ...p,
      y: p.y * supplyFloat * quoteUsd,
    }));
  }, [points, quoteUsd, supplyFloat]);

  const candleBars = useMemo(() => {
    if (!chartPoints.length) return [];
    const stamped = chartPoints
      .map((point, index) => ({
        ...point,
        x: index,
        label: point.label || String(index),
      }))
      .sort((a, b) => Number(a.label) - Number(b.label));
    return smoothLine(aggregateCandles(stamped, 4 * 3600, 42));
  }, [chartPoints]);

  const yTicks = useMemo(() => {
    if (!candleBars.length) return [];
    const min = Math.min(...candleBars.map((c) => c.low));
    const max = Math.max(...candleBars.map((c) => c.high));
    const padding = Math.max((max - min) * 0.18, Math.abs(max) * 0.003, 1);
    const paddedMin = Math.max(0, min - padding);
    const paddedMax = max + padding;
    const range = Math.max(paddedMax - paddedMin, 1);
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const ratio = i / steps;
      const value = paddedMax - range * ratio;
      const y = 12 + (320 - 24) * ratio;
      return { y, value };
    });
  }, [candleBars]);

  const candleSvg = useMemo(() => {
    if (!candleBars.length) {
      return {
        linePath: '',
        areaPath: '',
        markers: [] as Array<{ key: string; cx: number; cy: number }>,
        currentLineY: 0,
        height: 320,
        width: 820,
      };
    }
    const width = 820;
    const height = 320;
    const pad = 14;
    const plotHeight = height - pad * 2;
    const minY = Math.min(...candleBars.map((candle) => candle.close));
    const maxY = Math.max(...candleBars.map((candle) => candle.close));
    const padding = Math.max((maxY - minY) * 0.22, Math.abs(maxY) * 0.005, 1);
    const paddedMin = Math.max(0, minY - padding);
    const paddedMax = maxY + padding;
    const rangeY = Math.max(paddedMax - paddedMin, 1);
    const slot = width / candleBars.length;

    const toY = (value: number) => {
      const y = pad + (1 - (value - paddedMin) / rangeY) * plotHeight;
      return Math.max(pad, Math.min(height - pad, y));
    };

    const linePoints = candleBars.map((candle, index) => {
      const centerX = slot * index + slot / 2;
      return {
        key: `${candle.start}-${index}`,
        x: centerX,
        y: toY(candle.close),
      };
    });
    const linePath = buildSmoothPath(linePoints);
    const areaPath = linePoints.length
      ? `${linePath} L ${linePoints[linePoints.length - 1].x.toFixed(2)} ${(height - pad).toFixed(2)} L ${linePoints[0].x.toFixed(2)} ${(height - pad).toFixed(2)} Z`
      : '';
    const markerIndexes = new Set([Math.floor(linePoints.length / 2), linePoints.length - 1]);
    const markers = linePoints
      .filter((_, index) => markerIndexes.has(index))
      .map((point, index) => ({ key: `${point.key}-${index}`, cx: point.x, cy: point.y }));
    return {
      linePath,
      areaPath,
      markers,
      currentLineY: linePoints[linePoints.length - 1]?.y ?? 0,
      currentValue: candleBars[candleBars.length - 1]?.close ?? 0,
      height,
      width,
    };
  }, [candleBars]);

  return (
    <section className="panel token-chart-panel">
      <div className="section-head">
        <h3 className="card-title">Ekubo Price Chart</h3>
        <span className="muted">4H market cap line</span>
      </div>
      {loading && points.length === 0 ? <p className="muted">Loading chart...</p> : null}
      {error ? <p className="muted">{error}</p> : null}
      {!loading && !error && points.length < 1 ? <p className="muted">No chart data yet for this pair.</p> : null}
      {!loading && !error && candleBars.length >= 1 ? (
        <div className="chart-shell">
          <svg viewBox="0 0 820 320" className="chart-svg chart-svg-large" aria-label="price chart">
            {yTicks.map((tick) => (
              <line
                key={`grid-${tick.y}-${tick.value}`}
                x1="0"
                x2={String(candleSvg.width)}
                y1={String(tick.y)}
                y2={String(tick.y)}
                stroke="rgba(132, 145, 179, 0.12)"
                strokeWidth="1"
              />
            ))}
            <path d={candleSvg.areaPath} fill="url(#chartAreaGradient)" opacity="0.28" />
            <line
              x1="0"
              x2={String(candleSvg.width)}
              y1={String(candleSvg.currentLineY)}
              y2={String(candleSvg.currentLineY)}
              stroke="#2f67ff"
              strokeWidth="1.2"
              strokeDasharray="2 6"
              opacity="0.45"
            />
            <defs>
              <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2f67ff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#2f67ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={candleSvg.linePath} fill="none" stroke="rgba(47, 103, 255, 0.22)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d={candleSvg.linePath} fill="none" stroke="#2f67ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {candleSvg.markers.map((marker) => (
              <g key={marker.key}>
                <circle cx={marker.cx} cy={marker.cy} r="12" fill="#2f67ff" fillOpacity="0.12" />
                <circle cx={marker.cx} cy={marker.cy} r="5.5" fill="#0d1529" stroke="#2f67ff" strokeWidth="2.2" />
              </g>
            ))}
          </svg>
          <div className="chart-y-axis">
            {yTicks.map((tick) => (
              <span key={`${tick.y}-${tick.value}`} style={{ top: `${tick.y}px` }}>
                {compactUsd(tick.value)}
              </span>
            ))}
            <span
              style={{
                top: `${candleSvg.currentLineY}px`,
                transform: 'translateY(-50%)',
                background: '#2f67ff',
                color: '#f7f8fc',
                padding: '6px 10px',
                borderRadius: '10px',
                fontWeight: 700,
              }}
            >
              {compactUsd(candleSvg.currentValue ?? 0)}
            </span>
          </div>
        </div>
      ) : null}
      <div className="trades-list">
        <div className="trades-head">
          <span>Account</span>
          <span>Type</span>
          <span>Amount (STRK)</span>
          <span>Amount ({tokenSymbol || 'TOKEN'})</span>
          <span>Time</span>
          <span>Txn</span>
        </div>
        {trades.length ? (
          trades.map((trade, index) => (
            <div className="trades-row" key={trade.id || `${trade.txHash}-${trade.ts}-${trade.eventIndex ?? 0}-${index}`}>
              <span className="mono">{shortAddress(trade.account)}</span>
              <span className={trade.side === 'buy' ? 'trade-buy' : 'trade-sell'}>
                {trade.side === 'buy' ? 'Buy' : 'Sell'}
              </span>
              <span>{formatDecimalDots(String(trade.quoteAmount), 6)}</span>
              <span>{formatDecimalDots(String(trade.tokenAmount), 6)}</span>
              <span className="muted">
                {formatRelativeTradeTime(nowSec, trade.ts)}
              </span>
              <a
                href={`https://voyager.online/tx/${trade.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mono"
              >
                {shortAddress(trade.txHash)}
              </a>
            </div>
          ))
        ) : (
          <p className="muted">No trades yet.</p>
        )}
      </div>
    </section>
  );
}
