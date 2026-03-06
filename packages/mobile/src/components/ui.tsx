import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { colors } from '~/theme/colors';

export function GradientButton({ title, ...props }: PressableProps & { title: string }) {
  return (
    <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} {...props}>
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#001222',
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
});
