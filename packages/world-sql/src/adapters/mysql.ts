import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2';
import type * as mysqlTypes from 'mysql2';
import type { DatabaseAdapter } from './base.js';

/**
 * MySQL adapter using mysql2 pool (synchronous setup like postgres)
 */
export class MySQLAdapter
  implements DatabaseAdapter<mysqlTypes.Pool, MySql2Database<any>>
{
  type = 'mysql' as const;
  client: mysqlTypes.Pool;
  drizzle: MySql2Database<any>;

  constructor(connectionString: string, schema?: Record<string, any>) {
    // Create pool synchronously (connects lazily like postgres)
    this.client = mysql.createPool(connectionString);
    this.drizzle = drizzleMysql(this.client, {
      schema,
      mode: 'default',
    });
  }

  async connect(): Promise<void> {
    // Test connection
    await this.client.promise().query('SELECT 1');
  }

  async disconnect(): Promise<void> {
    await this.client.promise().end();
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.promise().query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a MySQL adapter
 */
export function createMySQLAdapter(
  connectionString: string,
  schema?: Record<string, any>
): MySQLAdapter {
  return new MySQLAdapter(connectionString, schema);
}
