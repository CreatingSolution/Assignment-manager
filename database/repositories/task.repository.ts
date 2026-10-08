import type { SQLiteDatabase } from 'expo-sqlite';
import type { CreateTaskInput, Task, UpdateTaskInput } from '../../types';
import { generateId } from '../../utils/id.utils';

interface TaskRow {
  id: string;
  assignment_id: string;
  submission_id: string | null;
  user_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  estimated_hours: number | null;
  status: string;
  order_index: number;
  created_at: number;
  updated_at: number;
  is_synced: number;
  is_deleted: number;
}

function mapRow(row: TaskRow): Task {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    submissionId: row.submission_id ?? undefined,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? undefined,
    targetDate: row.target_date ?? undefined,
    estimatedHours: row.estimated_hours ?? undefined,
    status: row.status as Task['status'],
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSynced: row.is_synced === 1,
    isDeleted: row.is_deleted === 1,
  };
}

export class TaskRepository {
  constructor(private readonly db: SQLiteDatabase) { }

  findByAssignment(assignmentId: string): Task[] {
    const rows = this.db.getAllSync<TaskRow>(
      `SELECT * FROM tasks
       WHERE assignment_id = ? AND is_deleted = 0
       ORDER BY order_index ASC, created_at ASC`,
      [assignmentId]
    );
    return rows.map(mapRow);
  }

  findById(id: string): Task | null {
    const row = this.db.getFirstSync<TaskRow>(
      'SELECT * FROM tasks WHERE id = ?',
      [id]
    );
    return row ? mapRow(row) : null;
  }

  create(input: CreateTaskInput): Task {
    const id = generateId();
    const now = Date.now();
    this.db.runSync(
      `INSERT INTO tasks
         (id, assignment_id, submission_id, user_id, title, description,
          target_date, estimated_hours, status, order_index,
          created_at, updated_at, is_synced, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        id,
        input.assignmentId,
        input.submissionId ?? null,
        input.userId,
        input.title,
        input.description ?? null,
        input.targetDate ?? null,
        input.estimatedHours ?? null,
        input.status,
        input.orderIndex,
        now,
        now,
      ]
    );
    return this.findById(id)!;
  }

  update(id: string, updates: UpdateTaskInput): Task | null {
    const current = this.findById(id);
    if (!current) return null;
    const now = Date.now();
    this.db.runSync(
      `UPDATE tasks SET
        title           = ?,
        description     = ?,
        target_date     = ?,
        estimated_hours = ?,
        status          = ?,
        order_index     = ?,
        updated_at      = ?,
        is_synced       = 0
       WHERE id = ?`,
      [
        updates.title ?? current.title,
        updates.description ?? current.description ?? null,
        updates.targetDate ?? current.targetDate ?? null,
        updates.estimatedHours ?? current.estimatedHours ?? null,
        updates.status ?? current.status,
        updates.orderIndex ?? current.orderIndex,
        now,
        id,
      ]
    );
    return this.findById(id);
  }

  softDelete(id: string): boolean {
    const result = this.db.runSync(
      'UPDATE tasks SET is_deleted = 1, updated_at = ?, is_synced = 0 WHERE id = ?',
      [Date.now(), id]
    );
    return result.changes > 0;
  }

  markSynced(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    this.db.runSync(
      `UPDATE tasks SET is_synced = 1 WHERE id IN (${placeholders})`,
      ids
    );
  }

  reorder(taskIds: string[]): void {
    this.db.withTransactionSync(() => {
      taskIds.forEach((id, index) => {
        this.db.runSync(
          'UPDATE tasks SET order_index = ? WHERE id = ?',
          [index, id]
        );
      });
    });
  }

  upsert(task: Task): void {
    const existing = this.findById(task.id);
    const now = Date.now();
    if (existing) {
      this.db.runSync(
        `UPDATE tasks SET
          assignment_id   = ?,
          submission_id   = ?,
          user_id         = ?,
          title           = ?,
          description     = ?,
          target_date     = ?,
          estimated_hours = ?,
          status          = ?,
          order_index     = ?,
          created_at      = ?,
          updated_at      = ?,
          is_synced       = 1,
          is_deleted      = ?
         WHERE id = ?`,
        [
          task.assignmentId,
          task.submissionId ?? null,
          task.userId,
          task.title,
          task.description ?? null,
          task.targetDate ?? null,
          task.estimatedHours ?? null,
          task.status,
          task.orderIndex,
          task.createdAt,
          task.updatedAt || now,
          task.isDeleted ? 1 : 0,
          task.id,
        ]
      );
    } else {
      this.db.runSync(
        `INSERT INTO tasks
           (id, assignment_id, submission_id, user_id, title, description,
            target_date, estimated_hours, status, order_index,
            created_at, updated_at, is_synced, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          task.id,
          task.assignmentId,
          task.submissionId ?? null,
          task.userId,
          task.title,
          task.description ?? null,
          task.targetDate ?? null,
          task.estimatedHours ?? null,
          task.status,
          task.orderIndex,
          task.createdAt,
          task.updatedAt || now,
          task.isDeleted ? 1 : 0,
        ]
      );
    }
  }
}

