import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { AuthSession, User } from '../types/auth';

const SECURE_STORE_SESSION_KEY = 'msc_tracker_auth_session_v2';
const USERS_REGISTRY_KEY = '@assignment_tracker/users_registry_v2';

export interface RegisteredUserRecord {
  user: User;
  passwordHash: string;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Pre-seeded Demo MSc Students
export const DEMO_USERS: RegisteredUserRecord[] = [
  {
    user: {
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      username: 'alexturner',
      email: 'alex.turner@msc.ac.uk',
      name: 'Alex Turner',
      avatarColor: '#3B82F6',
      createdAt: 1724918400000,
    },
    passwordHash: 'password123',
  },
  {
    user: {
      id: 'f9e8d7c6-b5a4-4f3e-2d1c-0b9a8f7e6d5c',
      username: 'sarahchen',
      email: 'sarah.chen@msc.ac.uk',
      name: 'Sarah Chen',
      avatarColor: '#8B5CF6',
      createdAt: 1724918400000,
    },
    passwordHash: 'password123',
  },
];

type AuthListener = (session: AuthSession | null) => void;

class AuthService {
  private currentSession: AuthSession | null = null;
  private listeners: Set<AuthListener> = new Set();
  private isInitialized = false;

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentSession);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    });
  }

  public getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  public getCurrentUser(): User | null {
    return this.currentSession?.user || null;
  }

  public getCurrentUserId(): string | null {
    return this.currentSession?.user?.id || null;
  }

  /**
   * Secure Storage abstraction with AsyncStorage fallback for web and unsupported environments.
   */
  private async saveSessionToStorage(session: AuthSession): Promise<void> {
    const raw = JSON.stringify(session);
    try {
      if (Platform.OS !== 'web' && (await SecureStore.isAvailableAsync())) {
        await SecureStore.setItemAsync(SECURE_STORE_SESSION_KEY, raw);
        return;
      }
    } catch (e) {
      console.warn('SecureStore unavailable, falling back to AsyncStorage:', e);
    }
    // Fallback to AsyncStorage
    await AsyncStorage.setItem(SECURE_STORE_SESSION_KEY, raw);
  }

  private async readSessionFromStorage(): Promise<AuthSession | null> {
    try {
      let raw: string | null = null;
      if (Platform.OS !== 'web' && (await SecureStore.isAvailableAsync())) {
        raw = await SecureStore.getItemAsync(SECURE_STORE_SESSION_KEY);
      }
      if (!raw) {
        raw = await AsyncStorage.getItem(SECURE_STORE_SESSION_KEY);
      }
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'token' in parsed &&
          'user' in parsed
        ) {
          return parsed as AuthSession;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to read session from storage:', error);
      return null;
    }
  }

  private async deleteSessionFromStorage(): Promise<void> {
    try {
      if (Platform.OS !== 'web' && (await SecureStore.isAvailableAsync())) {
        await SecureStore.deleteItemAsync(SECURE_STORE_SESSION_KEY);
      }
    } catch (e) {
      console.warn('Error deleting from SecureStore:', e);
    }
    try {
      await AsyncStorage.removeItem(SECURE_STORE_SESSION_KEY);
    } catch (e) {
      console.warn('Error deleting from AsyncStorage:', e);
    }
  }

  /**
   * Loads registered users registry from AsyncStorage, seeding demo users if empty.
   */
  public async getUsersRegistry(): Promise<RegisteredUserRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(USERS_REGISTRY_KEY);
      if (!raw) {
        await AsyncStorage.setItem(
          USERS_REGISTRY_KEY,
          JSON.stringify(DEMO_USERS)
        );
        return DEMO_USERS;
      }
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as RegisteredUserRecord[];
      }
      return DEMO_USERS;
    } catch (error) {
      console.error('Failed to get users registry:', error);
      return DEMO_USERS;
    }
  }

  /**
   * Reads and restores the logged-in session on app launch.
   */
  public async getActiveSession(): Promise<AuthSession | null> {
    try {
      const restored = await this.readSessionFromStorage();
      this.currentSession = restored;
      this.isInitialized = true;
      this.notifyListeners();
      return restored;
    } catch (error) {
      console.error('Failed to get active session:', error);
      this.currentSession = null;
      this.isInitialized = true;
      this.notifyListeners();
      return null;
    }
  }

  /**
   * Backward-compatible alias for getActiveSession.
   */
  public async restoreSession(): Promise<AuthSession | null> {
    return this.getActiveSession();
  }

  /**
   * Validates uniqueness, stores user in local user registry, and generates a session.
   */
  public async register(
    username: string,
    password: string,
    email: string
  ): Promise<AuthSession> {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUsername) {
      throw new Error('Please enter a username.');
    }
    if (trimmedUsername.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const registry = await this.getUsersRegistry();

    const usernameExists = registry.some(
      (r) => r.user.username.toLowerCase() === trimmedUsername.toLowerCase()
    );
    if (usernameExists) {
      throw new Error('This username is already taken. Please choose another.');
    }

    const emailExists = registry.some(
      (r) => r.user.email.toLowerCase() === trimmedEmail
    );
    if (emailExists) {
      throw new Error('An account with this email already exists.');
    }

    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const newUser: User = {
      id: generateUUID(),
      username: trimmedUsername,
      email: trimmedEmail,
      name: trimmedUsername,
      avatarColor,
      createdAt: Date.now(),
    };

    const newRecord: RegisteredUserRecord = {
      user: newUser,
      passwordHash: password,
    };

    const updatedRegistry = [...registry, newRecord];
    await AsyncStorage.setItem(
      USERS_REGISTRY_KEY,
      JSON.stringify(updatedRegistry)
    );

    const session: AuthSession = {
      token: `sess_${newUser.id}_${Date.now()}`,
      user: newUser,
    };

    await this.saveSessionToStorage(session);
    this.currentSession = session;
    this.notifyListeners();
    return session;
  }

  /**
   * Verifies credentials and saves the active session.
   * Supports login with either username or email.
   */
  public async login(
    username: string,
    password: string
  ): Promise<AuthSession> {
    const identifier = username.trim().toLowerCase();

    if (!identifier) {
      throw new Error('Please enter your username or email.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    const registry = await this.getUsersRegistry();

    const record = registry.find(
      (r) =>
        r.user.username.toLowerCase() === identifier ||
        r.user.email.toLowerCase() === identifier
    );

    if (!record) {
      throw new Error('Invalid username/email or password.');
    }

    if (record.passwordHash !== password) {
      throw new Error('Invalid username/email or password.');
    }

    const session: AuthSession = {
      token: `sess_${record.user.id}_${Date.now()}`,
      user: record.user,
    };

    await this.saveSessionToStorage(session);
    this.currentSession = session;
    this.notifyListeners();
    return session;
  }

  /**
   * Clears session tokens from secure storage.
   */
  public async logout(): Promise<void> {
    try {
      await this.deleteSessionFromStorage();
    } catch (error) {
      console.error('Failed to logout session:', error);
    } finally {
      this.currentSession = null;
      this.notifyListeners();
    }
  }

  /**
   * Convenience backward-compatible aliases
   */
  public async signIn(usernameOrEmail: string, password: string): Promise<AuthSession> {
    return this.login(usernameOrEmail, password);
  }

  public async signUp(
    nameOrUsername: string,
    email: string,
    password: string
  ): Promise<AuthSession> {
    return this.register(nameOrUsername, password, email);
  }

  public async signOut(): Promise<void> {
    return this.logout();
  }

  public async signInDemoUser(userId: string): Promise<AuthSession> {
    const demo = DEMO_USERS.find((u) => u.user.id === userId);
    if (!demo) {
      throw new Error('Demo user not found.');
    }
    return this.login(demo.user.username, demo.passwordHash);
  }
}

export const authService = new AuthService();
