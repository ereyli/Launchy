import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, GradientButton } from '~/components/ui';
import { colors } from '~/theme/colors';

export function HomeScreen({ onOpenToken, onOpenNft }: { onOpenToken: () => void; onOpenNft: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.badge}>LAUNCHY MOBILE</Text>
        <Text style={styles.title}>Token + NFT launchpad in your pocket</Text>
        <Text style={styles.subtitle}>
          Starknet Sepolia, Starkzap wallet onboarding, AVNU sponsored transactions, and mobile-first launch flow.
        </Text>
        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Speed</Text>
            <Text style={styles.metricValue}>Fast</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Network</Text>
            <Text style={styles.metricValue}>Sepolia</Text>
          </View>
        </View>
      </Card>

      <View style={styles.ctaWrap}>
        <GradientButton title="Open Token Launchpad" onPress={onOpenToken} />
      </View>
      <View style={styles.ctaWrap}>
        <GradientButton title="Open NFT Launchpad" onPress={onOpenNft} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14 },
  badge: { color: colors.primary2, fontWeight: '700', fontSize: 12, marginBottom: 10 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', lineHeight: 34 },
  subtitle: { color: colors.muted, marginTop: 10, lineHeight: 22, fontSize: 16 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  metric: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
  },
  metricLabel: { color: colors.muted, fontSize: 12 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  ctaWrap: { marginTop: 2 },
});
