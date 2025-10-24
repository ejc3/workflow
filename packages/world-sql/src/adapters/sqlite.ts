import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import type { DatabaseAdapter } from './base.js';

/**
 * SQLite adapter using better-sqlite3
 */
export class SQLiteAdapter
  implements DatabaseAdapter<BetterSqlite3.Database, BetterSQLite3Database<any>>
{
  type = 'sqlite' as const;
  client: BetterSqlite3.Database;
  drizzle: BetterSQLite3Database<any>;

  constructor(connectionString: string, schema?: Record<string, any>) {
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
export function createSQLiteAdapter(
  connectionString: string,
  schema?: Record<string, any>
): SQLiteAdapter {
  return new SQLiteAdapter(connectionString, schema);
}
