import NetInfo from '@react-native-community/netinfo';
import { Mutation, SyncResult, SyncStatus } from '../types';
import { authService } from './authService';
import {
  getPendingMutations,
  markAssignmentsSynced,
  removeMutations,
} from './storage';

/**
 * Optional Supabase REST endpoint configuration.
 * Toggle ENABLED to true when pointing to a live Supabase backend.
 */
export const CLOUD_SYNC_CONFIG = {
  ENABLED: false,
  SUPABASE_URL: 'https://your-project.supabase.co/rest/v1',
  SUPABASE_ANON_KEY: 'your-anon-key',
};

type SyncListener = (status: SyncStatus) => void;

class SyncEngine {
  private currentStatus: SyncStatus = 'idle';
  private listeners: Set<SyncListener> = new Set();
  private isProcessing = false;
  private lastSyncedAt: number | null = null;
  private unsubscribeNetInfo: (() => void) | null = null;

  public getStatus(): SyncStatus {
    return this.currentStatus;
  }

  public getLastSyncedAt(): number | null {
    return this.lastSyncedAt;
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(status: SyncStatus): void {
    this.currentStatus = status;
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  public async isConnectedToInternet(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return Boolean(
        state.isConnected &&
          (state.isInternetReachable === null || state.isInternetReachable)
      );
    } catch (error) {
      console.error('Error checking internet connectivity:', error);
      return false;
    }
  }

  private async sendMutationToCloud(
    mutation: Mutation,
    sessionToken?: string
  ): Promise<boolean> {
    if (CLOUD_SYNC_CONFIG.ENABLED) {
      const table = mutation.entity === 'assignment' ? 'assignments' : 'modules';
      const endpoint = `${CLOUD_SYNC_CONFIG.SUPABASE_URL}/${table}`;

      let method = 'POST';
      let url = endpoint;
      let body: string | undefined = JSON.stringify(mutation.data);

      if (mutation.type === 'UPDATE') {
        method = 'PATCH';
        const entityId =
          typeof mutation.data === 'object' && mutation.data !== null && 'id' in mutation.data
            ? (mutation.data as { id: string }).id
            : '';
        url = `${endpoint}?id=eq.${entityId}`;
      } else if (mutation.type === 'DELETE') {
        method = 'DELETE';
        const entityId =
          typeof mutation.data === 'object' && mutation.data !== null && 'id' in mutation.data
            ? (mutation.data as { id: string }).id
            : '';
        url = `${endpoint}?id=eq.${entityId}`;
        body = undefined;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: CLOUD_SYNC_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${sessionToken || CLOUD_SYNC_CONFIG.SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
      };

      const response = await fetch(url, {
        method,
        headers,
        body,
      });

      if (!response.ok) {
        throw new Error(`Cloud sync error (${response.status}): ${await response.text()}`);
      }

      return true;
    }

    // Offline simulation delay
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (!mutation.id || !mutation.type || !mutation.entity) {
      throw new Error(`Invalid mutation payload: ${mutation.id}`);
    }

    return true;
  }

  /**
   * Reads pending mutations from the user-scoped outbox queue in AsyncStorage,
   * sends them to the cloud API, marks local items as isSynced = true,
   * and removes processed mutations from the outbox queue.
   */
  public async syncPendingData(userId?: string): Promise<SyncResult> {
    const activeUserId = userId || authService.getCurrentUserId() || 'global';

    if (this.isProcessing) {
      return {
        success: false,
        syncedCount: 0,
        errors: ['Sync already in progress'],
        timestamp: Date.now(),
      };
    }

    const isOnline = await this.isConnectedToInternet();
    if (!isOnline) {
      this.setStatus('idle');
      return {
        success: false,
        syncedCount: 0,
        errors: ['Device is offline. Sync deferred.'],
        timestamp: Date.now(),
      };
    }

    this.isProcessing = true;
    this.setStatus('syncing');

    try {
      const pendingMutations = await getPendingMutations(activeUserId);
      const session = authService.getCurrentSession();

      if (pendingMutations.length === 0) {
        this.setStatus('synced');
        this.lastSyncedAt = Date.now();
        this.isProcessing = false;
        return {
          success: true,
          syncedCount: 0,
          timestamp: Date.now(),
        };
      }

      const syncedMutationIds: string[] = [];
      const syncedAssignmentIds: string[] = [];
      const errors: string[] = [];

      for (const mutation of pendingMutations) {
        try {
          const success = await this.sendMutationToCloud(mutation, session?.token);
          if (success) {
            syncedMutationIds.push(mutation.id);

            if (
              mutation.entity === 'assignment' &&
              mutation.data &&
              typeof mutation.data === 'object' &&
              'id' in mutation.data &&
              typeof (mutation.data as { id: unknown }).id === 'string'
            ) {
              syncedAssignmentIds.push((mutation.data as { id: string }).id);
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown mutation error';
          errors.push(`Mutation ${mutation.id}: ${message}`);
        }
      }

      if (syncedAssignmentIds.length > 0) {
        await markAssignmentsSynced(syncedAssignmentIds, activeUserId);
      }

      if (syncedMutationIds.length > 0) {
        await removeMutations(syncedMutationIds, activeUserId);
      }

      const isAllSuccess = errors.length === 0;
      this.setStatus(isAllSuccess ? 'synced' : 'error');
      if (isAllSuccess) {
        this.lastSyncedAt = Date.now();
      }

      return {
        success: isAllSuccess,
        syncedCount: syncedMutationIds.length,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: Date.now(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      this.setStatus('error');
      return {
        success: false,
        syncedCount: 0,
        errors: [message],
        timestamp: Date.now(),
      };
    } finally {
      this.isProcessing = false;
    }
  }

  public startAutoSync(userId?: string): () => void {
    if (this.unsubscribeNetInfo) {
      return this.unsubscribeNetInfo;
    }

    let wasOffline = false;

    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(
        state.isConnected &&
          (state.isInternetReachable === null || state.isInternetReachable)
      );

      if (isOnline) {
        if (wasOffline) {
          this.syncPendingData(userId).catch((err) => {
            console.error('Auto sync on reconnection failed:', err);
          });
        }
        wasOffline = false;
      } else {
        wasOffline = true;
      }
    });

    return () => {
      if (this.unsubscribeNetInfo) {
        this.unsubscribeNetInfo();
        this.unsubscribeNetInfo = null;
      }
    };
  }
}

export const syncEngine = new SyncEngine();

export async function syncPendingData(userId?: string): Promise<SyncResult> {
  return syncEngine.syncPendingData(userId);
}
