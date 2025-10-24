import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import type { DatabaseAdapter } from './base.js';

/**
 * SQLite adapter using better-sqlite3
 */
export class SQLiteAdapter implements DatabaseAdapter<BetterSqlite3.Database, BetterSQLite3Database> {
  type = 'sqlite' as const;
  client: BetterSqlite3.Database;
  drizzle: BetterSQLite3Database;

  constructor(connectionString: string, schema?: Record<string, any>) {
    const Database = require('better-sqlite3');
    this.client = new Database(connectionString);
    this.drizzle = drizzleSqlite(this.client, { schema });
  }

  async connect(): Promise<void> {
    // better-sqlite3 doesn't require async connection
    this.client.pragma('journal_mode = WAL');
  }

  async disconnect(): Promise<void> {
    this.client.close();
  }

  async isHealthy(): Promise<boolean> {
    try {
      this.client.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a SQLite adapter
 */
export async function createSQLiteAdapter(
  connectionString: string,
  schema?: Record<string, any>
): Promise<SQLiteAdapter> {
  const adapter = new SQLiteAdapter(connectionString, schema);
  await adapter.connect();
  return adapter;
}
