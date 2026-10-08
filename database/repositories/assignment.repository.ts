import type { SQLiteDatabase } from 'expo-sqlite';
import type { Assignment, CreateAssignmentInput, UpdateAssignmentInput } from '../../types';
import { generateId } from '../../utils/id.utils';

interface AssignmentRow {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  source_url: string | null;
  priority: string;
  total_marks: number | null;
  deadline: string;
  estimated_hours: number | null;
  status: string;
  created_at: number;
  updated_at: number;
  is_synced: number;
  is_deleted: number;
}

function mapRow(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id ?? '',
    title: row.title,
    description: row.description ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    priority: row.priority as Assignment['priority'],
    totalMarks: row.total_marks ?? undefined,
    deadline: row.deadline,
    estimatedHours: row.estimated_hours ?? undefined,
    status: row.status as Assignment['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSynced: row.is_synced === 1,
    isDeleted: row.is_deleted === 1,
  };
}

export class AssignmentRepository {
  constructor(private readonly db: SQLiteDatabase) { }

  findAll(userId: string): Assignment[] {
    const rows = this.db.getAllSync<AssignmentRow>(
      `SELECT * FROM assignments
       WHERE user_id = ? AND is_deleted = 0
       ORDER BY deadline ASC`,
      [userId]
    );
    return rows.map(mapRow);
  }

  findById(id: string): Assignment | null {
    const row = this.db.getFirstSync<AssignmentRow>(
      'SELECT * FROM assignments WHERE id = ?',
      [id]
    );
    return row ? mapRow(row) : null;
  }

  findByCourse(courseId: string, userId: string): Assignment[] {
    const rows = this.db.getAllSync<AssignmentRow>(
      `SELECT * FROM assignments
       WHERE course_id = ? AND user_id = ? AND is_deleted = 0
       ORDER BY deadline ASC`,
      [courseId, userId]
    );
    return rows.map(mapRow);
  }

  create(input: CreateAssignmentInput): Assignment {
    const id = generateId();
    const now = Date.now();
    this.db.runSync(
      `INSERT INTO assignments
         (id, user_id, course_id, title, description, source_url, priority,
          total_marks, deadline, estimated_hours, status,
          created_at, updated_at, is_synced, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        id,
        input.userId,
        input.courseId ?? null,
        input.title,
        input.description ?? null,
        input.sourceUrl ?? null,
        input.priority,
        input.totalMarks ?? null,
        input.deadline,
        input.estimatedHours ?? null,
        input.status,
        now,
        now,
      ]
    );
    return this.findById(id)!;
  }

  update(id: string, updates: UpdateAssignmentInput): Assignment | null {
    const current = this.findById(id);
    if (!current) return null;
    const now = Date.now();
    this.db.runSync(
      `UPDATE assignments SET
        course_id       = ?,
        title           = ?,
        description     = ?,
        source_url      = ?,
        priority        = ?,
        total_marks     = ?,
        deadline        = ?,
        estimated_hours = ?,
        status          = ?,
        updated_at      = ?,
        is_synced       = 0
       WHERE id = ?`,
      [
        updates.courseId ?? current.courseId ?? null,
        updates.title ?? current.title,
        updates.description ?? current.description ?? null,
        updates.sourceUrl ?? current.sourceUrl ?? null,
        updates.priority ?? current.priority,
        updates.totalMarks ?? current.totalMarks ?? null,
        updates.deadline ?? current.deadline,
        updates.estimatedHours ?? current.estimatedHours ?? null,
        updates.status ?? current.status,
        now,
        id,
      ]
    );
    return this.findById(id);
  }

  softDelete(id: string): boolean {
    const result = this.db.runSync(
      'UPDATE assignments SET is_deleted = 1, updated_at = ?, is_synced = 0 WHERE id = ?',
      [Date.now(), id]
    );
    return result.changes > 0;
  }

  markSynced(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    this.db.runSync(
      `UPDATE assignments SET is_synced = 1 WHERE id IN (${placeholders})`,
      ids
    );
  }

  findUnsynced(userId: string): Assignment[] {
    const rows = this.db.getAllSync<AssignmentRow>(
      'SELECT * FROM assignments WHERE user_id = ? AND is_synced = 0',
      [userId]
    );
    return rows.map(mapRow);
  }

  countByStatus(userId: string): Record<string, number> {
    const rows = this.db.getAllSync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count
       FROM assignments
       WHERE user_id = ? AND is_deleted = 0
       GROUP BY status`,
      [userId]
    );
    const result: Record<string, number> = { pending: 0, in_progress: 0, completed: 0 };
    for (const row of rows) {
      result[row.status] = row.count;
    }
    return result;
  }

  upsert(assignment: Assignment): void {
    const existing = this.findById(assignment.id);
    if (existing) {
      this.db.runSync(
        `UPDATE assignments SET
          user_id         = ?,
          course_id       = ?,
          title           = ?,
          description     = ?,
          source_url      = ?,
          priority        = ?,
          total_marks     = ?,
          deadline        = ?,
          estimated_hours = ?,
          status          = ?,
          created_at      = ?,
          updated_at      = ?,
          is_synced       = 1,
          is_deleted      = ?
         WHERE id = ?`,
        [
          assignment.userId,
          assignment.courseId || null,
          assignment.title,
          assignment.description ?? null,
          assignment.sourceUrl ?? null,
          assignment.priority,
          assignment.totalMarks ?? null,
          assignment.deadline,
          assignment.estimatedHours ?? null,
          assignment.status,
          assignment.createdAt,
          assignment.updatedAt,
          assignment.isDeleted ? 1 : 0,
          assignment.id,
        ]
      );
    } else {
      this.db.runSync(
        `INSERT INTO assignments
           (id, user_id, course_id, title, description, source_url, priority,
            total_marks, deadline, estimated_hours, status,
            created_at, updated_at, is_synced, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          assignment.id,
          assignment.userId,
          assignment.courseId || null,
          assignment.title,
          assignment.description ?? null,
          assignment.sourceUrl ?? null,
          assignment.priority,
          assignment.totalMarks ?? null,
          assignment.deadline,
          assignment.estimatedHours ?? null,
          assignment.status,
          assignment.createdAt,
          assignment.updatedAt,
          assignment.isDeleted ? 1 : 0,
        ]
      );
    }
  }
}

