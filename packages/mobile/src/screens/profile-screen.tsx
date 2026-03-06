import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, GradientButton } from '~/components/ui';
import { useWallet } from '~/contexts/wallet-context';
import { colors } from '~/theme/colors';

export function ProfileScreen() {
  const wallet = useWallet();

  return (
    <View style={styles.screen}>
      <Card>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.address}>{wallet.label}</Text>
        <Text style={styles.info}>Gas mode: AVNU sponsored (via Starkzap)</Text>
        {wallet.error ? <Text style={styles.error}>{wallet.error}</Text> : null}
      </Card>

      {!wallet.address ? (
        <View style={styles.stack}>
          <GradientButton
            title={wallet.loading ? 'Connecting Cartridge...' : 'Connect Cartridge'}
            disabled={wallet.loading}
            onPress={() => void wallet.connectCartridge()}
          />
          <GradientButton
            title={wallet.loading ? 'Connecting Privy...' : 'Connect Privy'}
            disabled={wallet.loading}
            onPress={() => void wallet.connectPrivy()}
          />
        </View>
      ) : (
        <View style={styles.stack}>
          <GradientButton
            title={wallet.loading ? 'Disconnecting...' : 'Disconnect'}
            disabled={wallet.loading}
            onPress={() => void wallet.disconnect()}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  address: { color: colors.primary2, marginTop: 8, fontWeight: '600' },
  info: { color: colors.muted, marginTop: 6 },
  error: { color: colors.danger, marginTop: 8 },
  stack: { gap: 10 },
});
