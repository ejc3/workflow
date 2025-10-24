export type DatabaseType = 'postgres' | 'mysql' | 'sqlite';

export interface SqlWorldConfig {
  /**
   * The type of SQL database to use
   * @default 'postgres'
   */
  databaseType?: DatabaseType;
  /**
   * Database connection string or file path (for SQLite)
   * - PostgreSQL: postgres://user:pass@host:port/db
   * - MySQL: mysql://user:pass@host:port/db
   * - SQLite: /path/to/database.db or :memory:
   */
  connectionString: string;
  /**
   * Optional prefix for queue job names
   */
  jobPrefix?: string;
  /**
   * Number of concurrent queue workers
   * @default 10
   */
  queueConcurrency?: number;
}

/**
 * @deprecated Use SqlWorldConfig instead
 */
export type PostgresWorldConfig = SqlWorldConfig;
