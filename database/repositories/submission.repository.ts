import type { SQLiteDatabase } from 'expo-sqlite';
import type { Submission } from '../../types';
import { generateId } from '../../utils/id.utils';

interface SubmissionRow {
  id: string;
  assignment_id: string | null;
  group_id: string | null;
  user_id: string;
  title: string;
  deadline: string;
  created_at: number;
  updated_at: number;
  is_synced: number;
}

function mapRow(row: SubmissionRow): Submission {
  return {
    id: row.id,
    assignmentId: row.assignment_id ?? undefined,
    groupId: row.group_id ?? undefined,
    userId: row.user_id,
    title: row.title,
    deadline: row.deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSynced: row.is_synced === 1,
  };
}

export class SubmissionRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findByAssignment(assignmentId: string): Submission[] {
    const rows = this.db.getAllSync<SubmissionRow>(
      'SELECT * FROM submissions WHERE assignment_id = ? ORDER BY deadline ASC',
      [assignmentId]
    );
    return rows.map(mapRow);
  }

  findByGroup(groupId: string): Submission[] {
    const rows = this.db.getAllSync<SubmissionRow>(
      'SELECT * FROM submissions WHERE group_id = ? ORDER BY deadline ASC',
      [groupId]
    );
    return rows.map(mapRow);
  }

  findById(id: string): Submission | null {
    const row = this.db.getFirstSync<SubmissionRow>(
      'SELECT * FROM submissions WHERE id = ?',
      [id]
    );
    return row ? mapRow(row) : null;
  }

  create(input: {
    assignmentId?: string;
    groupId?: string;
    userId: string;
    title: string;
    deadline: string;
  }): Submission {
    const id = generateId();
    const now = Date.now();
    this.db.runSync(
      `INSERT INTO submissions (id, assignment_id, group_id, user_id, title, deadline, created_at, updated_at, is_synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        input.assignmentId ?? null,
        input.groupId ?? null,
        input.userId,
        input.title,
        input.deadline,
        now,
        now,
      ]
    );
    return this.findById(id)!;
  }

  upsert(submission: Submission): void {
    const existing = this.findById(submission.id);
    const now = Date.now();
    if (existing) {
      this.db.runSync(
        `UPDATE submissions SET title = ?, deadline = ?, updated_at = ?, is_synced = 1 WHERE id = ?`,
        [submission.title, submission.deadline, submission.updatedAt || now, submission.id]
      );
    } else {
      this.db.runSync(
        `INSERT INTO submissions (id, assignment_id, group_id, user_id, title, deadline, created_at, updated_at, is_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          submission.id,
          submission.assignmentId ?? null,
          submission.groupId ?? null,
          submission.userId,
          submission.title,
          submission.deadline,
          submission.createdAt,
          submission.updatedAt || now,
        ]
      );
    }
  }

  update(id: string, updates: { title?: string; deadline?: string }): Submission | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = Date.now();
    this.db.runSync(
      `UPDATE submissions SET title = ?, deadline = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
      [
        updates.title !== undefined ? updates.title.trim() : existing.title,
        updates.deadline !== undefined ? updates.deadline : existing.deadline,
        now,
        id,
      ]
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    this.db.withTransactionSync(() => {
      // Unlink tasks referencing this submission
      this.db.runSync('UPDATE tasks SET submission_id = NULL WHERE submission_id = ?', [id]);
      this.db.runSync('UPDATE group_tasks SET submission_id = NULL WHERE submission_id = ?', [id]);
      this.db.runSync('DELETE FROM submissions WHERE id = ?', [id]);
    });
    return true;
  }
}
