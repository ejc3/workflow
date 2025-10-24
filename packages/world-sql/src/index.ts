import type { AuthProvider, Storage, World } from '@workflow/world';
import { createAdapter, type DatabaseAdapter } from './adapters/index.js';
import type { DatabaseType, SqlWorldConfig } from './config.js';
import { createQueueAdapter } from './queue/index.js';
import { getSchema } from './schema/index.js';
import {
  createEventsStorage,
  createHooksStorage,
  createRunsStorage,
  createStepsStorage,
} from './storage.js';
import { createStreamingAdapter } from './streaming/index.js';

// Re-export for backward compatibility
export type {
  PostgresWorldConfig,
  SqlWorldConfig,
  DatabaseType,
} from './config.js';

/**
 * Detect database type from connection string
 */
function detectDatabaseType(connectionString: string): DatabaseType {
  if (
    connectionString.startsWith('postgres://') ||
    connectionString.startsWith('postgresql://')
  ) {
    return 'postgres';
  }
  if (connectionString.startsWith('mysql://')) {
    return 'mysql';
  }
  // SQLite uses file paths or :memory:
  return 'sqlite';
}

function createStorage(
  adapter: DatabaseAdapter,
  schema: any,
  dbType: DatabaseType
): Storage {
  return {
    runs: createRunsStorage(adapter, schema, dbType),
    events: createEventsStorage(adapter, schema, dbType),
    hooks: createHooksStorage(adapter, schema, dbType),
    steps: createStepsStorage(adapter, schema, dbType),
  };
}

function createAuthProvider(
  config: SqlWorldConfig,
  adapter: DatabaseAdapter
): AuthProvider {
  const dbType =
    config.databaseType || detectDatabaseType(config.connectionString);

  return {
    async getAuthInfo() {
      return {
        environment: dbType,
        ownerId: dbType,
        projectId: dbType,
      };
    },
    async checkHealth() {
      try {
        const isHealthy = await adapter.isHealthy();
        if (!isHealthy) {
          throw new Error(`${dbType} connection is not healthy`);
        }
      } catch (err) {
        return {
          success: false,
          data: { healthy: false },
          message:
            err &&
            typeof err === 'object' &&
            'message' in err &&
            typeof err.message === 'string'
              ? err.message
              : String(err),
        };
      }
      return {
        success: true,
        message: `${dbType} connection is healthy`,
        data: { healthy: true },
      };
    },
  };
}

export function createWorld(
  config: SqlWorldConfig = {
    databaseType:
      (process.env.WORKFLOW_SQL_DATABASE_TYPE as DatabaseType) || 'postgres',
    connectionString:
      process.env.WORKFLOW_SQL_URL ||
      process.env.WORKFLOW_POSTGRES_URL ||
      'postgres://world:world@localhost:5432/world',
    jobPrefix:
      process.env.WORKFLOW_SQL_JOB_PREFIX ||
      process.env.WORKFLOW_POSTGRES_JOB_PREFIX,
    queueConcurrency:
      parseInt(
        process.env.WORKFLOW_SQL_WORKER_CONCURRENCY ||
          process.env.WORKFLOW_POSTGRES_WORKER_CONCURRENCY ||
          '10',
        10
      ) || 10,
  }
): World & { start(): Promise<void> } {
  // Determine database type
  const dbType =
    config.databaseType || detectDatabaseType(config.connectionString);

  // Get the appropriate schema
  const schema = getSchema(dbType);

  // Create database adapter (synchronous, lazy connection)
  const adapter = createAdapter(dbType, config.connectionString, schema);

  // Create queue adapter (synchronous)
  const queue = createQueueAdapter(dbType, adapter, schema, {
    jobPrefix: config.jobPrefix,
    queueConcurrency: config.queueConcurrency,
  });

  // Create storage
  const storage = createStorage(adapter, schema, dbType);

  // Create streaming adapter
  const streamer = createStreamingAdapter(dbType, adapter, schema);

  // Create auth provider
  const auth = createAuthProvider(config, adapter);

  return {
    ...storage,
    ...streamer,
    ...auth,
    ...queue,
    async start() {
      // Connect to database first
      await adapter.connect();
      // Then start queue worker
      await queue.start();
    },
  };
}
