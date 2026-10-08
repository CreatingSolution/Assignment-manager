/**
 * Application-wide constants for the Smart Assignment Planner.
 */

// ─── API ──────────────────────────────────────────────────────────────────────

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api';

// ─── Storage Keys (AsyncStorage / SecureStore) ────────────────────────────────

export const STORAGE_KEYS = {
  AUTH_SESSION: 'sap:auth_session_v1',
  USERS_REGISTRY: 'sap:users_registry_v1',
  SYNC_LAST_AT: 'sap:sync_last_at',
} as const;

// ─── Database ─────────────────────────────────────────────────────────────────

export const DATABASE_NAME = 'smart-assignment-planner.db';
export const DATABASE_VERSION = 1;

// ─── Priority ─────────────────────────────────────────────────────────────────

export const PRIORITY_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
} as const;

export const PRIORITY_COLORS = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
} as const;

// ─── Sync ─────────────────────────────────────────────────────────────────────

export const SYNC_MAX_RETRIES = 3;
export const SYNC_RETRY_DELAY_MS = 2000;

// ─── Rewards ──────────────────────────────────────────────────────────────────

export const LOCKED_FEATURES = {
  BACKGROUND_THEME: { id: 'background_theme', cost: 10, label: 'Background Theme' },
  DOCUMENT_SCAN: { id: 'document_scan', cost: 20, label: 'Document Scan & Extract' },
  AUTO_TODO: { id: 'auto_todo', cost: 50, label: 'Auto-generated TODO List' },
  CUSTOM_TODO: { id: 'custom_todo', cost: 20, label: 'Customize Auto-generated TODO' },
} as const;

// ─── Groups ───────────────────────────────────────────────────────────────────

export const GROUP_TOKEN_LENGTH = 6;

// ─── Notifications ────────────────────────────────────────────────────────────

export const NOTIFICATION_DAYS_BEFORE = [3, 2, 0] as const; // 0 = deadline day

// ─── UI ───────────────────────────────────────────────────────────────────────

export const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    muted: '#94A3B8',
    inverse: '#FFFFFF',
  },
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  online: '#10B981',
  offline: '#EF4444',
  syncing: '#F59E0B',
} as const;

export const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981',
  '#F59E0B', '#EC4899', '#06B6D4',
] as const;

