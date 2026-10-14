import {
  getAssignmentRepository,
  getCourseRepository,
  getSyncQueueRepository,
  getTaskRepository,
} from '../database';
import { isFirebaseConfigured } from '../services/firebase.config';
import {
  deleteAssignmentFromFirestore,
  deleteCourseFromFirestore,
  deleteTaskFromFirestore,
  fetchRemoteUserData,
  syncAssignmentToFirestore,
  syncCourseToFirestore,
  syncTaskToFirestore,
} from '../services/firestore.service';
import { queryClient } from '../services/query-client';
import { useNetworkStore } from '../store/network.store';
import { useSyncStore } from '../store/sync.store';
import type { Assignment, Course, SyncOperation, Task } from '../types';
import { emitSyncEvent, refreshPendingCount } from './queue';

/**
 * Sync Engine — Bridges local SQLite database with Cloud Firestore.
 *
 * Implements two-way synchronization:
 * 1. Push: Drains local sync_queue mutations to Cloud Firestore.
 * 2. Pull: Downloads remote changes from Firestore and upserts them locally.
 */

let _syncInProgress = false;
let _syncIntervalTimer: ReturnType<typeof setInterval> | null = null;

// ─── Process Pending Queue ───────────────────────────────────────────────────

export async function processSyncQueue(userId: string): Promise<{
  processed: number;
  failed: number;
}> {
  if (!isFirebaseConfigured()) {
    console.log('[SyncEngine] Firebase not configured — skipping remote push.');
    return { processed: 0, failed: 0 };
  }

  const network = useNetworkStore.getState();
  if (!network.isOnline) {
    console.log('[SyncEngine] Device is offline — queue push postponed.');
    return { processed: 0, failed: 0 };
  }

  const queueRepo = getSyncQueueRepository();
  const assignmentRepo = getAssignmentRepository();
  const courseRepo = getCourseRepository();
  const taskRepo = getTaskRepository();

  const pending = queueRepo.findPending(userId);
  if (pending.length === 0) {
    refreshPendingCount(userId);
    return { processed: 0, failed: 0 };
  }

  emitSyncEvent({ type: 'sync:start', total: pending.length });

  let processedCount = 0;
  let failedCount = 0;

  for (const op of pending) {
    try {
      queueRepo.markInProgress(op.id);
      let payload: unknown;
      try {
        payload = JSON.parse(op.payload);
      } catch {
        payload = {};
      }

      switch (op.entityType) {
        case 'assignment': {
          if (op.operation === 'DELETE') {
            await deleteAssignmentFromFirestore(userId, op.entityId);
          } else {
            await syncAssignmentToFirestore(userId, payload as Assignment);
            assignmentRepo.markSynced([op.entityId]);
          }
          break;
        }

        case 'course': {
          if (op.operation === 'DELETE') {
            await deleteCourseFromFirestore(userId, op.entityId);
          } else {
            await syncCourseToFirestore(userId, payload as Course);
            courseRepo.markSynced([op.entityId]);
          }
          break;
        }

        case 'task': {
          const task = payload as Task;
          const assignmentId = task.assignmentId || op.entityId;
          if (op.operation === 'DELETE') {
            await deleteTaskFromFirestore(userId, assignmentId, op.entityId);
          } else {
            await syncTaskToFirestore(userId, assignmentId, task);
            taskRepo.markSynced([op.entityId]);
          }
          break;
        }

        default:
          console.warn(`[SyncEngine] Unhandled entity type: ${op.entityType}`);
      }

      queueRepo.markCompleted(op.id);
      processedCount++;
      emitSyncEvent({ type: 'sync:progress', processed: processedCount, total: pending.length });
    } catch (err: unknown) {
      failedCount++;
      const errorObj = err as { code?: string; message?: string };
      const msg = errorObj.message || String(err);
      if (
        errorObj.code === 'permission-denied' ||
        msg.toLowerCase().includes('permission')
      ) {
        console.warn(
          `[SyncEngine] Firestore permission denied for operation ${op.id}. Changes remain safely saved in local SQLite.`
        );
      } else {
        console.warn(`[SyncEngine] Operation ${op.id} failed:`, msg);
      }
      queueRepo.markFailed(op.id, msg);
    }
  }

  refreshPendingCount(userId);
  return { processed: processedCount, failed: failedCount };
}

