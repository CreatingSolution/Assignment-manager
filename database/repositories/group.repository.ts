import type { SQLiteDatabase } from 'expo-sqlite';
import type { Group, GroupMember, GroupTask, Priority, TaskStatus } from '../../types';
import { generateId } from '../../utils/id.utils';

export interface GroupWithMeta extends Group {
  isAdmin: boolean;
  memberCount: number;
  pendingRequestsCount: number;
}

export interface EnrichedGroupTask extends GroupTask {
  assignedUserIds: string[];
}

export interface CreateGroupInput {
  name: string;
  adminUserId: string;
  assignmentId?: string;
  courseId?: string;
  description?: string;
  deadline?: string;
  priority?: Priority;
  totalMarks?: number;
  estimatedHours?: number;
  estimatedDays?: number;
  hoursPerDay?: number;
}

export interface CreateGroupTaskInput {
  groupId: string;
  submissionId?: string;
  title: string;
  description?: string;
  targetDate?: string;
  estimatedHours?: number;
  createdByUserId: string;
  assignedUserIds: string[];
}

interface GroupRow {
  id: string;
  name: string;
  access_token: string;
  admin_user_id: string;
  assignment_id: string | null;
  course_id: string | null;
  description: string | null;
  deadline: string | null;
  priority: string | null;
  total_marks: number | null;
  estimated_hours: number | null;
  estimated_days: number | null;
  hours_per_day: number | null;
  created_at: number;
  updated_at: number;
  is_synced: number;
  member_count?: number;
  pending_count?: number;
}

function mapGroupRow(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    accessToken: row.access_token,
    adminUserId: row.admin_user_id,
    assignmentId: row.assignment_id ?? undefined,
    courseId: row.course_id ?? undefined,
    description: row.description ?? undefined,
    deadline: row.deadline ?? undefined,
    priority: (row.priority as Priority) ?? 'medium',
    totalMarks: row.total_marks ?? undefined,
    estimatedHours: row.estimated_hours ?? undefined,
    estimatedDays: row.estimated_days ?? undefined,
    hoursPerDay: row.hours_per_day ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSynced: row.is_synced === 1,
  };
}

export class GroupRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findAllForUser(userId: string): GroupWithMeta[] {
    const rows = this.db.getAllSync<GroupRow>(
      `SELECT g.*,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'approved') as member_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'pending') as pending_count
       FROM groups g
       INNER JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ? AND gm.status = 'approved'
       ORDER BY g.created_at DESC`,
      [userId]
    );

