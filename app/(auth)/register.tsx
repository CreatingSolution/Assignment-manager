import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/use-auth.hook';
import { isUsernameTaken } from '../../services/auth.service';

export default function RegisterScreen(): React.JSX.Element {
  const router = useRouter();
  const { signUp } = useAuth();

  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameValid, setIsUsernameValid] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validate username uniqueness on blur or text change
  const handleUsernameBlur = async () => {
    const u = username.trim();
    if (!u) {
      setUsernameError(null);
      setIsUsernameValid(null);
      return;
    }
    if (u.length < 3) {
      setUsernameError('Username must be at least 3 characters.');
      setIsUsernameValid(false);
      return;
    }
    setIsCheckingUsername(true);
    try {
      const taken = await isUsernameTaken(u);
      if (taken) {
        setUsernameError('This username is already taken.');
        setIsUsernameValid(false);
      } else {
        setUsernameError(null);
        setIsUsernameValid(true);
      }
    } catch {
      setUsernameError(null);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  async function handleRegister(): Promise<void> {
    const u = username.trim();
    const e = email.trim();
    const p = password.trim();
    const cp = confirmPassword.trim();

    if (!u || !e || !p || !cp) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (u.length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters.');
      return;
    }
    if (p !== cp) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (p.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    // Double-check username uniqueness immediately before submit
    const taken = await isUsernameTaken(u);
    if (taken) {
      setIsLoading(false);
      setUsernameError('This username is already taken. Please choose another.');
      setIsUsernameValid(false);
      Alert.alert('Username Unavailable', 'This username is already taken. Please choose another one.');
      return;
    }

    const { error } = await signUp({ username: u, email: e, password: p });
    setIsLoading(false);

    if (error) {
      Alert.alert('Registration Failed', error);
    }
    // Navigation handled by the auth guard in _layout.tsx
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appTitle}>📚</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Start planning smarter</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Username</Text>
                {isCheckingUsername ? (
                  <Text style={styles.checkingText}>Checking...</Text>
                ) : isUsernameValid === true ? (
                  <Text style={styles.availableText}>✓ Available</Text>
                ) : isUsernameValid === false ? (
                  <Text style={styles.takenText}>✕ Taken</Text>
                ) : null}
              </View>
              <TextInput
                style={[
                  styles.input,
                  isUsernameValid === false && styles.inputError,
                  isUsernameValid === true && styles.inputSuccess,
                ]}
                value={username}
                onChangeText={(val) => {
                  setUsername(val);
                  setIsUsernameValid(null);
                  setUsernameError(null);
                }}
                onBlur={handleUsernameBlur}
                placeholder="e.g. john_doe"
                placeholderTextColor={COLORS.text.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {usernameError ? (
                <Text style={styles.errorMessage}>{usernameError}</Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@university.edu"
                placeholderTextColor={COLORS.text.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={COLORS.text.muted}
                secureTextEntry
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.text.muted}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  appTitle: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text.primary },
  subtitle: { fontSize: 16, color: COLORS.text.secondary, marginTop: 6 },
  form: { gap: 14 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text.primary,
    backgroundColor: COLORS.surface,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkingText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  availableText: {
    fontSize: 12,
    color: COLORS.status.success,
    fontWeight: '700',
  },
  takenText: {
    fontSize: 12,
    color: COLORS.status.error,
    fontWeight: '700',
  },
  inputError: {
    borderColor: COLORS.status.error,
  },
  inputSuccess: {
    borderColor: COLORS.status.success,
  },
  errorMessage: {
    fontSize: 12,
    color: COLORS.status.error,
    marginTop: 2,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.text.inverse, fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  footerText: { fontSize: 14, color: COLORS.text.secondary },
  footerLink: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
});

