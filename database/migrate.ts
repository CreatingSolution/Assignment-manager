import type { SQLiteDatabase } from 'expo-sqlite';
import { ALL_CREATE_TABLES } from './schema';

/**
 * Runs all CREATE TABLE IF NOT EXISTS statements and reconciles columns.
 * Safe to run on every app start — idempotent.
 */
export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    // 1. Run all DDL statements inside a transaction for atomicity
    await db.withTransactionAsync(async () => {
      for (const sql of ALL_CREATE_TABLES) {
        await db.execAsync(sql);
      }
    });

    // 2. Safely reconcile columns on assignments table if created in older versions
    const assignmentColumns: Array<{ name: string; type: string }> = [
      { name: 'course_id', type: 'TEXT' },
      { name: 'description', type: 'TEXT' },
      { name: 'source_url', type: 'TEXT' },
      { name: 'priority', type: "TEXT NOT NULL DEFAULT 'medium'" },
      { name: 'total_marks', type: 'REAL' },
      { name: 'estimated_hours', type: 'REAL' },
      { name: 'estimated_days', type: 'REAL' },
      { name: 'hours_per_day', type: 'REAL' },
      { name: 'status', type: "TEXT NOT NULL DEFAULT 'pending'" },
      { name: 'is_synced', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'is_deleted', type: 'INTEGER NOT NULL DEFAULT 0' },
    ];

    try {
      const existingCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(assignments);');
      const colNames = new Set(existingCols.map((c) => c.name));
      for (const col of assignmentColumns) {
        if (!colNames.has(col.name)) {
          await db.execAsync(`ALTER TABLE assignments ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    } catch {
      // Table creation handled by ALL_CREATE_TABLES
    }

    // 3. Safely reconcile columns on tasks table if created in older versions
    const taskColumns: Array<{ name: string; type: string }> = [
      { name: 'submission_id', type: 'TEXT' },
      { name: 'target_date', type: 'TEXT' },
      { name: 'estimated_hours', type: 'REAL' },
      { name: 'status', type: "TEXT NOT NULL DEFAULT 'pending'" },
      { name: 'order_index', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'is_synced', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'is_deleted', type: 'INTEGER NOT NULL DEFAULT 0' },
    ];

    try {
      const existingTaskCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(tasks);');
      const taskColNames = new Set(existingTaskCols.map((c) => c.name));
      for (const col of taskColumns) {
        if (!taskColNames.has(col.name)) {
          await db.execAsync(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    } catch {
      // Table creation handled by ALL_CREATE_TABLES
    }

    console.log('✅ Database migration complete');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
}
