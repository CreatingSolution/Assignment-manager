/**
 * SQLite table definitions for the Smart Assignment Planner local database.
 *
 * Each CREATE TABLE statement uses IF NOT EXISTS for idempotent initialization.
 * All timestamp fields store UNIX milliseconds as INTEGER for easy sorting.
 * Boolean fields are stored as INTEGER (0 = false, 1 = true).
 */

export const SQL_CREATE_COURSES = `
  CREATE TABLE IF NOT EXISTS courses (
    id             TEXT    NOT NULL PRIMARY KEY,
    user_id        TEXT    NOT NULL,
    code           TEXT    NOT NULL,
    title          TEXT    NOT NULL,
    color          TEXT    NOT NULL DEFAULT '#3B82F6',
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    is_synced      INTEGER NOT NULL DEFAULT 0,
    is_deleted     INTEGER NOT NULL DEFAULT 0
  )
`;

export const SQL_CREATE_ASSIGNMENTS = `
  CREATE TABLE IF NOT EXISTS assignments (
    id               TEXT    NOT NULL PRIMARY KEY,
    user_id          TEXT    NOT NULL,
    course_id        TEXT,
    title            TEXT    NOT NULL,
    description      TEXT,
    source_url       TEXT,
    priority         TEXT    NOT NULL DEFAULT 'medium',
    total_marks      REAL,
    deadline         TEXT    NOT NULL,
    estimated_hours  REAL,
    estimated_days   REAL,
    hours_per_day    REAL,
    status           TEXT    NOT NULL DEFAULT 'pending',
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    is_synced        INTEGER NOT NULL DEFAULT 0,
    is_deleted       INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )
`;

export const SQL_CREATE_TASKS = `
  CREATE TABLE IF NOT EXISTS tasks (
    id               TEXT    NOT NULL PRIMARY KEY,
    assignment_id    TEXT    NOT NULL,
    submission_id    TEXT,
    user_id          TEXT    NOT NULL,
    title            TEXT    NOT NULL,
    description      TEXT,
    target_date      TEXT,
    estimated_hours  REAL,
    status           TEXT    NOT NULL DEFAULT 'pending',
    order_index      INTEGER NOT NULL DEFAULT 0,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    is_synced        INTEGER NOT NULL DEFAULT 0,
    is_deleted       INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
  )
`;

export const SQL_CREATE_SUBMISSIONS = `
  CREATE TABLE IF NOT EXISTS submissions (
    id            TEXT    NOT NULL PRIMARY KEY,
    assignment_id TEXT,
    group_id      TEXT,
    user_id       TEXT    NOT NULL,
    title         TEXT    NOT NULL,
    deadline      TEXT    NOT NULL,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    is_synced     INTEGER NOT NULL DEFAULT 0
  )
`;

export const SQL_CREATE_GROUPS = `
  CREATE TABLE IF NOT EXISTS groups (
    id              TEXT    NOT NULL PRIMARY KEY,
    name            TEXT    NOT NULL,
    access_token    TEXT    NOT NULL UNIQUE,
    admin_user_id   TEXT    NOT NULL,
    assignment_id   TEXT,
    course_id       TEXT,
    description     TEXT,
    deadline        TEXT,
    priority        TEXT    NOT NULL DEFAULT 'medium',
    total_marks     REAL,
    estimated_hours REAL,
    estimated_days  REAL,
    hours_per_day   REAL,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    is_synced       INTEGER NOT NULL DEFAULT 0
  )
`;

export const SQL_CREATE_GROUP_MEMBERS = `
  CREATE TABLE IF NOT EXISTS group_members (
    id         TEXT    NOT NULL PRIMARY KEY,
    group_id   TEXT    NOT NULL,
    user_id    TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'pending',
    joined_at  INTEGER,
    FOREIGN KEY (group_id) REFERENCES groups(id)
  )
`;

export const SQL_CREATE_GROUP_TASKS = `
  CREATE TABLE IF NOT EXISTS group_tasks (
    id                  TEXT    NOT NULL PRIMARY KEY,
    group_id            TEXT    NOT NULL,
    submission_id       TEXT,
    title               TEXT    NOT NULL,
    description         TEXT,
    target_date         TEXT,
    estimated_hours     REAL,
    status              TEXT    NOT NULL DEFAULT 'pending',
    created_by_user_id  TEXT    NOT NULL,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    is_synced           INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (group_id) REFERENCES groups(id)
  )
`;

export const SQL_CREATE_GROUP_TASK_ASSIGNEES = `
  CREATE TABLE IF NOT EXISTS group_task_assignees (
    id            TEXT NOT NULL PRIMARY KEY,
    group_task_id TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    FOREIGN KEY (group_task_id) REFERENCES group_tasks(id)
  )
`;

export const SQL_CREATE_CALENDAR_EVENTS = `
  CREATE TABLE IF NOT EXISTS calendar_events (
    id          TEXT    NOT NULL PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    ms_event_id TEXT,
    title       TEXT    NOT NULL,
    start_time  TEXT    NOT NULL,
    end_time    TEXT    NOT NULL,
    is_all_day  INTEGER NOT NULL DEFAULT 0,
    event_type  TEXT    NOT NULL DEFAULT 'other',
    cached_at   INTEGER NOT NULL
  )
`;

export const SQL_CREATE_SYNC_QUEUE = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id                TEXT    NOT NULL PRIMARY KEY,
    user_id           TEXT    NOT NULL,
    entity_type       TEXT    NOT NULL,
    entity_id         TEXT    NOT NULL,
    operation         TEXT    NOT NULL,
    payload           TEXT    NOT NULL,
    created_at        INTEGER NOT NULL,
    attempt_count     INTEGER NOT NULL DEFAULT 0,
    last_attempted_at INTEGER,
    status            TEXT    NOT NULL DEFAULT 'pending',
    error_message     TEXT
  )
`;

export const SQL_CREATE_SYNC_METADATA = `
  CREATE TABLE IF NOT EXISTS sync_metadata (
    key   TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL
  )
`;

// ─── Indexes ──────────────────────────────────────────────────────────────────

export const SQL_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id)`,
  `CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_assignment_id ON tasks(assignment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_user_id ON sync_queue(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`,
  `CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id)`,
];

/**
 * Ordered list of all CREATE TABLE statements for the migration runner.
 */
export const ALL_CREATE_TABLES = [
  SQL_CREATE_COURSES,
  SQL_CREATE_ASSIGNMENTS,
  SQL_CREATE_SUBMISSIONS,
  SQL_CREATE_TASKS,
  SQL_CREATE_GROUPS,
  SQL_CREATE_GROUP_MEMBERS,
  SQL_CREATE_GROUP_TASKS,
  SQL_CREATE_GROUP_TASK_ASSIGNEES,
  SQL_CREATE_CALENDAR_EVENTS,
  SQL_CREATE_SYNC_QUEUE,
  SQL_CREATE_SYNC_METADATA,
  ...SQL_INDEXES,
] as const;

