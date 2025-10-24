import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type Postgres from 'postgres';
import type { DatabaseAdapter } from './base.js';

/**
 * PostgreSQL adapter using postgres.js
 */
export class PostgresAdapter implements DatabaseAdapter<Postgres.Sql, PostgresJsDatabase> {
  type = 'postgres' as const;
  client: Postgres.Sql;
  drizzle: PostgresJsDatabase;

  constructor(connectionString: string, schema?: Record<string, any>) {
    // Dynamic import is handled by the factory
    const postgres = require('postgres');
    this.client = postgres(connectionString);
    this.drizzle = drizzlePg(this.client, { schema });
  }

  async connect(): Promise<void> {
    // postgres.js connects automatically on first query
    await this.client`SELECT 1`;
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a PostgreSQL adapter
 */
export async function createPostgresAdapter(
  connectionString: string,
  schema?: Record<string, any>
): Promise<PostgresAdapter> {
  return new PostgresAdapter(connectionString, schema);
}
