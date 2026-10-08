import type { SQLiteDatabase } from 'expo-sqlite';
import { ALL_CREATE_TABLES } from './schema';

/**
 * Runs all CREATE TABLE IF NOT EXISTS statements.
 * Safe to run on every app start — idempotent.
 */
export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    // Run all DDL statements inside a single transaction for atomicity
    await db.withTransactionAsync(async () => {
      for (const sql of ALL_CREATE_TABLES) {
        await db.execAsync(sql);
      }
    });
    console.log('✅ Database migration complete');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
}

