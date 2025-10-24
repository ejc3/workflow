import type { DatabaseType } from '../config.js';
import type { DatabaseAdapter } from '../adapters/index.js';
import type { StreamingAdapter } from './base.js';
import { createPostgresStreaming } from './postgres-streaming.js';
import { createPollingStreaming } from './polling-streaming.js';

export type { StreamingAdapter } from './base.js';

/**
 * Create a streaming adapter based on the database type
 */
export function createStreamingAdapter(
  databaseType: DatabaseType,
  adapter: DatabaseAdapter,
  schema: any
): StreamingAdapter {
  switch (databaseType) {
    case 'postgres':
      return createPostgresStreaming(adapter, schema);
    case 'mysql':
    case 'sqlite':
      return createPollingStreaming(adapter, schema);
    default:
      throw new Error(`Unsupported database type: ${databaseType as string}`);
  }
}
