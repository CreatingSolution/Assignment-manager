/**
 * Sync module barrel export.
 *
 * Phase 1: Queue management only.
 * Phase 5: sync/engine.ts will be added here for full backend sync.
 */
export {
  addSyncListener,
  emitSyncEvent,
  enqueueOperation,
  getLastSyncedAt,
  getPendingCount,
  getPendingOperations,
  refreshPendingCount,
} from './queue';
export {
  processSyncQueue,
  pullFromFirestore,
  syncNow,
  startSyncEngine,
} from './engine';
export type {
  DEFAULT_SYNC_CONFIG,
  SyncBatch,
  SyncBatchResult,
  SyncEngineConfig,
  SyncEvent,
  SyncEventType,
  SyncListener,
} from './types';

