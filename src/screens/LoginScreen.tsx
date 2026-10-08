import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { DEMO_USERS } from '../services/authService';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

export function LoginScreen({ onNavigateToRegister }: LoginScreenProps) {
  const { login, signInDemo, isLoading, error, clearError } = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  const handleLogin = async () => {
    setLocalError(null);
    clearError();

    if (!usernameOrEmail.trim()) {
      setLocalError('Please enter your username or email address.');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    try {
      await login(usernameOrEmail.trim(), password);
    } catch {
      // Error handled by AuthContext
    }
  };

  const handleDemoLogin = async (userId: string) => {
    setLocalError(null);
    clearError();
    try {
      await signInDemo(userId);
    } catch {
      // Error handled in AuthContext
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Academic Portal Branding Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoEmoji}>🎓</Text>
            </View>
            <Text style={styles.brandTitle}>MSc Academic Portal</Text>
            <Text style={styles.brandSubtitle}>
              Offline-First Assignment & Coursework Tracker
            </Text>
          </View>

          {/* Error Banner */}
          {displayError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {displayError}</Text>
            </View>
          )}

          {/* Login Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Student Login</Text>
            <Text style={styles.cardSubtitle}>
              Sign in with your MSc student credentials
            </Text>

            {/* Username or Email Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username or Email</Text>
              <TextInput
                style={styles.input}
                placeholder="alexturner or student@msc.ac.uk"
                placeholderTextColor="#94A3B8"
                value={usernameOrEmail}
                onChangeText={(text) => {
                  setUsernameOrEmail(text);
                  if (displayError) {
                    setLocalError(null);
                    clearError();
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            {/* Password Input */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showPasswordText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (displayError) {
                    setLocalError(null);
                    clearError();
                  }
                }}
                secureTextEntry={!showPassword}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Navigation Link to Register */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New MSc student? </Text>
              <TouchableOpacity
                onPress={onNavigateToRegister}
                activeOpacity={0.7}
              >
                <Text style={styles.footerLink}>Create an account</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 1-Tap Fast Demo Logins */}
          <View style={styles.demoSection}>
            <View style={styles.demoDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.demoDividerText}>OR 1-TAP DEMO STUDENT</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.demoGrid}>
              {DEMO_USERS.map((demo) => (
                <TouchableOpacity
                  key={demo.user.id}
                  style={styles.demoButton}
                  onPress={() => handleDemoLogin(demo.user.id)}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.demoAvatar,
                      { backgroundColor: demo.user.avatarColor || '#3B82F6' },
                    ]}
                  >
                    <Text style={styles.demoAvatarText}>
                      {(demo.user.name || demo.user.username)
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </Text>
                  </View>
                  <View style={styles.demoInfo}>
                    <Text style={styles.demoName}>
                      {demo.user.name || demo.user.username}
                    </Text>
                    <Text style={styles.demoMeta}>
                      @{demo.user.username} • {demo.user.email}
                    </Text>
                  </View>
                  <Text style={styles.demoArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Offline Security Info Note */}
          <View style={styles.securityNotice}>
            <Text style={styles.securityNoticeIcon}>🔒</Text>
            <Text style={styles.securityNoticeText}>
              Offline-First Protected: Credentials and sessions are encrypted in
              Expo SecureStore with zero online dependency.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  logoEmoji: {
    fontSize: 30,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 18,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  showPasswordText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0F172A',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  demoSection: {
    marginBottom: 20,
  },
  demoDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  demoDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    paddingHorizontal: 10,
    letterSpacing: 0.5,
  },
  demoGrid: {
    gap: 10,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demoAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  demoAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  demoInfo: {
    flex: 1,
  },
  demoName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  demoMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  demoArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94A3B8',
    marginLeft: 8,
  },
  securityNotice: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  securityNoticeIcon: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 1,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
