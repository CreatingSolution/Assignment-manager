import type { SQLiteDatabase } from 'expo-sqlite';
import type { Assignment, AttachmentItem, CreateAssignmentInput, UpdateAssignmentInput } from '../../types';
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
  estimated_days: number | null;
  hours_per_day: number | null;
  attachments: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  is_synced: number;
  is_deleted: number;
}

function mapRow(row: AssignmentRow): Assignment {
  let parsedAttachments: AttachmentItem[] | undefined = undefined;
  if (row.attachments) {
    try {
      parsedAttachments = JSON.parse(row.attachments);
    } catch {
      parsedAttachments = undefined;
    }
  }

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
    estimatedDays: row.estimated_days ?? undefined,
    hoursPerDay: row.hours_per_day ?? undefined,
    attachments: parsedAttachments,
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
          total_marks, deadline, estimated_hours, estimated_days, hours_per_day, attachments, status,
          created_at, updated_at, is_synced, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
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
        input.estimatedDays ?? null,
        input.hoursPerDay ?? null,
        input.attachments && input.attachments.length > 0 ? JSON.stringify(input.attachments) : null,
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

    const updatedAttachments = updates.attachments !== undefined
      ? (updates.attachments && updates.attachments.length > 0 ? JSON.stringify(updates.attachments) : null)
      : (current.attachments && current.attachments.length > 0 ? JSON.stringify(current.attachments) : null);

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
        estimated_days  = ?,
        hours_per_day   = ?,
        attachments     = ?,
        status          = ?,
        updated_at      = ?,
        is_synced       = 0
       WHERE id = ?`,
      [
        updates.courseId !== undefined ? (updates.courseId || null) : (current.courseId || null),
        updates.title ?? current.title,
        updates.description !== undefined ? (updates.description || null) : (current.description || null),
        updates.sourceUrl !== undefined ? (updates.sourceUrl || null) : (current.sourceUrl || null),
        updates.priority ?? current.priority,
        updates.totalMarks !== undefined ? updates.totalMarks : (current.totalMarks ?? null),
        updates.deadline ?? current.deadline,
        updates.estimatedHours !== undefined ? updates.estimatedHours : (current.estimatedHours ?? null),
        updates.estimatedDays !== undefined ? updates.estimatedDays : (current.estimatedDays ?? null),
        updates.hoursPerDay !== undefined ? updates.hoursPerDay : (current.hoursPerDay ?? null),
        updatedAttachments,
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
    const attachmentsStr = assignment.attachments && assignment.attachments.length > 0
      ? JSON.stringify(assignment.attachments)
      : null;

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
          estimated_days  = ?,
          hours_per_day   = ?,
          attachments     = ?,
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
          assignment.estimatedDays ?? null,
          assignment.hoursPerDay ?? null,
          attachmentsStr,
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
            total_marks, deadline, estimated_hours, estimated_days, hours_per_day, attachments, status,
            created_at, updated_at, is_synced, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
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
          assignment.estimatedDays ?? null,
          assignment.hoursPerDay ?? null,
          attachmentsStr,
          assignment.status,
          assignment.createdAt,
          assignment.updatedAt,
          assignment.isDeleted ? 1 : 0,
        ]
      );
    }
  }
}

