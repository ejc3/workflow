import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
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

  private constructor(
    client: BetterSqlite3.Database,
    schema?: Record<string, any>
  ) {
    this.client = client;
    this.drizzle = drizzleSqlite(client, { schema });
  }

  static async create(
    connectionString: string,
    schema?: Record<string, any>
  ): Promise<SQLiteAdapter> {
    const Database = await import('better-sqlite3');
    const client = new Database.default(connectionString);
    return new SQLiteAdapter(client, schema);
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
  const adapter = await SQLiteAdapter.create(connectionString, schema);
  await adapter.connect();
  return adapter;
}
