import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/schema/sqlite.js';

/**
 * Helper to create SQLite tables programmatically
 */
export async function setupSqliteSchema(dbPath: string): Promise<void> {
  const db = new Database(dbPath);
  const drizzleDb = drizzle(db, { schema });

  // Create all tables manually
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      deployment_id TEXT NOT NULL,
      status TEXT NOT NULL,
      name TEXT NOT NULL,
      execution_context TEXT,
      input TEXT NOT NULL,
      output TEXT,
      error TEXT,
      error_code TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      started_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS workflow_name_idx ON workflow_runs(name);
    CREATE INDEX IF NOT EXISTS status_idx ON workflow_runs(status);

    CREATE TABLE IF NOT EXISTS workflow_events (
      id TEXT PRIMARY KEY,
      deployment_id TEXT NOT NULL,
      stream_id TEXT NOT NULL,
      correlation_id TEXT,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS stream_id_idx ON workflow_events(stream_id);
    CREATE INDEX IF NOT EXISTS event_id_idx ON workflow_events(id);

    CREATE TABLE IF NOT EXISTS workflow_steps (
      run_id TEXT NOT NULL,
      step_id TEXT PRIMARY KEY,
      step_name TEXT NOT NULL,
      status TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      error TEXT,
      error_code TEXT,
      attempt INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS run_id_idx ON workflow_steps(run_id);

    CREATE TABLE IF NOT EXISTS workflow_hooks (
      run_id TEXT NOT NULL,
      hook_id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS token_idx ON workflow_hooks(token);

    CREATE TABLE IF NOT EXISTS workflow_stream_chunks (
      id TEXT NOT NULL,
      stream_id TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      eof INTEGER NOT NULL,
      PRIMARY KEY (stream_id, id)
    );

    CREATE INDEX IF NOT EXISTS stream_idx ON workflow_stream_chunks(stream_id);

    CREATE TABLE IF NOT EXISTS workflow_jobs (
      id TEXT PRIMARY KEY,
      queue_name TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      max_attempts INTEGER NOT NULL,
      locked_until INTEGER,
      scheduled_for INTEGER NOT NULL,
      idempotency_key TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS queue_status_idx ON workflow_jobs(queue_name, status);
    CREATE INDEX IF NOT EXISTS scheduled_for_idx ON workflow_jobs(scheduled_for);
  `);

  db.close();
}
