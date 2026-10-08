/**
 * Core TypeScript types for the Smart Assignment Planner mobile application.
 * These types are the contract between the local database, sync engine, and UI.
 */

// ─── Enums / Literals ─────────────────────────────────────────────────────────

export type Priority = 'low' | 'medium' | 'high';
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type GroupMemberStatus = 'pending' | 'approved' | 'rejected';
export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncQueueStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type NetworkStatusLabel = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNCED' | 'SYNC_ERROR';

export type EntityType =
  | 'assignment'
  | 'task'
  | 'course'
  | 'submission'
  | 'group'
  | 'group_task';

// ─── Domain Models (mirror local SQLite tables) ───────────────────────────────

export interface Course {
  id: string;
  userId: string;
  code: string;
  title: string;
  color: string;
  createdAt: number;   // unix ms
  updatedAt: number;   // unix ms
  isSynced: boolean;
  isDeleted: boolean;
}

export interface Assignment {
  id: string;
  userId: string;
  courseId: string;
  title: string;
  description?: string;
  sourceUrl?: string;
  priority: Priority;
  totalMarks?: number;
  deadline: string;          // ISO 8601 string
  estimatedHours?: number;   // total workload hours
  estimatedDays?: number;    // estimated days planned for this assignment
  hoursPerDay?: number;      // estimated hours per day
  status: AssignmentStatus;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;
  isDeleted: boolean;
}

export interface Task {
  id: string;
  assignmentId: string;
  submissionId?: string;     // links to a Submission group
  userId: string;
  title: string;
  description?: string;
  targetDate?: string;       // ISO 8601 string
  estimatedHours?: number;
  status: TaskStatus;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;
  isDeleted: boolean;
}

export interface Submission {
  id: string;
  assignmentId?: string;
  groupId?: string;
  userId: string;
  title: string;
  deadline: string;          // ISO 8601 string
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;
}

export interface Group {
  id: string;
  name: string;
  accessToken: string;       // 6-digit token for joining
  adminUserId: string;
  assignmentId?: string;     // optional linked assignment
  courseId?: string;
  description?: string;
  deadline?: string;         // ISO 8601
  priority?: Priority;
  totalMarks?: number;
  estimatedHours?: number;
  estimatedDays?: number;
  hoursPerDay?: number;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  status: GroupMemberStatus;
  joinedAt?: number;
}

export interface GroupTask {
  id: string;
  groupId: string;
  submissionId?: string;     // links to phased submission (e.g. submission_1, submission_2)
  title: string;
  description?: string;
  targetDate?: string;
  estimatedHours?: number;
  status: TaskStatus;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;
}

export interface GroupTaskAssignee {
  id: string;
  groupTaskId: string;
  userId: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  msEventId?: string;        // Microsoft Graph event ID
  title: string;
  startTime: string;         // ISO 8601
  endTime: string;           // ISO 8601
  isAllDay: boolean;
  eventType: 'lecture' | 'meeting' | 'other';
  cachedAt: number;
}

// ─── Sync Queue ───────────────────────────────────────────────────────────────

export interface SyncOperation {
  id: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperationType;
  payload: string;           // JSON stringified entity data
  createdAt: number;
  attemptCount: number;
  lastAttemptedAt?: number;
  status: SyncQueueStatus;
  errorMessage?: string;
}

export interface SyncMetadata {
  key: string;
  value: string;
}

// ─── Network & Sync Status ────────────────────────────────────────────────────

export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean;
  connectionType: string;
}

export interface SyncState {
  label: NetworkStatusLabel;
  pendingCount: number;
  lastSyncedAt: number | null;
  error: string | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export * from './auth';

// ─── Input types (for create/update operations) ───────────────────────────────

export type CreateCourseInput = Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'isSynced' | 'isDeleted'>;
export type UpdateCourseInput = Partial<Omit<Course, 'id' | 'userId' | 'createdAt' | 'isSynced'>>;

export type CreateAssignmentInput = Omit<Assignment, 'id' | 'createdAt' | 'updatedAt' | 'isSynced' | 'isDeleted'>;
export type UpdateAssignmentInput = Partial<Omit<Assignment, 'id' | 'userId' | 'createdAt' | 'isSynced'>>;

export type CreateTaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'isSynced' | 'isDeleted'>;
export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'userId' | 'assignmentId' | 'createdAt' | 'isSynced'>>;

