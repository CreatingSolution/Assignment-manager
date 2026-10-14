import type { SQLiteDatabase } from 'expo-sqlite';
import type { CalendarEvent } from '../../types';
import { generateId } from '../../utils/id.utils';

export class CalendarRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findAll(userId: string): CalendarEvent[] {
    const rows = this.db.getAllSync<{
      id: string;
      user_id: string;
      ms_event_id: string | null;
      title: string;
      start_time: string;
      end_time: string;
      is_all_day: number;
      event_type: string;
      cached_at: number;
    }>(
      'SELECT * FROM calendar_events WHERE user_id = ? ORDER BY start_time ASC',
      [userId]
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      msEventId: r.ms_event_id ?? undefined,
      title: r.title,
      startTime: r.start_time,
      endTime: r.end_time,
      isAllDay: r.is_all_day === 1,
      eventType: r.event_type as CalendarEvent['eventType'],
      cachedAt: r.cached_at,
    }));
  }

  saveBatch(userId: string, events: Array<Omit<CalendarEvent, 'id' | 'userId' | 'cachedAt'>>): void {
    const now = Date.now();
    this.db.withTransactionSync(() => {
      this.db.runSync('DELETE FROM calendar_events WHERE user_id = ?', [userId]);
      for (const ev of events) {
        this.db.runSync(
          `INSERT INTO calendar_events (id, user_id, ms_event_id, title, start_time, end_time, is_all_day, event_type, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            userId,
            ev.msEventId ?? null,
            ev.title,
            ev.startTime,
            ev.endTime,
            ev.isAllDay ? 1 : 0,
            ev.eventType,
            now,
          ]
        );
      }
    });
  }
}

