import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const STORAGE_BIOMETRIC_KEY = 'sap:biometric_lock_enabled';

export interface BiometricStatus {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometricType: string;
  isEnabled: boolean;
}

/**
 * Hardware Biometric Authentication Service
 * 
 * Integrates with iOS FaceID / TouchID and Android BiometricPrompt
 * to protect sensitive student records, group tokens, and assignments.
 */
export async function getBiometricStatus(): Promise<BiometricStatus> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType = 'Biometrics';
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'Face ID';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'Fingerprint / Touch ID';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = 'Iris Recognition';
    }

    const enabledRaw = await AsyncStorage.getItem(STORAGE_BIOMETRIC_KEY);
    const isEnabled = enabledRaw === 'true';

    return {
      isAvailable: hasHardware,
      isEnrolled,
      biometricType,
      isEnabled,
    };
  } catch {
    return {
      isAvailable: false,
      isEnrolled: false,
      biometricType: 'None',
      isEnabled: false,
    };
  }
}

/**
 * Toggles whether biometric verification is required for sensitive app sections
 */
export async function setBiometricEnabled(enabled: boolean): Promise<boolean> {
  try {
    if (enabled) {
      // Require an immediate successful scan to verify enrollment before turning it on
      const verified = await promptBiometricAuth('Verify your identity to enable Biometric Lock');
      if (!verified) return false;
    }
    await AsyncStorage.setItem(STORAGE_BIOMETRIC_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers native OS biometric prompt (Face ID / Fingerprint / Device PIN fallback)
 */
export async function promptBiometricAuth(promptMessage = 'Authenticate to access secure workspace'): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      // If hardware is not present or enrolled (e.g. Simulator or unsupported device),
      // allow access gracefully
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Device Passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });

    return result.success;
  } catch {
    // If prompt fails or errors out, fall back safely
    return false;
  }
}

