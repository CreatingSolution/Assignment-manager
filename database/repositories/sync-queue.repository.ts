import type { SQLiteDatabase } from 'expo-sqlite';
import type { SyncOperation, SyncOperationType, EntityType } from '../../types';
import { generateId } from '../../utils/id.utils';

interface SyncQueueRow {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: string;
  created_at: number;
  attempt_count: number;
  last_attempted_at: number | null;
  status: string;
  error_message: string | null;
}

function mapRow(row: SyncQueueRow): SyncOperation {
  return {
    id: row.id,
    userId: row.user_id,
    entityType: row.entity_type as EntityType,
    entityId: row.entity_id,
    operation: row.operation as SyncOperationType,
    payload: row.payload,
    createdAt: row.created_at,
    attemptCount: row.attempt_count,
    lastAttemptedAt: row.last_attempted_at ?? undefined,
    status: row.status as SyncOperation['status'],
    errorMessage: row.error_message ?? undefined,
  };
}

export interface EnqueueInput {
  userId: string;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperationType;
  payload: object;
}

export class SyncQueueRepository {
  constructor(private readonly db: SQLiteDatabase) { }

  enqueue(input: EnqueueInput): SyncOperation {
    const id = generateId();
    const now = Date.now();
    this.db.runSync(
      `INSERT INTO sync_queue
         (id, user_id, entity_type, entity_id, operation, payload,
          created_at, attempt_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
      [
        id,
        input.userId,
        input.entityType,
        input.entityId,
        input.operation,
        JSON.stringify(input.payload),
        now,
      ]
    );
    return this.findById(id)!;
  }

  findById(id: string): SyncOperation | null {
    const row = this.db.getFirstSync<SyncQueueRow>(
      'SELECT * FROM sync_queue WHERE id = ?',
      [id]
    );
    return row ? mapRow(row) : null;
  }

  findPending(userId: string): SyncOperation[] {
    const rows = this.db.getAllSync<SyncQueueRow>(
      `SELECT * FROM sync_queue
       WHERE user_id = ? AND status = 'pending'
       ORDER BY created_at ASC`,
      [userId]
    );
    return rows.map(mapRow);
  }

  countPending(userId: string): number {
    const row = this.db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE user_id = ? AND status = 'pending'`,
      [userId]
    );
    return row?.count ?? 0;
  }

  markInProgress(id: string): void {
    this.db.runSync(
      `UPDATE sync_queue SET status = 'in_progress', last_attempted_at = ?, attempt_count = attempt_count + 1 WHERE id = ?`,
      [Date.now(), id]
    );
  }

  markCompleted(id: string): void {
    this.db.runSync(
      `UPDATE sync_queue SET status = 'completed' WHERE id = ?`,
      [id]
    );
  }

  markFailed(id: string, errorMessage: string): void {
    this.db.runSync(
      `UPDATE sync_queue SET status = 'failed', error_message = ? WHERE id = ?`,
      [errorMessage, id]
    );
  }

  findFailed(userId: string): SyncOperation[] {
    const rows = this.db.getAllSync<SyncQueueRow>(
      `SELECT * FROM sync_queue
       WHERE user_id = ? AND status = 'failed'
       ORDER BY created_at ASC`,
      [userId]
    );
    return rows.map(mapRow);
  }

  resetStuck(): void {
    // Reset in_progress items from previous crashed session
    this.db.runSync(
      `UPDATE sync_queue SET status = 'pending' WHERE status = 'in_progress'`
    );
  }

  clearCompleted(userId: string): number {
    const result = this.db.runSync(
      `DELETE FROM sync_queue WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );
    return result.changes;
  }

  // ─── Sync Metadata ──────────────────────────────────────────────────────────

  getMetadata(key: string): string | null {
    const row = this.db.getFirstSync<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?',
      [key]
    );
    return row?.value ?? null;
  }

  setMetadata(key: string, value: string): void {
    this.db.runSync(
      `INSERT INTO sync_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }

  getLastSyncedAt(userId: string): number | null {
    const value = this.getMetadata(`last_synced_at:${userId}`);
    return value ? parseInt(value, 10) : null;
  }

  setLastSyncedAt(userId: string, timestamp: number): void {
    this.setMetadata(`last_synced_at:${userId}`, timestamp.toString());
  }
}

