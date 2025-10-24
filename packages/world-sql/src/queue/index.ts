import type { DatabaseType } from '../config.js';
import type { DatabaseAdapter } from '../adapters/index.js';
import type { QueueAdapter, QueueAdapterConfig } from './base.js';
import { createPgBossQueue } from './pg-boss-queue.js';
import { createTableQueue } from './table-queue.js';
import PgBoss from 'pg-boss';

export type { QueueAdapter, QueueAdapterConfig } from './base.js';

/**
 * Create a queue adapter based on the database type
 */
export function createQueueAdapter(
  databaseType: DatabaseType,
  adapter: DatabaseAdapter,
  schema: any,
  config: QueueAdapterConfig
): QueueAdapter {
  switch (databaseType) {
    case 'postgres': {
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
