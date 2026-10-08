import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { generateId } from '../utils/id.utils';
import { STORAGE_KEYS, AVATAR_COLORS } from '../constants';
import type { AuthSession, User } from '../types/auth';
import { firebaseAuth, isFirebaseConfigured } from './firebase.config';
import {
  saveUserProfileToFirestore,
  fetchUserProfileFromFirestore,
  checkFirestoreUsernameTaken,
} from './firestore.service';
import { getDatabase } from '../database';

/**
 * Auth Service
 *
 * Supports Firebase Authentication + Firestore User Profiles when configured,
 * with automatic fallback to local AsyncStorage/SecureStore for offline development.
 */

interface StoredUser extends User {
  passwordHash: string;
}

interface UsersRegistry {
  users: StoredUser[];
}

export async function saveUserToLocalDatabase(user: User): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO users (id, username, email, name, avatar_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         email = excluded.email,
         name = excluded.name,
         avatar_color = excluded.avatar_color;`,
      [
        user.id,
        user.username,
        user.email,
        user.name ?? null,
        user.avatarColor ?? '#3B82F6',
        user.createdAt || Date.now(),
      ]
    );
  } catch (err) {
    console.warn('[AuthService] Could not save user to local SQLite:', err);
  }
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const clean = username.trim().toLowerCase();
  if (!clean) return false;

  // 1. Check local SQLite users table
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM users WHERE LOWER(username) = LOWER(?);',
      [clean]
    );
    if (row && row.count > 0) return true;
  } catch {
    // ignore
  }

  // 2. Check local registry (AsyncStorage fallback)
  const registry = await getRegistry();
  if (registry.users.some((u) => u.username.toLowerCase() === clean)) {
    return true;
  }

  // 3. Check Firestore
  if (isFirebaseConfigured()) {
    try {
      const taken = await checkFirestoreUsernameTaken(clean);
      if (taken) return true;
    } catch {
      // offline fallback
    }
  }

  return false;
}

// ─── Session Persistence ──────────────────────────────────────────────────────

export async function getStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_SESSION);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (!raw) return null;
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }
}

export async function saveSession(session: AuthSession): Promise<void> {
  const raw = JSON.stringify(session);
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_SESSION, raw);
  } catch {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_SESSION, raw);
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_SESSION);
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  } catch {
    // ignore
  }
}

// ─── Local User Registry (Fallback) ───────────────────────────────────────────

async function getRegistry(): Promise<UsersRegistry> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USERS_REGISTRY);
    if (!raw) return { users: [] };
    return JSON.parse(raw) as UsersRegistry;
  } catch {
    return { users: [] };
  }
}

async function saveRegistry(registry: UsersRegistry): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.USERS_REGISTRY, JSON.stringify(registry));
}

// ─── Auth Operations ──────────────────────────────────────────────────────────

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  session: AuthSession | null;
  error: string | null;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] ?? '#3B82F6';
  const now = Date.now();

  // 0. Ensure username is unique before proceeding
  const taken = await isUsernameTaken(input.username);
  if (taken) {
    return { session: null, error: 'This username is already taken. Please choose another username.' };
  }

  // 1. Try Firebase Auth if configured
  if (isFirebaseConfigured() && firebaseAuth) {
    try {
      const cred = await createUserWithEmailAndPassword(
        firebaseAuth,
        input.email.trim(),
        input.password
      );

      const user: User = {
        id: cred.user.uid,
        username: input.username.trim(),
        email: input.email.trim().toLowerCase(),
        name: input.name?.trim(),
        avatarColor: color,
        createdAt: now,
      };

      // Save user profile in Firestore
      try {
        await saveUserProfileToFirestore(user);
      } catch (err) {
        console.warn('[AuthService] Failed to save profile to Firestore:', err);
      }

      // Save to local SQLite database
      await saveUserToLocalDatabase(user);

      const token = await cred.user.getIdToken();
      const session: AuthSession = {
        token,
        user,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      };

      await saveSession(session);
      return { session, error: null };
    } catch (firebaseErr: unknown) {
      const err = firebaseErr as { code?: string; message?: string };
      if (err.code === 'auth/email-already-in-use') {
        return { session: null, error: 'An account with this email already exists in Firebase.' };
      }
      if (err.code === 'auth/weak-password') {
        return { session: null, error: 'Password should be at least 6 characters.' };
      }
      if (err.code === 'auth/invalid-email') {
        return { session: null, error: 'Invalid email address.' };
      }
      return { session: null, error: err.message ?? 'Firebase registration failed.' };
    }
  }

  // 2. Fallback to Local Auth (offline / no .env configured)
  const registry = await getRegistry();

  if (registry.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    return { session: null, error: 'An account with this email already exists.' };
  }

  if (registry.users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
    return { session: null, error: 'This username is already taken. Please choose another username.' };
  }

  const newUser: StoredUser = {
    id: generateId(),
    username: input.username.trim(),
    email: input.email.trim().toLowerCase(),
    name: input.name?.trim(),
    avatarColor: color,
    createdAt: now,
    passwordHash: input.password,
  };

  registry.users.push(newUser);
  await saveRegistry(registry);

  const { passwordHash: _ph, ...user } = newUser;

  // Save to local SQLite database
  await saveUserToLocalDatabase(user);

  const session: AuthSession = {
    token: `local-token-${newUser.id}`,
    user,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
  };

  await saveSession(session);
  return { session, error: null };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const now = Date.now();

  // 1. Try Firebase Auth if configured
  if (isFirebaseConfigured() && firebaseAuth) {
    try {
      const cred = await signInWithEmailAndPassword(
        firebaseAuth,
        input.email.trim(),
        input.password
      );

      // Try fetching profile from Firestore
      let user: User | null = null;
      try {
        user = await fetchUserProfileFromFirestore(cred.user.uid);
      } catch (err) {
        console.warn('[AuthService] Could not fetch Firestore profile:', err);
      }

      if (!user) {
        user = {
          id: cred.user.uid,
          username: cred.user.displayName || input.email.split('@')[0] || 'User',
          email: input.email.trim().toLowerCase(),
          avatarColor: AVATAR_COLORS[0] ?? '#3B82F6',
          createdAt: now,
        };
      }

      const token = await cred.user.getIdToken();
      const session: AuthSession = {
        token,
        user,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      };

      await saveUserToLocalDatabase(user);
      await saveSession(session);
      return { session, error: null };
    } catch (firebaseErr: unknown) {
      const err = firebaseErr as { code?: string; message?: string };
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        return { session: null, error: 'Invalid email or password.' };
      }
      return { session: null, error: err.message ?? 'Firebase sign in failed.' };
    }
  }

  // 2. Fallback to Local Auth
  const registry = await getRegistry();
  const found = registry.users.find(
    (u) => u.email.toLowerCase() === input.email.toLowerCase()
  );

  if (!found || found.passwordHash !== input.password) {
    return { session: null, error: 'Invalid email or password.' };
  }

  const { passwordHash: _ph, ...user } = found;
  const session: AuthSession = {
    token: `local-token-${found.id}`,
    user,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
  };

  await saveUserToLocalDatabase(user);
  await saveSession(session);
  return { session, error: null };
}

export async function logout(): Promise<void> {
  if (isFirebaseConfigured() && firebaseAuth) {
    try {
      await signOut(firebaseAuth);
    } catch (e) {
      console.warn('[AuthService] Firebase signOut warning:', e);
    }
  }
  await clearSession();
}