// ─── Pull From Firestore ──────────────────────────────────────────────────────

export async function pullFromFirestore(userId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;

  const network = useNetworkStore.getState();
  if (!network.isOnline) return;

  try {
    const remote = await fetchRemoteUserData(userId);

    const assignmentRepo = getAssignmentRepository();
    const courseRepo = getCourseRepository();
    const taskRepo = getTaskRepository();

    // 1. Upsert Courses
    for (const course of remote.courses) {
      courseRepo.upsert(course);
    }

    // 2. Upsert Assignments
    for (const assignment of remote.assignments) {
      assignmentRepo.upsert(assignment);
    }

    // 3. Upsert Tasks
    for (const task of remote.tasks) {
      taskRepo.upsert(task);
    }

    // Invalidate TanStack query cache so UI components refresh with cloud data
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['courses'] });
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const msg = errorObj.message || String(error);
    if (
      errorObj.code === 'permission-denied' ||
      msg.toLowerCase().includes('permission')
    ) {
      console.warn(
        '[SyncEngine] Firestore permission denied. Check Firestore Security Rules in Firebase Console. Local SQLite storage active.'
      );
      useSyncStore.getState().markError('Pending Firestore Rules update in Firebase Console');
    } else {
      console.warn('[SyncEngine] pullFromFirestore:', msg);
    }
  }
}

// ─── Sync Now (Push + Pull) ───────────────────────────────────────────────────

export async function syncNow(userId: string): Promise<void> {
  if (_syncInProgress) return;
  if (!userId) return;

  const syncStore = useSyncStore.getState();
  _syncInProgress = true;
  syncStore.markSyncing();

  try {
    // 1. Push pending local mutations to Firestore
    const result = await processSyncQueue(userId);

    // 2. Pull remote updates from Firestore
    await pullFromFirestore(userId);

    if (result.failed > 0) {
      const isPermissionIssue = getSyncQueueRepository()
        .findFailed(userId)
        .some((f) => f.errorMessage?.toLowerCase().includes('permission'));
      const statusMsg = isPermissionIssue
        ? 'Pending Firestore Rules in Firebase Console'
        : `${result.failed} items pending sync`;
      syncStore.markError(statusMsg);
      emitSyncEvent({ type: 'sync:error', error: statusMsg });
    } else {
      syncStore.markSynced();
      getSyncQueueRepository().setLastSyncedAt(userId, Date.now());
      emitSyncEvent({ type: 'sync:complete' });
    }
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    const msg = errorObj.message || String(error);
    syncStore.markError(msg);
    emitSyncEvent({ type: 'sync:error', error: msg });
  } finally {
    _syncInProgress = false;
  }
}

// ─── Lifecycle & Auto-Sync ────────────────────────────────────────────────────

/**
 * Initializes the background sync engine.
 * Sets up auto-sync on connectivity transitions and periodic sync intervals.
 */
export function startSyncEngine(getUserId: () => string | null): () => void {
  // Listen for network connectivity change
  const unsubNetwork = useNetworkStore.subscribe((state, prevState) => {
    if (state.isOnline && !prevState.isOnline) {
      const uid = getUserId();
      if (uid) {
        console.log('[SyncEngine] Network reconnected — triggering Firestore sync.');
        void syncNow(uid);
      }
    }
  });

  // Periodic auto-sync every 60 seconds when online
  if (_syncIntervalTimer) clearInterval(_syncIntervalTimer);
  _syncIntervalTimer = setInterval(() => {
    const uid = getUserId();
    const network = useNetworkStore.getState();
    if (uid && network.isOnline && !_syncInProgress) {
      void syncNow(uid);
    }
  }, 60_000);

  return () => {
    unsubNetwork();
    if (_syncIntervalTimer) {
      clearInterval(_syncIntervalTimer);
      _syncIntervalTimer = null;
    }
  };
}
