import type { SQLiteDatabase } from 'expo-sqlite';
import type { Course, CreateCourseInput, UpdateCourseInput } from '../../types';
import { generateId } from '../../utils/id.utils';

/** Raw row shape from SQLite */
interface CourseRow {
  id: string;
  user_id: string;
  code: string;
  title: string;
  color: string;
  created_at: number;
  updated_at: number;
  is_synced: number;
  is_deleted: number;
}

function mapRow(row: CourseRow): Course {
  return {
    id: row.id,
    userId: row.user_id,
    code: row.code,
    title: row.title,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSynced: row.is_synced === 1,
    isDeleted: row.is_deleted === 1,
  };
}

export class CourseRepository {
  constructor(private readonly db: SQLiteDatabase) { }

  findAll(userId: string): Course[] {
    const rows = this.db.getAllSync<CourseRow>(
      'SELECT * FROM courses WHERE user_id = ? AND is_deleted = 0 ORDER BY title ASC',
      [userId]
    );
    return rows.map(mapRow);
  }

  findById(id: string): Course | null {
    const row = this.db.getFirstSync<CourseRow>(
      'SELECT * FROM courses WHERE id = ?',
      [id]
    );
    return row ? mapRow(row) : null;
  }

  create(input: CreateCourseInput): Course {
    const id = generateId();
    const now = Date.now();
    this.db.runSync(
      `INSERT INTO courses (id, user_id, code, title, color, created_at, updated_at, is_synced, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [id, input.userId, input.code, input.title, input.color, now, now]
    );
    return this.findById(id)!;
  }

  update(id: string, updates: UpdateCourseInput): Course | null {
    const current = this.findById(id);
    if (!current) return null;
    const now = Date.now();
    this.db.runSync(
      `UPDATE courses SET
        code       = ?,
        title      = ?,
        color      = ?,
        updated_at = ?,
        is_synced  = 0
       WHERE id = ?`,
      [
        updates.code ?? current.code,
        updates.title ?? current.title,
        updates.color ?? current.color,
        now,
        id,
      ]
    );
    return this.findById(id);
  }

  softDelete(id: string): boolean {
    const result = this.db.runSync(
      'UPDATE courses SET is_deleted = 1, updated_at = ?, is_synced = 0 WHERE id = ?',
      [Date.now(), id]
    );
    return result.changes > 0;
  }

  markSynced(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    this.db.runSync(
      `UPDATE courses SET is_synced = 1 WHERE id IN (${placeholders})`,
      ids
    );
  }

  findUnsynced(userId: string): Course[] {
    const rows = this.db.getAllSync<CourseRow>(
      'SELECT * FROM courses WHERE user_id = ? AND is_synced = 0',
      [userId]
    );
    return rows.map(mapRow);
  }

  upsert(course: Course): void {
    const existing = this.findById(course.id);
    const now = Date.now();
    if (existing) {
      this.db.runSync(
        `UPDATE courses SET
          user_id    = ?,
          code       = ?,
          title      = ?,
          color      = ?,
          created_at = ?,
          updated_at = ?,
          is_synced  = 1,
          is_deleted = ?
         WHERE id = ?`,
        [
          course.userId,
          course.code,
          course.title,
          course.color,
          course.createdAt,
          course.updatedAt || now,
          course.isDeleted ? 1 : 0,
          course.id,
        ]
      );
    } else {
      this.db.runSync(
        `INSERT INTO courses (id, user_id, code, title, color, created_at, updated_at, is_synced, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          course.id,
          course.userId,
          course.code,
          course.title,
          course.color,
          course.createdAt,
          course.updatedAt || now,
          course.isDeleted ? 1 : 0,
        ]
      );
    }
  }
}