    return rows.map((r) => ({
      ...mapGroupRow(r),
      isAdmin: r.admin_user_id === userId,
      memberCount: r.member_count ?? 1,
      pendingRequestsCount: r.pending_count ?? 0,
    }));
  }

  findById(id: string): Group | null {
    const row = this.db.getFirstSync<GroupRow>('SELECT * FROM groups WHERE id = ?', [id]);
    if (!row) return null;
    return mapGroupRow(row);
  }

  findByAccessToken(token: string): Group | null {
    const row = this.db.getFirstSync<GroupRow>(
      'SELECT * FROM groups WHERE access_token = ?',
      [token.trim()]
    );
    if (!row) return null;
    return mapGroupRow(row);
  }

  create(inputOrName: string | CreateGroupInput, adminUserId?: string, assignmentId?: string): Group {
    const input: CreateGroupInput =
      typeof inputOrName === 'string'
        ? { name: inputOrName, adminUserId: adminUserId!, assignmentId }
        : inputOrName;

    const id = generateId();
    // Generate a 6-digit access token (100000 - 999999)
    const accessToken = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();

    this.db.withTransactionSync(() => {
      this.db.runSync(
        `INSERT INTO groups (
          id, name, access_token, admin_user_id, assignment_id, course_id, description,
          deadline, priority, total_marks, estimated_hours, estimated_days, hours_per_day,
          created_at, updated_at, is_synced
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          id,
          input.name.trim(),
          accessToken,
          input.adminUserId,
          input.assignmentId ?? null,
          input.courseId ?? null,
          input.description ?? null,
          input.deadline ?? null,
          input.priority ?? 'medium',
          input.totalMarks ?? null,
          input.estimatedHours ?? null,
          input.estimatedDays ?? null,
          input.hoursPerDay ?? null,
          now,
          now,
        ]
      );

      // Admin is automatically an approved member
      this.db.runSync(
        `INSERT INTO group_members (id, group_id, user_id, status, joined_at)
         VALUES (?, ?, ?, 'approved', ?)`,
        [generateId(), id, input.adminUserId, now]
      );
    });

    return this.findById(id)!;
  }

  requestJoin(groupId: string, userId: string): { success: boolean; message: string } {
    const group = this.findById(groupId);
    if (!group) return { success: false, message: 'Group not found.' };

    const existing = this.db.getFirstSync<{ id: string; status: string }>(
      'SELECT id, status FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (existing) {
      if (existing.status === 'approved') {
        return { success: false, message: 'You are already a member of this group.' };
      }
      if (existing.status === 'pending') {
        return { success: false, message: 'Your join request is already pending approval by the Admin.' };
      }
    }

    this.db.runSync(
      `INSERT INTO group_members (id, group_id, user_id, status, joined_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      [generateId(), groupId, userId, Date.now()]
    );

    return { success: true, message: 'Join request sent! Waiting for Admin approval.' };
  }

  addMember(groupId: string, userId: string, status: 'approved' | 'pending' = 'approved'): boolean {
    const existing = this.db.getFirstSync<{ id: string; status: string }>(
      'SELECT id, status FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (existing) {
      if (existing.status !== status) {
        this.db.runSync('UPDATE group_members SET status = ? WHERE id = ?', [status, existing.id]);
        return true;
      }
      return false;
    }

    this.db.runSync(
      `INSERT INTO group_members (id, group_id, user_id, status, joined_at)
       VALUES (?, ?, ?, ?, ?)`,
      [generateId(), groupId, userId, status, Date.now()]
    );
    return true;
  }

  getMembers(groupId: string): GroupMember[] {
    const rows = this.db.getAllSync<{
      id: string;
      group_id: string;
      user_id: string;
      status: string;
      joined_at: number | null;
    }>('SELECT * FROM group_members WHERE group_id = ? ORDER BY joined_at ASC', [groupId]);

    return rows.map((r) => ({
      id: r.id,
      groupId: r.group_id,
      userId: r.user_id,
      status: r.status as GroupMember['status'],
      joinedAt: r.joined_at ?? undefined,
    }));
  }

  updateMemberStatus(groupId: string, userId: string, status: 'approved' | 'rejected'): boolean {
    const result = this.db.runSync(
      'UPDATE group_members SET status = ? WHERE group_id = ? AND user_id = ?',
      [status, groupId, userId]
    );
    return result.changes > 0;
  }

  removeMember(groupId: string, userId: string): boolean {
    const result = this.db.runSync(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );
    return result.changes > 0;
  }

  deleteGroup(groupId: string, currentUserId: string): { success: boolean; message: string } {
    const group = this.findById(groupId);
    if (!group) return { success: false, message: 'Group not found.' };

    if (group.adminUserId !== currentUserId) {
      return { success: false, message: 'Only the group Admin can delete this group.' };
    }

    // Check non-admin approved members
    const nonAdminMembers = this.db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND user_id != ? AND status = 'approved'`,
      [groupId, currentUserId]
    );

    if (nonAdminMembers && nonAdminMembers.count > 0) {
      return {
        success: false,
        message: 'Admin must remove all other members from the group before deleting it.',
      };
    }

    this.db.withTransactionSync(() => {
      this.db.runSync('DELETE FROM group_task_assignees WHERE group_task_id IN (SELECT id FROM group_tasks WHERE group_id = ?)', [groupId]);
      this.db.runSync('DELETE FROM group_tasks WHERE group_id = ?', [groupId]);
      this.db.runSync('DELETE FROM submissions WHERE group_id = ?', [groupId]);
      this.db.runSync('DELETE FROM group_members WHERE group_id = ?', [groupId]);
      this.db.runSync('DELETE FROM groups WHERE id = ?', [groupId]);
    });

    return { success: true, message: 'Group deleted successfully.' };
  }

  // ─── Group Tasks & Coin Rewards ───────────────────────────────────────────────

  createGroupTask(input: CreateGroupTaskInput): EnrichedGroupTask {
    const id = generateId();
    const now = Date.now();

    this.db.withTransactionSync(() => {
      this.db.runSync(
        `INSERT INTO group_tasks (
          id, group_id, submission_id, title, description, target_date, estimated_hours,
          status, created_by_user_id, created_at, updated_at, is_synced
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 0)`,
        [
          id,
          input.groupId,
          input.submissionId ?? null,
          input.title.trim(),
          input.description ?? null,
          input.targetDate ?? null,
          input.estimatedHours ?? null,
          input.createdByUserId,
          now,
          now,
        ]
      );

      for (const uid of input.assignedUserIds) {
        this.db.runSync(
          `INSERT INTO group_task_assignees (id, group_task_id, user_id) VALUES (?, ?, ?)`,
          [generateId(), id, uid]
        );
      }
    });

    return this.getGroupTaskById(id)!;
  }

  getGroupTasks(groupId: string, submissionId?: string): EnrichedGroupTask[] {
    const query = submissionId !== undefined
      ? 'SELECT * FROM group_tasks WHERE group_id = ? AND submission_id = ? ORDER BY created_at ASC'
      : 'SELECT * FROM group_tasks WHERE group_id = ? ORDER BY created_at ASC';
    const params = submissionId !== undefined ? [groupId, submissionId] : [groupId];

    const tasks = this.db.getAllSync<{
      id: string;
      group_id: string;
      submission_id: string | null;
      title: string;
      description: string | null;
      target_date: string | null;
      estimated_hours: number | null;
      status: string;
      created_by_user_id: string;
      created_at: number;
      updated_at: number;
      is_synced: number;
    }>(query, params);

    return tasks.map((t) => {
      const assignees = this.db.getAllSync<{ user_id: string }>(
        'SELECT user_id FROM group_task_assignees WHERE group_task_id = ?',
        [t.id]
      );
      return {
        id: t.id,
        groupId: t.group_id,
        submissionId: t.submission_id ?? undefined,
        title: t.title,
        description: t.description ?? undefined,
        targetDate: t.target_date ?? undefined,
        estimatedHours: t.estimated_hours ?? undefined,
        status: t.status as TaskStatus,
        createdByUserId: t.created_by_user_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        isSynced: t.is_synced === 1,
        assignedUserIds: assignees.map((a) => a.user_id),
      };
    });
  }

  getGroupTaskById(taskId: string): EnrichedGroupTask | null {
    const t = this.db.getFirstSync<{
      id: string;
      group_id: string;
      submission_id: string | null;
      title: string;
      description: string | null;
      target_date: string | null;
      estimated_hours: number | null;
      status: string;
      created_by_user_id: string;
      created_at: number;
      updated_at: number;
      is_synced: number;
    }>('SELECT * FROM group_tasks WHERE id = ?', [taskId]);

    if (!t) return null;

    const assignees = this.db.getAllSync<{ user_id: string }>(
      'SELECT user_id FROM group_task_assignees WHERE group_task_id = ?',
      [taskId]
    );

    return {
      id: t.id,
      groupId: t.group_id,
      submissionId: t.submission_id ?? undefined,
      title: t.title,
      description: t.description ?? undefined,
      targetDate: t.target_date ?? undefined,
      estimatedHours: t.estimated_hours ?? undefined,
      status: t.status as TaskStatus,
      createdByUserId: t.created_by_user_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      isSynced: t.is_synced === 1,
      assignedUserIds: assignees.map((a) => a.user_id),
    };
  }

  deleteGroupTask(taskId: string): boolean {
    this.db.withTransactionSync(() => {
      this.db.runSync('DELETE FROM group_task_assignees WHERE group_task_id = ?', [taskId]);
      this.db.runSync('DELETE FROM group_tasks WHERE id = ?', [taskId]);
    });
    return true;
  }

  completeGroupTask(
    taskId: string,
    _userId: string
  ): { earnedCoin: boolean; coinsAwarded: number } {
    const task = this.getGroupTaskById(taskId);
    if (!task) return { earnedCoin: false, coinsAwarded: 0 };

    const now = Date.now();
    this.db.runSync(
      `UPDATE group_tasks SET status = 'completed', updated_at = ? WHERE id = ?`,
      [now, taskId]
    );

    // Reward Coin Condition:
    // "when user complete each task before estimate date, users earn rewards coin."
    let earnedCoin = false;
    let coinsAwarded = 0;

    if (task.targetDate) {
      const targetTime = new Date(task.targetDate).getTime();
      // If completed before or on the target date (within same day)
      if (now <= targetTime + 24 * 60 * 60 * 1000) {
        earnedCoin = true;
        coinsAwarded = 10; // 10 coins per early completed task
      }
    }

    return { earnedCoin, coinsAwarded };
  }
}

