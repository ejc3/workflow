import type { DatabaseType } from '../config.js';
import type { DatabaseAdapter } from './base.js';
import { createMySQLAdapter } from './mysql.js';
import { createPostgresAdapter } from './postgres.js';
import { createSQLiteAdapter } from './sqlite.js';

export type { DatabaseAdapter } from './base.js';
export { PostgresAdapter, createPostgresAdapter } from './postgres.js';
export { MySQLAdapter, createMySQLAdapter } from './mysql.js';
export { SQLiteAdapter, createSQLiteAdapter } from './sqlite.js';

/**
 * Create a database adapter based on the database type
 */
export function createAdapter(
  databaseType: DatabaseType,
  connectionString: string,
  schema?: Record<string, any>
): DatabaseAdapter {
  switch (databaseType) {
    case 'postgres':
      return createPostgresAdapter(connectionString, schema);
    case 'mysql':
      return createMySQLAdapter(connectionString, schema);
    case 'sqlite':
      return createSQLiteAdapter(connectionString, schema);
    default:
      throw new Error(`Unsupported database type: ${databaseType as string}`);
  }
}
