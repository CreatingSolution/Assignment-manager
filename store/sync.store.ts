import { create } from 'zustand';
import type { NetworkStatusLabel, SyncState } from '../types';

interface SyncStore extends SyncState {
  setLabel: (label: NetworkStatusLabel) => void;
  setPendingCount: (count: number) => void;
  setLastSyncedAt: (ts: number | null) => void;
  setError: (error: string | null) => void;
  markSyncing: () => void;
  markSynced: () => void;
  markError: (error: string) => void;
  markOffline: () => void;
  markOnline: () => void;
}

/**
 * Zustand store for synchronization status.
 * Drives the status bar that shows ONLINE / OFFLINE / SYNCING / SYNCED / SYNC_ERROR.
 */
export const useSyncStore = create<SyncStore>((set) => ({
  label: 'ONLINE',
  pendingCount: 0,
  lastSyncedAt: null,
  error: null,

  setLabel: (label) => set({ label }),

  setPendingCount: (count) => set({ pendingCount: count }),

  setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),

  setError: (error) => set({ error }),

  markSyncing: () => set({ label: 'SYNCING', error: null }),

  markSynced: () =>
    set({ label: 'SYNCED', pendingCount: 0, lastSyncedAt: Date.now(), error: null }),

  markError: (error) => set({ label: 'SYNC_ERROR', error }),

  markOffline: () => set({ label: 'OFFLINE', error: null }),

  markOnline: () =>
    set((state) => ({
      label: state.pendingCount > 0 ? 'SYNCING' : 'ONLINE',
      error: null,
    })),
}));

