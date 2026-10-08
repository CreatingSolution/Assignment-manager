import { getSyncQueueRepository } from '../database';
import { useSyncStore } from '../store/sync.store';
import type { EntityType, SyncOperation, SyncOperationType } from '../types';
import type { SyncListener } from './types';

/**
 * Sync Queue Manager
 *
 * Phase 1: Manages the local sync queue (add, count, list pending).
 * Phase 5: The full sync engine will be added here — it reads from this
 *          queue and POSTs batches to the backend's /api/sync endpoint.
 *
 * IMPORTANT: This file does NOT perform any network requests.
 * The sync engine (Phase 5) will be implemented in sync/engine.ts.
 */

export interface EnqueueOptions {
  userId: string;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperationType;
  payload: object;
}

/**
 * Adds an operation to the local sync queue.
 * Call this after every successful local DB write.
 */
export function enqueueOperation(options: EnqueueOptions): SyncOperation {
  const repo = getSyncQueueRepository();
  const op = repo.enqueue({
    userId: options.userId,
    entityType: options.entityType,
    entityId: options.entityId,
    operation: options.operation,
    payload: options.payload,
  });

  // Update the sync store pending count
  refreshPendingCount(options.userId);

  return op;
}

/**
 * Returns all pending sync operations for a user.
 */
export function getPendingOperations(userId: string): SyncOperation[] {
  return getSyncQueueRepository().findPending(userId);
}

/**
 * Updates the pending count in the sync store.
 */
export function refreshPendingCount(userId: string): void {
  const count = getSyncQueueRepository().countPending(userId);
  useSyncStore.getState().setPendingCount(count);
}

/**
 * Returns the pending operation count for a user.
 */
export function getPendingCount(userId: string): number {
  return getSyncQueueRepository().countPending(userId);
}

/**
 * Returns the last synced timestamp for a user.
 */
export function getLastSyncedAt(userId: string): number | null {
  return getSyncQueueRepository().getLastSyncedAt(userId);
}

// ─── Listeners (used by Phase 5 sync engine) ──────────────────────────────────

const _listeners = new Set<SyncListener>();

export function addSyncListener(listener: SyncListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

export function emitSyncEvent(event: Parameters<SyncListener>[0]): void {
  _listeners.forEach((l) => l(event));
}

