import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Card, GradientButton } from '~/components/ui';
import { useWallet } from '~/contexts/wallet-context';
import { fetchCandles, fetchTokenDetail, fetchTokens, fetchTrades } from '~/lib/api';
import { mobileEnv } from '~/lib/config';
import { buildSwapCalls, fetchSpotQuote } from '~/lib/trade';
import { colors } from '~/theme/colors';
import type { CandleRow, TokenCard, TokenDetail, TradeRow } from '~/types/market';

function formatMc(value?: number | null) {
  if (!value || Number.isNaN(value)) return '-';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function shortHash(value: string) {
  if (!value) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function TradePanel({ token, onBack }: { token: TokenCard; onBack: () => void }) {
  const wallet = useWallet();
  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [timeframe, setTimeframe] = useState<60 | 300 | 900 | 3600>(3600);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('1');
  const [slippage, setSlippage] = useState('1');
  const [quoteOut, setQuoteOut] = useState<string>('-');
  const [minReceived, setMinReceived] = useState<string>('-');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tokenDetail = await fetchTokenDetail(token.address);
      if (!tokenDetail) throw new Error('Token detail not found');
      setDetail(tokenDetail);

      const [series, latestTrades] = await Promise.all([
        fetchCandles(tokenDetail.address, tokenDetail.quoteToken, timeframe),
        fetchTrades(tokenDetail.address, tokenDetail.quoteToken, 8),
      ]);
      setCandles(series);
      setTrades(latestTrades);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to load token');
    } finally {
      setLoading(false);
    }
  }, [token.address, timeframe]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!detail || !amount || Number(amount) <= 0) {
        if (alive) {
          setQuoteOut('-');
          setMinReceived('-');
        }
        return;
      }
      try {
        const q = await fetchSpotQuote({
          token: detail,
          side,
          amount,
          slippageBps: Math.max(1, Math.round(Number(slippage || '1') * 100)),
        });
        if (!alive) return;
        setQuoteOut(q?.amountOut || '-');
        setMinReceived(q?.minReceived || '-');
      } catch {
        if (!alive) return;
        setQuoteOut('-');
        setMinReceived('-');
      }
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [detail, side, amount, slippage]);

  const points = useMemo(() => {
    if (!candles.length) return '';
    const closes = candles.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const width = 320;
    const height = 180;
    return closes
      .map((value, index) => {
        const x = candles.length === 1 ? 0 : (index / (candles.length - 1)) * width;
        const y = max === min ? height / 2 : ((max - value) / (max - min)) * height;
        return `${x},${y}`;
      })
      .join(' ');
  }, [candles]);

  const submitTrade = useCallback(async () => {
    if (!detail || !wallet.address) {
      setStatus('Connect wallet first.');
      return;
    }
    if (!detail.poolKey) {
      setStatus('Pool is not ready.');
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      const quote = await fetchSpotQuote({
        token: detail,
        side,
        amount,
        slippageBps: Math.max(1, Math.round(Number(slippage || '1') * 100)),
      });
      if (!quote) throw new Error('Quote unavailable');

      const finalRouter = mobileEnv.ekuboFeeRouter;
      if (!finalRouter) {
        throw new Error('Set EXPO_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS in mobile .env');
      }

      const calls = buildSwapCalls({
        token: detail,
        side,
        amount,
        minReceivedWei: quote.minReceivedWei,
        feeRouter: finalRouter,
        recipient: wallet.address,
      });

      const tx = await wallet.execute(calls);
      setStatus(`Submitted: ${shortHash(tx.hash)}`);
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Trade failed');
    } finally {
      setSubmitting(false);
    }
  }, [detail, wallet, side, amount, slippage, token.address, load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{token.name}</Text>
      </View>

      <Card>
        <View style={styles.chartHead}>
          <Text style={styles.cardTitle}>Price Chart</Text>
          <View style={styles.tfRow}>
            {[60, 300, 900, 3600].map((tf) => (
              <Pressable key={tf} style={[styles.tf, timeframe === tf && styles.tfActive]} onPress={() => setTimeframe(tf as 60 | 300 | 900 | 3600)}>
                <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>{tf === 60 ? '1m' : tf === 300 ? '5m' : tf === 900 ? '15m' : '1h'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.chartWrap}>
          {loading ? <ActivityIndicator color={colors.primary} /> : <Svg width="100%" height={180} viewBox="0 0 320 180"><Polyline points={points} fill="none" stroke={colors.primary} strokeWidth="3" /></Svg>}
        </View>
      </Card>

      <Card>
        <View style={styles.segmentRow}>
          <Pressable style={[styles.segment, side === 'buy' && styles.segmentActive]} onPress={() => setSide('buy')}>
            <Text style={[styles.segmentText, side === 'buy' && styles.segmentTextActive]}>Buy</Text>
          </Pressable>
          <Pressable style={[styles.segment, side === 'sell' && styles.segmentActive]} onPress={() => setSide('sell')}>
            <Text style={[styles.segmentText, side === 'sell' && styles.segmentTextActive]}>Sell</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Amount ({side === 'buy' ? 'STRK' : token.symbol})</Text>
        <TextInput value={amount} onChangeText={setAmount} style={styles.input} keyboardType="decimal-pad" />
        <Text style={styles.label}>Slippage (%)</Text>
        <TextInput value={slippage} onChangeText={setSlippage} style={styles.input} keyboardType="decimal-pad" />

        <View style={styles.quoteBox}>
          <Text style={styles.meta}>You receive: {quoteOut} {side === 'buy' ? token.symbol : 'STRK'}</Text>
          <Text style={styles.meta}>Min received: {minReceived} {side === 'buy' ? token.symbol : 'STRK'}</Text>
        </View>

        <GradientButton title={submitting ? 'Confirming...' : side === 'buy' ? `Swap STRK → ${token.symbol}` : `Swap ${token.symbol} → STRK`} onPress={() => void submitTrade()} disabled={submitting || loading} />
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Recent Trades</Text>
        {trades.map((trade) => (
          <View key={trade.id} style={styles.tradeRow}>
            <Text style={[styles.tradeSide, trade.side === 'buy' ? styles.buy : styles.sell]}>{trade.side.toUpperCase()}</Text>
            <Text style={styles.tradeAmount}>{trade.quoteAmount.toFixed(3)} STRK</Text>
            <Text style={styles.tradeHash}>{shortHash(trade.txHash)}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

export function TokenScreen() {
  const [items, setItems] = useState<TokenCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TokenCard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchTokens();
      setItems(next.filter((item) => item.isLaunched !== false));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (selected) {
    return <TradePanel token={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.address}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={<Text style={styles.title}>Token Launchpad</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No tokens listed.</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => setSelected(item)}>
          <Card>
            <View style={styles.headerRow}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.symbol}>{item.symbol}</Text>
            </View>
            <Text style={styles.meta}>MC: {formatMc(item.marketCapUsd)}</Text>
            <Text style={styles.meta}>Supply: {item.totalSupply}</Text>
            <Text style={styles.address}>{item.address}</Text>
          </Card>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 30 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 14 },
  empty: { color: colors.muted, fontSize: 15 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  backText: { color: colors.muted, fontWeight: '700' },
  chartWrap: { borderColor: colors.border, borderWidth: 1, borderRadius: 14, minHeight: 180, justifyContent: 'center', alignItems: 'center', marginTop: 10, overflow: 'hidden' },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  tfRow: { flexDirection: 'row', gap: 6 },
  tf: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 8 },
  tfActive: { backgroundColor: colors.primary },
  tfText: { color: colors.muted, fontWeight: '700' },
  tfTextActive: { color: '#001222' },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segment: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: 'center', paddingVertical: 8 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, fontWeight: '700' },
  segmentTextActive: { color: '#001222' },
  label: { color: colors.muted, marginTop: 8, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18 },
  quoteBox: { marginVertical: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.surfaceSoft },
  status: { color: colors.muted, marginTop: 8 },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  tradeSide: { fontWeight: '800' },
  buy: { color: colors.success },
  sell: { color: colors.danger },
  tradeAmount: { color: colors.text },
  tradeHash: { color: colors.muted },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontWeight: '700', fontSize: 19 },
  symbol: { color: colors.primary2, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.muted, marginTop: 8, fontSize: 14 },
  address: { color: colors.muted, marginTop: 6, fontSize: 12 },
});
