import { Link, Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants';

export default function NotFoundScreen(): React.JSX.Element {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.message}>This screen doesn&apos;t exist.</Text>
        <Link href="/(app)" style={styles.link}>
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },
  title: {
    fontSize: 64,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  message: {
    fontSize: 18,
    color: COLORS.text.secondary,
    marginTop: 8,
    marginBottom: 24,
  },
  link: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  linkText: {
    color: COLORS.text.inverse,
    fontWeight: '600',
    fontSize: 16,
  },
});

