import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../services/auth.context';
import { queryClient } from '../services/query-client';
import { startNetworkListening } from '../services/network.service';
import { initializeDatabase } from '../database';

import { startSyncEngine, syncNow } from '../sync';

// Prevent the splash screen from auto-hiding before DB + auth are ready
SplashScreen.preventAutoHideAsync();

// ─── Sync Engine Runner ────────────────────────────────────────────────────────

function SyncEngineRunner(): null {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const cleanup = startSyncEngine(() => user.id);
    // Trigger initial Firestore sync on login/app launch
    void syncNow(user.id);
    return cleanup;
  }, [user?.id]);

  return null;
}

// ─── Auth Guard ────────────────────────────────────────────────────────────────

function AuthGuard(): React.JSX.Element | null {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to app if already authenticated
      router.replace('/(app)');
    }

    SplashScreen.hideAsync();
  }, [isAuthenticated, isLoading, segments, router]);

  return (
    <>
      <SyncEngineRunner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

// ─── Root DB Init ─────────────────────────────────────────────────────────────

function DatabaseInitializer({ children }: { children: React.ReactNode }): React.JSX.Element {
  useEffect(() => {
    // Initialize SQLite database and run migrations
    void initializeDatabase().catch((err) => {
      console.error('[RootLayout] DB init failed:', err);
    });

    // Start network connectivity listener — updates Zustand stores in real-time
    const unsubscribe = startNetworkListening();
    return unsubscribe;
  }, []);

  return <>{children}</>;
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout(): React.JSX.Element {
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <DatabaseInitializer>
              <AuthGuard />
            </DatabaseInitializer>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </View>
  );
}

