import type { DatabaseType } from '../config.js';
import type { DatabaseAdapter } from '../adapters/index.js';
import type { QueueAdapter, QueueAdapterConfig } from './base.js';
import { createPgBossQueue } from './pg-boss-queue.js';
import { createTableQueue } from './table-queue.js';

export type { QueueAdapter, QueueAdapterConfig } from './base.js';

/**
 * Create a queue adapter based on the database type
 */
export async function createQueueAdapter(
  databaseType: DatabaseType,
  adapter: DatabaseAdapter,
  schema: any,
  config: QueueAdapterConfig
): Promise<QueueAdapter> {
  switch (databaseType) {
    case 'postgres': {
      // Dynamically import pg-boss for PostgreSQL
      const PgBoss = (await import('pg-boss')).default;
      const connectionString =
        (adapter.client as any).options?.connection || '';
      const boss = new PgBoss({ connectionString });
      return createPgBossQueue(boss, config);
    }
    case 'mysql':
    case 'sqlite':
      return createTableQueue(adapter, schema, config);
    default:
      throw new Error(`Unsupported database type: ${databaseType as string}`);
  }
}
