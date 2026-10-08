import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPendingMutations } from '../services/storage';
import { syncEngine } from '../services/syncEngine';
import { SyncResult, SyncStatus } from '../types';

export interface UseSyncReturn {
  syncStatus: SyncStatus;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  syncNow: () => Promise<SyncResult>;
  refreshPendingCount: () => Promise<number>;
}

export function useSync(): UseSyncReturn {
  const { user } = useAuth();
  const userId = user?.id;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    syncEngine.getStatus()
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(
    syncEngine.getLastSyncedAt()
  );

  const refreshPendingCount = useCallback(async (): Promise<number> => {
    if (!userId) {
      setPendingCount(0);
      return 0;
    }
    try {
      const pending = await getPendingMutations(userId);
      setPendingCount(pending.length);
      return pending.length;
    } catch {
      return 0;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPendingCount(0);
      return;
    }

    // Initial fetch of pending mutations count for this user
    refreshPendingCount();

    // Start auto sync on network reconnect for this user
    const stopAutoSync = syncEngine.startAutoSync(userId);

    // Subscribe to sync status transitions
    const unsubscribeSync = syncEngine.subscribe((status) => {
      setSyncStatus(status);
      setLastSyncedAt(syncEngine.getLastSyncedAt());
      refreshPendingCount();
    });

    return () => {
      stopAutoSync();
      unsubscribeSync();
    };
  }, [userId, refreshPendingCount]);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (!userId) {
      return {
        success: false,
        syncedCount: 0,
        errors: ['No authenticated user.'],
        timestamp: Date.now(),
      };
    }
    const result = await syncEngine.syncPendingData(userId);
    await refreshPendingCount();
    return result;
  }, [userId, refreshPendingCount]);

  return {
    syncStatus,
    isSyncing: syncStatus === 'syncing',
    pendingCount,
    lastSyncedAt,
    syncNow,
    refreshPendingCount,
  };
}
