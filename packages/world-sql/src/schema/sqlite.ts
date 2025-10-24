import {
  type Event,
  type Hook,
  type Step,
  type WorkflowRun,
} from '@workflow/world';
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

/**
 * A mapped type that converts all properties of T to Drizzle ORM column definitions,
 * marking them as not nullable if they are not optional in T.
 */
type DrizzlishOfType<T extends object> = {
  [key in keyof T]-?: undefined extends T[key]
    ? { _: { notNull: boolean } }
    : { _: { notNull: true } };
};

/**
 * Sadly we do `any[]` right now
 */
export type SerializedContent = any[];

export const runs = sqliteTable(
  'workflow_runs',
  {
    runId: text('id').primaryKey(),
    output: text('output', { mode: 'json' }).$type<SerializedContent>(),
    deploymentId: text('deployment_id').notNull(),
    status: text('status').notNull(),
    workflowName: text('name').notNull(),
    executionContext: text('execution_context', { mode: 'json' }).$type<
      Record<string, any>
    >(),
    input: text('input', { mode: 'json' })
      .$type<SerializedContent>()
      .notNull(),
    error: text('error'),
    errorCode: text('error_code'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
      .notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    startedAt: integer('started_at', { mode: 'timestamp' }),
  } satisfies DrizzlishOfType<WorkflowRun>,
  (tb) => ({
    workflowNameIdx: index('workflow_name_idx').on(tb.workflowName),
    statusIdx: index('status_idx').on(tb.status),
  })
);

export const events = sqliteTable(
  'workflow_events',
  {
    eventId: text('id').primaryKey(),
    eventType: text('type').$type<Event['eventType']>().notNull(),
    correlationId: text('correlation_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    runId: text('run_id').notNull(),
    eventData: text('payload', { mode: 'json' }),
  } satisfies DrizzlishOfType<Event & { eventData?: undefined }>,
  (tb) => ({
    runFk: index('run_fk_idx').on(tb.runId),
    correlationIdFk: index('correlation_id_fk_idx').on(tb.correlationId),
  })
);

export const steps = sqliteTable(
  'workflow_steps',
  {
    runId: text('run_id').notNull(),
    stepId: text('step_id').primaryKey(),
    stepName: text('step_name').notNull(),
    status: text('status').notNull(),
    input: text('input', { mode: 'json' })
      .$type<SerializedContent>()
      .notNull(),
    output: text('output', { mode: 'json' }).$type<SerializedContent>(),
    error: text('error'),
    errorCode: text('error_code'),
    attempt: integer('attempt').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
      .notNull(),
  } satisfies DrizzlishOfType<Step>,
  (tb) => ({
    runFk: index('run_fk_idx').on(tb.runId),
    statusIdx: index('status_idx').on(tb.status),
  })
);

export const hooks = sqliteTable(
  'workflow_hooks',
  {
    runId: text('run_id').notNull(),
    hookId: text('hook_id').primaryKey(),
    token: text('token').notNull(),
    ownerId: text('owner_id').notNull(),
    projectId: text('project_id').notNull(),
    environment: text('environment').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    metadata: text('metadata', { mode: 'json' }).$type<SerializedContent>(),
  } satisfies DrizzlishOfType<Hook>,
  (tb) => ({
    runFk: index('run_fk_idx').on(tb.runId),
    tokenIdx: index('token_idx').on(tb.token),
  })
);

export const streams = sqliteTable(
  'workflow_stream_chunks',
  {
    chunkId: text('id').$type<`chnk_${string}`>().notNull(),
    streamId: text('stream_id').notNull(),
    chunkData: blob('data', { mode: 'buffer' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    eof: integer('eof', { mode: 'boolean' }).notNull(),
  },
  (tb) => ({
    primaryKey: primaryKey({ columns: [tb.streamId, tb.chunkId] }),
  })
);

export const jobs = sqliteTable(
  'workflow_jobs',
  {
    id: text('id').primaryKey(),
    queueName: text('queue_name').notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    status: text('status').notNull().$default(() => 'pending'),
    attempts: integer('attempts').notNull().$default(() => 0),
    maxAttempts: integer('max_attempts').notNull().$default(() => 3),
    lockedUntil: integer('locked_until', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
      .notNull(),
    scheduledFor: integer('scheduled_for', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    idempotencyKey: text('idempotency_key'),
    error: text('error'),
  },
  (tb) => ({
    queueNameIdx: index('queue_name_idx').on(tb.queueName),
    statusIdx: index('status_idx').on(tb.status),
    scheduledIdx: index('scheduled_idx').on(tb.scheduledFor),
    idempotencyIdx: index('idempotency_idx').on(tb.idempotencyKey),
  })
);
