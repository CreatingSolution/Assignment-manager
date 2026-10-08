import type { EntityType, SyncOperation, SyncOperationType } from '../types';

/**
 * Sync queue types and interfaces.
 *
 * These types describe what goes INTO the sync queue.
 * The actual sync engine (Phase 5) reads from this queue and sends
 * batches to the backend's POST /api/sync endpoint.
 */

export interface SyncBatch {
  operations: SyncOperation[];
  clientId: string;
  lastSyncedAt: number | null;
}

export interface SyncBatchResult {
  processed: string[];   // IDs of successfully synced operations
  failed: string[];      // IDs of failed operations
  serverTime: number;    // server's timestamp for next sync marker
}

export interface SyncEngineConfig {
  /** Max operations to send per batch */
  batchSize: number;
  /** Milliseconds between auto-sync attempts */
  autoSyncIntervalMs: number;
  /** Max retry attempts before marking as failed */
  maxRetries: number;
}

export const DEFAULT_SYNC_CONFIG: SyncEngineConfig = {
  batchSize: 50,
  autoSyncIntervalMs: 30_000, // 30 seconds
  maxRetries: 3,
};

export type SyncEventType =
  | 'sync:start'
  | 'sync:complete'
  | 'sync:error'
  | 'sync:progress';

export interface SyncEvent {
  type: SyncEventType;
  processed?: number;
  total?: number;
  error?: string;
}

export type SyncListener = (event: SyncEvent) => void;

