import {
  type Event,
  type Hook,
  type Step,
  type WorkflowRun,
} from '@workflow/world';
import {
  binary,
  boolean,
  index,
  int,
  json,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

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

export const runs = mysqlTable(
  'workflow_runs',
  {
    runId: varchar('id', { length: 255 }).primaryKey(),
    output: json('output').$type<SerializedContent>(),
    deploymentId: varchar('deployment_id', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    workflowName: varchar('name', { length: 255 }).notNull(),
    executionContext: json('execution_context').$type<Record<string, any>>(),
    input: json('input').$type<SerializedContent>().notNull(),
    error: text('error'),
    errorCode: varchar('error_code', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
    completedAt: timestamp('completed_at'),
    startedAt: timestamp('started_at'),
  } satisfies DrizzlishOfType<WorkflowRun>,
  (tb) => ({
    workflowNameIdx: index('workflow_name_idx').on(tb.workflowName),
    statusIdx: index('status_idx').on(tb.status),
  })
);

export const events = mysqlTable(
  'workflow_events',
  {
    eventId: varchar('id', { length: 255 }).primaryKey(),
    eventType: varchar('type', { length: 255 })
      .$type<Event['eventType']>()
      .notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    runId: varchar('run_id', { length: 255 }).notNull(),
    eventData: json('payload'),
  } satisfies DrizzlishOfType<Event & { eventData?: undefined }>,
  (tb) => ({
    runFk: index('run_fk_idx').on(tb.runId),
    correlationIdFk: index('correlation_id_fk_idx').on(tb.correlationId),
  })
);

export const steps = mysqlTable(
  'workflow_steps',
  {
    runId: varchar('run_id', { length: 255 }).notNull(),
    stepId: varchar('step_id', { length: 255 }).primaryKey(),
    stepName: varchar('step_name', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    input: json('input').$type<SerializedContent>().notNull(),
    output: json('output').$type<SerializedContent>(),
    error: text('error'),
    errorCode: varchar('error_code', { length: 255 }),
    attempt: int('attempt').notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  } satisfies DrizzlishOfType<Step>,
  (tb) => ({
    runFk: index('run_fk_idx').on(tb.runId),
    statusIdx: index('status_idx').on(tb.status),
  })
);

export const hooks = mysqlTable(
  'workflow_hooks',
  {
    runId: varchar('run_id', { length: 255 }).notNull(),
    hookId: varchar('hook_id', { length: 255 }).primaryKey(),
    token: varchar('token', { length: 255 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    projectId: varchar('project_id', { length: 255 }).notNull(),
    environment: varchar('environment', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    metadata: json('metadata').$type<SerializedContent>(),
  } satisfies DrizzlishOfType<Hook>,
  (tb) => ({
    runFk: index('run_fk_idx').on(tb.runId),
    tokenIdx: index('token_idx').on(tb.token),
  })
);

export const streams = mysqlTable(
  'workflow_stream_chunks',
  {
    chunkId: varchar('id', { length: 255 }).$type<`chnk_${string}`>().notNull(),
    streamId: varchar('stream_id', { length: 255 }).notNull(),
    chunkData: binary('data').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    eof: boolean('eof').notNull(),
  },
  (tb) => ({
    primaryKey: primaryKey({ columns: [tb.streamId, tb.chunkId] }),
  })
);

export const jobs = mysqlTable(
  'workflow_jobs',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    queueName: varchar('queue_name', { length: 255 }).notNull(),
    payload: json('payload').notNull(),
    status: varchar('status', { length: 50 })
      .notNull()
      .$default(() => 'pending'),
    attempts: int('attempts')
      .notNull()
      .$default(() => 0),
    maxAttempts: int('max_attempts')
      .notNull()
      .$default(() => 3),
    lockedUntil: timestamp('locked_until'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
    scheduledFor: timestamp('scheduled_for').defaultNow().notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    error: text('error'),
  },
  (tb) => ({
    queueNameIdx: index('queue_name_idx').on(tb.queueName),
    statusIdx: index('status_idx').on(tb.status),
    scheduledIdx: index('scheduled_idx').on(tb.scheduledFor),
    idempotencyIdx: index('idempotency_idx').on(tb.idempotencyKey),
  })
);
