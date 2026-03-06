import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { WalletProvider, useWallet } from '~/contexts/wallet-context';
import { HomeScreen } from '~/screens/home-screen';
import { NftScreen } from '~/screens/nft-screen';
import { ProfileScreen } from '~/screens/profile-screen';
import { TokenScreen } from '~/screens/token-screen';
import { colors } from '~/theme/colors';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

function WalletBadge() {
  const wallet = useWallet();
  return (
    <View style={{ paddingRight: 14 }}>
      <Text style={{ color: wallet.address ? colors.primary2 : colors.muted, fontWeight: '700' }}>
        {wallet.address ? 'Connected' : 'Disconnected'}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerRight: WalletBadge,
      }}
    >
      <Tab.Screen name="Home">
        {({ navigation }) => (
          <HomeScreen onOpenToken={() => navigation.navigate('Token')} onOpenNft={() => navigation.navigate('NFT')} />
        )}
      </Tab.Screen>
      <Tab.Screen name="NFT" component={NftScreen} options={{ title: 'NFT Launchpad' }} />
      <Tab.Screen name="Token" component={TokenScreen} options={{ title: 'Token Launchpad' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <MainTabs />
      </NavigationContainer>
    </WalletProvider>
  );
}
