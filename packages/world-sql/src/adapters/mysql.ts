import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type * as mysql from 'mysql2/promise';
import type { DatabaseAdapter } from './base.js';

/**
 * MySQL adapter using mysql2
 */
export class MySQLAdapter
  implements DatabaseAdapter<mysql.Connection, MySql2Database<any>>
{
  type = 'mysql' as const;
  client: mysql.Connection;
  drizzle: MySql2Database<any>;

  private constructor(client: mysql.Connection, schema?: Record<string, any>) {
    this.client = client;
    this.drizzle = drizzleMysql(client, { schema, mode: 'default' });
  }

  static async create(
    connectionString: string,
    schema?: Record<string, any>
  ): Promise<MySQLAdapter> {
    const mysql2 = await import('mysql2/promise');
    const client = await mysql2.default.createConnection(connectionString);
    return new MySQLAdapter(client, schema);
  }

  async connect(): Promise<void> {
    await this.client.ping();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a MySQL adapter
 */
export async function createMySQLAdapter(
  connectionString: string,
  schema?: Record<string, any>
): Promise<MySQLAdapter> {
  return MySQLAdapter.create(connectionString, schema);
}
