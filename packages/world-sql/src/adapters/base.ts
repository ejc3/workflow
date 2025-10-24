import type { DatabaseType } from '../config.js';

/**
 * Base interface for database adapters
 */
export interface DatabaseAdapter<TClient = any, TDrizzle = any> {
  type: DatabaseType;
  client: TClient;
  drizzle: TDrizzle;

  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Check if the database connection is healthy
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Configuration for creating a database adapter
 */
export interface AdapterConfig {
  databaseType: DatabaseType;
  connectionString: string;
}

/**
 * Factory function type for creating database adapters
 */
export type AdapterFactory = (config: AdapterConfig) => Promise<DatabaseAdapter>;
