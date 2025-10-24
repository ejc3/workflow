import type { DatabaseType } from '../config.js';
import * as mysqlSchema from './mysql.js';
import * as postgresSchema from './postgres.js';
import * as sqliteSchema from './sqlite.js';

export { mysqlSchema, postgresSchema, sqliteSchema };

/**
 * Get the appropriate schema for the database type
 */
export function getSchema(databaseType: DatabaseType) {
  switch (databaseType) {
    case 'postgres':
      return postgresSchema;
    case 'mysql':
      return mysqlSchema;
    case 'sqlite':
      return sqliteSchema;
    default:
      throw new Error(`Unsupported database type: ${databaseType as string}`);
  }
}
