import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Card } from '~/components/ui';
import { fetchNfts } from '~/lib/api';
import { colors } from '~/theme/colors';
import type { NftCard } from '~/types/market';

export function NftScreen() {
  const [items, setItems] = useState<NftCard[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchNfts();
      setItems(next);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.address}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={<Text style={styles.title}>NFT Launchpad</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No NFT collections found.</Text>}
      renderItem={({ item }) => (
        <Card>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <View style={styles.row}>
            <Text style={styles.meta}>Minted: {item.minted}</Text>
            <Text style={styles.meta}>Supply: {item.maxSupply}</Text>
          </View>
          <Text style={styles.meta}>Price: {item.mintPrice} STRK</Text>
        </Card>
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
  name: { color: colors.text, fontWeight: '700', fontSize: 20 },
  symbol: { color: colors.primary, marginTop: 4, marginBottom: 8, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: colors.muted, marginTop: 6, fontSize: 14 },
});
