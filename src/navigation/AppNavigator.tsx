import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AddAssignmentScreen } from '../screens/AddAssignmentScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';

type AppRoute = 'home' | 'add_assignment';

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('home');

  // 1. Initial Launch / Session Restoration Loader
  if (isLoading) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <View style={styles.splashContent}>
          <View style={styles.splashLogoBadge}>
            <Text style={styles.splashLogoEmoji}>🎓</Text>
          </View>
          <Text style={styles.splashTitle}>MSc Academic Tracker</Text>
          <Text style={styles.splashSubtitle}>
            Restoring encrypted offline session...
          </Text>
          <ActivityIndicator
            size="large"
            color="#3B82F6"
            style={styles.splashSpinner}
          />
        </View>
      </SafeAreaView>
    );
  }

  // 2. Unauthenticated Guard: Redirect all traffic to Auth routes
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // 3. Authenticated Protected Stack
  switch (currentRoute) {
    case 'add_assignment':
      return (
        <AddAssignmentScreen
          onNavigateBack={() => setCurrentRoute('home')}
          onSuccess={() => setCurrentRoute('home')}
        />
      );
    case 'home':
    default:
      return (
        <HomeScreen
          onNavigateToAdd={() => setCurrentRoute('add_assignment')}
        />
      );
  }
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  splashContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  splashLogoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  splashLogoEmoji: {
    fontSize: 36,
  },
  splashTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '500',
  },
  splashSpinner: {
    marginTop: 24,
  },
});
