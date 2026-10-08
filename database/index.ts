import * as SQLite from 'expo-sqlite';
import { DATABASE_NAME } from '../constants';
import { migrateDatabase } from './migrate';
import { AssignmentRepository } from './repositories/assignment.repository';
import { CourseRepository } from './repositories/course.repository';
import { SyncQueueRepository } from './repositories/sync-queue.repository';
import { TaskRepository } from './repositories/task.repository';

// ─── Singleton DB Instance ────────────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton SQLite database instance.
 * Opens the DB on first call. Enable WAL mode and foreign keys.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DATABASE_NAME);
    // Enable Write-Ahead Logging for better read/write concurrency
    _db.execSync('PRAGMA journal_mode = WAL;');
    // Enforce foreign key constraints
    _db.execSync('PRAGMA foreign_keys = ON;');
  }
  return _db;
}

/**
 * Initializes the database: opens it, enables WAL/FK, runs migrations.
 * Call once from the root layout before any repository access.
 */
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  await migrateDatabase(db);
}

// ─── Repository Singletons ────────────────────────────────────────────────────

let _courseRepo: CourseRepository | null = null;
let _assignmentRepo: AssignmentRepository | null = null;
let _taskRepo: TaskRepository | null = null;
let _syncQueueRepo: SyncQueueRepository | null = null;

export function getCourseRepository(): CourseRepository {
  if (!_courseRepo) _courseRepo = new CourseRepository(getDatabase());
  return _courseRepo;
}

export function getAssignmentRepository(): AssignmentRepository {
  if (!_assignmentRepo) _assignmentRepo = new AssignmentRepository(getDatabase());
  return _assignmentRepo;
}

export function getTaskRepository(): TaskRepository {
  if (!_taskRepo) _taskRepo = new TaskRepository(getDatabase());
  return _taskRepo;
}

export function getSyncQueueRepository(): SyncQueueRepository {
  if (!_syncQueueRepo) _syncQueueRepo = new SyncQueueRepository(getDatabase());
  return _syncQueueRepo;
}

// ─── Barrel Exports ───────────────────────────────────────────────────────────

export { AssignmentRepository } from './repositories/assignment.repository';
export { CourseRepository } from './repositories/course.repository';
export { SyncQueueRepository } from './repositories/sync-queue.repository';
export { TaskRepository } from './repositories/task.repository';

