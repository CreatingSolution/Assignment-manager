import { useCallback } from 'react';
import { refreshPendingCount } from '../sync/queue';
import { syncNow } from '../sync/engine';
import { useSyncStore } from '../store/sync.store';
import { useAuth } from './use-auth.hook';

/**
 * Provides sync status and a manual sync trigger.
 */
export function useSync() {
  const { label, pendingCount, lastSyncedAt, error } = useSyncStore();
  const { user } = useAuth();

  const refreshCount = useCallback(() => {
    if (user?.id) refreshPendingCount(user.id);
  }, [user?.id]);

  const triggerSync = useCallback(async () => {
    if (!user?.id) return;
    await syncNow(user.id);
  }, [user?.id]);

  return {
    status: label,
    pendingCount,
    lastSyncedAt,
    error,
    triggerSync,
    refreshCount,
  };
}

