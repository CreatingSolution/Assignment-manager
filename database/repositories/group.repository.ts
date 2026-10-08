import type { SQLiteDatabase } from 'expo-sqlite';
import type { Group, GroupMember, GroupTask, TaskStatus } from '../../types';
import { generateId } from '../../utils/id.utils';

export interface GroupWithMeta extends Group {
  isAdmin: boolean;
  memberCount: number;
  pendingRequestsCount: number;
}

export interface EnrichedGroupTask extends GroupTask {
  assignedUserIds: string[];
}

export class GroupRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findAllForUser(userId: string): GroupWithMeta[] {
    const rows = this.db.getAllSync<{
      id: string;
      name: string;
      access_token: string;
      admin_user_id: string;
      assignment_id: string | null;
      created_at: number;
      updated_at: number;
      is_synced: number;
      member_count: number;
      pending_count: number;
    }>(
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
      id: r.id,
      name: r.name,
      accessToken: r.access_token,
      adminUserId: r.admin_user_id,
      assignmentId: r.assignment_id ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isSynced: r.is_synced === 1,
      isAdmin: r.admin_user_id === userId,
      memberCount: r.member_count,
      pendingRequestsCount: r.pending_count,
    }));
  }

  findById(id: string): Group | null {
    const row = this.db.getFirstSync<{
      id: string;
      name: string;
      access_token: string;
      admin_user_id: string;
      assignment_id: string | null;
      created_at: number;
      updated_at: number;
      is_synced: number;
    }>('SELECT * FROM groups WHERE id = ?', [id]);

    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      accessToken: row.access_token,
      adminUserId: row.admin_user_id,
      assignmentId: row.assignment_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isSynced: row.is_synced === 1,
    };
  }

  findByAccessToken(token: string): Group | null {
    const row = this.db.getFirstSync<{
      id: string;
      name: string;
      access_token: string;
      admin_user_id: string;
      assignment_id: string | null;
      created_at: number;
      updated_at: number;
      is_synced: number;
    }>('SELECT * FROM groups WHERE access_token = ?', [token.trim()]);

    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      accessToken: row.access_token,
      adminUserId: row.admin_user_id,
      assignmentId: row.assignment_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isSynced: row.is_synced === 1,
    };
  }

  create(name: string, adminUserId: string, assignmentId?: string): Group {
    const id = generateId();
    // Generate a 6-digit access token (100000 - 999999)
    const accessToken = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();

    this.db.withTransactionSync(() => {
      this.db.runSync(
        `INSERT INTO groups (id, name, access_token, admin_user_id, assignment_id, created_at, updated_at, is_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, name.trim(), accessToken, adminUserId, assignmentId ?? null, now, now]
      );

      // Admin is automatically an approved member
      this.db.runSync(
        `INSERT INTO group_members (id, group_id, user_id, status, joined_at)
         VALUES (?, ?, ?, 'approved', ?)`,
        [generateId(), id, adminUserId, now]
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
      this.db.runSync('DELETE FROM group_members WHERE group_id = ?', [groupId]);
      this.db.runSync('DELETE FROM groups WHERE id = ?', [groupId]);
    });

    return { success: true, message: 'Group deleted successfully.' };
  }

  // ─── Group Tasks & Coin Rewards ───────────────────────────────────────────────

  createGroupTask(input: {
    groupId: string;
    title: string;
    description?: string;
    targetDate?: string;
    createdByUserId: string;
    assignedUserIds: string[];
  }): EnrichedGroupTask {
    const id = generateId();
    const now = Date.now();

    this.db.withTransactionSync(() => {
      this.db.runSync(
        `INSERT INTO group_tasks (id, group_id, title, description, target_date, status, created_by_user_id, created_at, updated_at, is_synced)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, 0)`,
        [
          id,
          input.groupId,
          input.title.trim(),
          input.description ?? null,
          input.targetDate ?? null,
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

  getGroupTasks(groupId: string): EnrichedGroupTask[] {
    const tasks = this.db.getAllSync<{
      id: string;
      group_id: string;
      title: string;
      description: string | null;
      target_date: string | null;
      status: string;
      created_by_user_id: string;
      created_at: number;
      updated_at: number;
      is_synced: number;
    }>('SELECT * FROM group_tasks WHERE group_id = ? ORDER BY created_at ASC', [groupId]);

    return tasks.map((t) => {
      const assignees = this.db.getAllSync<{ user_id: string }>(
        'SELECT user_id FROM group_task_assignees WHERE group_task_id = ?',
        [t.id]
      );
      return {
        id: t.id,
        groupId: t.group_id,
        title: t.title,
        description: t.description ?? undefined,
        targetDate: t.target_date ?? undefined,
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
      title: string;
      description: string | null;
      target_date: string | null;
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
      title: t.title,
      description: t.description ?? undefined,
      targetDate: t.target_date ?? undefined,
      status: t.status as TaskStatus,
      createdByUserId: t.created_by_user_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      isSynced: t.is_synced === 1,
      assignedUserIds: assignees.map((a) => a.user_id),
    };
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
      // If completed before or on the target date
      if (now <= targetTime + 24 * 60 * 60 * 1000) {
        earnedCoin = true;
        coinsAwarded = 10; // 10 coins per early completed task
      }
    }

    return { earnedCoin, coinsAwarded };
  }
}

