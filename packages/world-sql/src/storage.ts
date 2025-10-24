import { WorkflowAPIError } from '@workflow/errors';
import type {
  Event,
  ListEventsParams,
  ListHooksParams,
  PaginatedResponse,
  Storage,
} from '@workflow/world';
import { and, desc, eq, gt, lt, type SQL } from 'drizzle-orm';
import { monotonicFactory } from 'ulid';
import type { DatabaseAdapter } from './adapters/index.js';
import type { DatabaseType } from './config.js';
import { compact } from './util.js';

export type SerializedContent = any[];

/**
 * Helper to update a row and return the updated value
 * MySQL doesn't support RETURNING, so we need to SELECT after UPDATE
 *
 * For MySQL, we need to SELECT using the primary key, not the original WHERE clause,
 * because the WHERE clause might include conditions on fields that were just updated.
 */
async function updateAndReturn<T>(
  dbType: DatabaseType,
  drizzle: any,
  table: any,
  updates: Record<string, any>,
  where: SQL | undefined,
  primaryKeyColumn?: any,
  primaryKeyValue?: string
): Promise<T[]> {
  if (dbType === 'mysql') {
    if (!primaryKeyColumn || !primaryKeyValue) {
      throw new Error(
        'MySQL requires primaryKeyColumn and primaryKeyValue for updateAndReturn'
      );
    }
    // Execute the update with the original WHERE clause
    await drizzle.update(table).set(updates).where(where);
    // SELECT using the primary key to get the updated row
    return drizzle
      .select()
      .from(table)
      .where(eq(primaryKeyColumn, primaryKeyValue))
      .limit(1);
  } else {
    return drizzle.update(table).set(updates).where(where).returning();
  }
}

/**
 * Helper to insert a row and return the inserted value
 * MySQL doesn't support RETURNING, so we need to SELECT after INSERT
 */
async function insertAndReturn<T>(
  dbType: DatabaseType,
  drizzle: any,
  table: any,
  values: Record<string, any>,
  primaryKeyColumn: any,
  primaryKeyValue: string,
  onConflict?: 'doNothing' | 'doUpdate'
): Promise<T[]> {
  if (dbType === 'mysql') {
    try {
      await drizzle.insert(table).values(values);
    } catch (error: any) {
      // MySQL duplicate entry error code is 1062
      if (onConflict === 'doNothing' && error.errno === 1062) {
        // Duplicate key - this is expected, just fetch the existing row
      } else {
        // Other error - re-throw
        throw error;
      }
    }

    // SELECT using the primary key to get the inserted/existing row
    return drizzle
      .select()
      .from(table)
      .where(eq(primaryKeyColumn, primaryKeyValue))
      .limit(1);
  } else {
    // SQLite supports RETURNING
    let insertQuery = drizzle.insert(table).values(values);

    if (onConflict === 'doNothing') {
      insertQuery = insertQuery.onConflictDoNothing();
    }

    return insertQuery.returning();
  }
}

export function createRunsStorage(
  adapter: DatabaseAdapter,
  schema: any,
  dbType: DatabaseType
): Storage['runs'] {
  const ulid = monotonicFactory();
  const { runs } = schema;
  const drizzle = adapter.drizzle;

  return {
    async get(id) {
      const [value] = await drizzle
        .select()
        .from(runs)
        .where(eq(runs.runId, id))
        .limit(1);
      if (!value) {
        throw new WorkflowAPIError(`Run not found: ${id}`, { status: 404 });
      }
      return compact(value) as any;
    },
    async cancel(id) {
      // TODO: we might want to guard this for only specific statuses
      const [value] = await updateAndReturn(
        dbType,
        drizzle,
        runs,
        { status: 'cancelled', completedAt: new Date() },
        eq(runs.runId, id),
        runs.runId,
        id
      );
      if (!value) {
        throw new WorkflowAPIError(`Run not found: ${id}`, { status: 404 });
      }
      return compact(value) as any;
    },
    async pause(id) {
      // TODO: we might want to guard this for only specific statuses
      const [value] = await updateAndReturn(
        dbType,
        drizzle,
        runs,
        { status: 'paused' },
        eq(runs.runId, id),
        runs.runId,
        id
      );
      if (!value) {
        throw new WorkflowAPIError(`Run not found: ${id}`, { status: 404 });
      }
      return compact(value) as any;
    },
    async resume(id) {
      const [value] = await updateAndReturn(
        dbType,
        drizzle,
        runs,
        { status: 'running' },
        and(eq(runs.runId, id), eq(runs.status, 'paused')),
        runs.runId,
        id
      );
      if (!value) {
        throw new WorkflowAPIError(`Paused run not found: ${id}`, {
          status: 404,
        });
      }
      return compact(value) as any;
    },
    async list(params) {
      const limit = params?.pagination?.limit ?? 20;
      const fromCursor = params?.pagination?.cursor;

      const all = await drizzle
        .select()
        .from(runs)
        .where(
          and(
            map(fromCursor, (c) => lt(runs.runId, c)),
            map(params?.workflowName, (wf) => eq(runs.workflowName, wf)),
            map(params?.status, (wf) => eq(runs.status, wf))
          )
        )
        .orderBy(desc(runs.runId))
        .limit(limit + 1);
      const values = all.slice(0, limit);
      const hasMore = all.length > limit;

      return {
        data: values.map(compact),
        hasMore,
        cursor: values.at(-1)?.runId ?? null,
      };
    },
    async create(data) {
      const runId = `wrun_${ulid()}`;
      // Database-specific conflict handling
      if (dbType === 'mysql') {
        // MySQL: Check if run exists first
        const [existing] = await drizzle
          .select()
          .from(runs)
          .where(eq(runs.runId, runId))
          .limit(1);

        if (existing) {
          throw new WorkflowAPIError(`Run ${runId} already exists`, {
            status: 409,
          });
        }
      }

      // Insert the new run
      const [value] = await insertAndReturn(
        dbType,
        drizzle,
        runs,
        {
          runId,
          input: data.input,
          executionContext: data.executionContext as Record<
            string,
            unknown
          > | null,
          deploymentId: data.deploymentId,
          status: 'pending',
          workflowName: data.workflowName,
        },
        runs.runId,
        runId,
        dbType === 'mysql' ? undefined : 'doNothing'
      );

      if (!value) {
        throw new WorkflowAPIError(`Run ${runId} already exists`, {
          status: 409,
        });
      }
      return compact(value) as any;
    },
    async update(id, data) {
      // Fetch current run to check if startedAt is already set
      const [currentRun] = await drizzle
        .select()
        .from(runs)
        .where(eq(runs.runId, id))
        .limit(1);

      if (!currentRun) {
        throw new WorkflowAPIError(`Run not found: ${id}`, { status: 404 });
      }

      const updates: Partial<typeof runs._.inferInsert> = {
        ...data,
        output: data.output as SerializedContent,
      };

      // Only set startedAt the first time transitioning to 'running'
      if (data.status === 'running' && !currentRun.startedAt) {
        updates.startedAt = new Date();
      }
      if (
        data.status === 'completed' ||
        data.status === 'failed' ||
        data.status === 'cancelled'
      ) {
        updates.completedAt = new Date();
      }

      const [value] = await updateAndReturn(
        dbType,
        drizzle,
        runs,
        updates,
        eq(runs.runId, id),
        runs.runId,
        id
      );
      if (!value) {
        throw new WorkflowAPIError(`Run not found: ${id}`, { status: 404 });
      }
      return compact(value) as any;
    },
  };
}

function map<T, R>(obj: T | null | undefined, fn: (v: T) => R): undefined | R {
  return obj ? fn(obj) : undefined;
}

export function createEventsStorage(
  adapter: DatabaseAdapter,
  schema: any,
  dbType: DatabaseType
): Storage['events'] {
  const ulid = monotonicFactory();
  const { events } = schema;
  const drizzle = adapter.drizzle;

  return {
    async create(runId, data) {
      const eventId = `wevt_${ulid()}`;

      let value;
      if (dbType === 'mysql') {
        // MySQL: INSERT then SELECT
        await drizzle.insert(events).values({
          runId,
          eventId,
          correlationId: data.correlationId,
          eventType: data.eventType,
          eventData: 'eventData' in data ? data.eventData : undefined,
        });

        const [result] = await drizzle
          .select({ createdAt: events.createdAt })
          .from(events)
          .where(eq(events.eventId, eventId))
          .limit(1);
        value = result;
      } else {
        // SQLite/PostgreSQL: use RETURNING
        const [result] = await drizzle
          .insert(events)
          .values({
            runId,
            eventId,
            correlationId: data.correlationId,
            eventType: data.eventType,
            eventData: 'eventData' in data ? data.eventData : undefined,
          })
          .returning({ createdAt: events.createdAt });
        value = result;
      }

      if (!value) {
        throw new WorkflowAPIError(`Event ${eventId} could not be created`, {
          status: 409,
        });
      }
      return { ...data, ...value, runId, eventId };
    },
    async list(params: ListEventsParams): Promise<PaginatedResponse<Event>> {
      const limit = params?.pagination?.limit ?? 100;
      const sortOrder = params.pagination?.sortOrder || 'asc';
      const order =
        sortOrder === 'desc'
          ? { by: desc(events.eventId), compare: lt }
          : { by: events.eventId, compare: gt };
      const all = await drizzle
        .select()
        .from(events)
        .where(
          and(
            eq(events.runId, params.runId),
            map(params.pagination?.cursor, (c) =>
              order.compare(events.eventId, c)
            )
          )
        )
        .orderBy(order.by)
        .limit(limit + 1);

      const values = all.slice(0, limit);

      return {
        data: values.map(compact) as Event[],
        cursor: values.at(-1)?.eventId ?? null,
        hasMore: all.length > limit,
      };
    },
    async listByCorrelationId(params) {
      const limit = params?.pagination?.limit ?? 100;
      const sortOrder = params.pagination?.sortOrder || 'asc';
      const order =
        sortOrder === 'desc'
          ? { by: desc(events.eventId), compare: lt }
          : { by: events.eventId, compare: gt };
      const all = await drizzle
        .select()
        .from(events)
        .where(
          and(
            eq(events.correlationId, params.correlationId),
            map(params.pagination?.cursor, (c) =>
              order.compare(events.eventId, c)
            )
          )
        )
        .orderBy(order.by)
        .limit(limit + 1);

      const values = all.slice(0, limit);

      return {
        data: values.map(compact) as Event[],
        cursor: values.at(-1)?.eventId ?? null,
        hasMore: all.length > limit,
      };
    },
  };
}

export function createHooksStorage(
  adapter: DatabaseAdapter,
  schema: any,
  dbType: DatabaseType
): Storage['hooks'] {
  const { hooks } = schema;
  const drizzle = adapter.drizzle;

  return {
    async get(hookId) {
      const [value] = await drizzle
        .select()
        .from(hooks)
        .where(eq(hooks.hookId, hookId))
        .limit(1);
      return compact(value) as any;
    },
    async create(runId, data) {
      const [value] = await insertAndReturn(
        dbType,
        drizzle,
        hooks,
        {
          runId,
          hookId: data.hookId,
          token: data.token,
          ownerId: '', // TODO: get from context
          projectId: '', // TODO: get from context
          environment: '', // TODO: get from context
        },
        hooks.hookId,
        data.hookId,
        'doNothing'
      );
      if (!value) {
        throw new WorkflowAPIError(`Hook ${data.hookId} already exists`, {
          status: 409,
        });
      }
      return compact(value) as any;
    },
    async getByToken(token) {
      const [value] = await drizzle
        .select()
        .from(hooks)
        .where(eq(hooks.token, token))
        .limit(1);
      if (!value) {
        throw new WorkflowAPIError(`Hook not found for token: ${token}`, {
          status: 404,
        });
      }
      return compact(value) as any;
    },
    async list(params: ListHooksParams) {
      const limit = params?.pagination?.limit ?? 100;
      const fromCursor = params?.pagination?.cursor;
      const all = await drizzle
        .select()
        .from(hooks)
        .where(
          and(
            map(params.runId, (id) => eq(hooks.runId, id)),
            map(fromCursor, (c) => lt(hooks.hookId, c))
          )
        )
        .orderBy(desc(hooks.hookId))
        .limit(limit + 1);
      const values = all.slice(0, limit);
      const hasMore = all.length > limit;
      return {
        data: values.map(compact),
        cursor: values.at(-1)?.hookId ?? null,
        hasMore,
      };
    },
    async dispose(hookId) {
      let value;
      if (dbType === 'mysql') {
        // MySQL: SELECT before DELETE
        const [existing] = await drizzle
          .select()
          .from(hooks)
          .where(eq(hooks.hookId, hookId))
          .limit(1);
        if (!existing) {
          throw new WorkflowAPIError(`Hook not found: ${hookId}`, {
            status: 404,
          });
        }
        await drizzle.delete(hooks).where(eq(hooks.hookId, hookId));
        value = existing;
      } else {
        // SQLite supports DELETE...RETURNING
        const [deleted] = await drizzle
          .delete(hooks)
          .where(eq(hooks.hookId, hookId))
          .returning();
        if (!deleted) {
          throw new WorkflowAPIError(`Hook not found: ${hookId}`, {
            status: 404,
          });
        }
        value = deleted;
      }
      return compact(value) as any;
    },
  };
}

export function createStepsStorage(
  adapter: DatabaseAdapter,
  schema: any,
  dbType: DatabaseType
): Storage['steps'] {
  const { steps } = schema;
  const drizzle = adapter.drizzle;

  return {
    async create(runId, data) {
      // Insert the step - use INSERT IGNORE to handle duplicates gracefully
      const [value] = await insertAndReturn(
        dbType,
        drizzle,
        steps,
        {
          runId,
          stepId: data.stepId,
          stepName: data.stepName,
          input: data.input as SerializedContent,
          status: 'pending',
          attempt: 1,
        },
        steps.stepId,
        data.stepId,
        'doNothing'
      );

      if (!value) {
        throw new WorkflowAPIError(`Step ${data.stepId} already exists`, {
          status: 409,
        });
      }
      return compact(value) as any;
    },
    async get(runId, stepId) {
      const [value] = await drizzle
        .select()
        .from(steps)
        .where(and(eq(steps.stepId, stepId), eq(steps.runId, runId)))
        .limit(1);
      if (!value) {
        throw new WorkflowAPIError(`Step not found: ${stepId}`, {
          status: 404,
        });
      }
      return compact(value) as any;
    },
    async update(runId, stepId, data) {
      // Fetch current step to check if startedAt is already set
      const [currentStep] = await drizzle
        .select()
        .from(steps)
        .where(and(eq(steps.stepId, stepId), eq(steps.runId, runId)))
        .limit(1);

      if (!currentStep) {
        throw new WorkflowAPIError(`Step not found: ${stepId}`, {
          status: 404,
        });
      }

      const updates: Partial<typeof steps._.inferInsert> = {
        ...data,
        output: data.output as SerializedContent,
      };
      const now = new Date();
      // Only set startedAt the first time the step transitions to 'running'
      if (data.status === 'running' && !currentStep.startedAt) {
        updates.startedAt = now;
      }
      if (data.status === 'completed' || data.status === 'failed') {
        updates.completedAt = now;
      }
      const [value] = await updateAndReturn(
        dbType,
        drizzle,
        steps,
        updates,
        and(eq(steps.stepId, stepId), eq(steps.runId, runId)),
        steps.stepId,
        stepId
      );
      if (!value) {
        throw new WorkflowAPIError(`Step not found: ${stepId}`, {
          status: 404,
        });
      }
      return compact(value) as any;
    },
    async list(params) {
      const limit = params?.pagination?.limit ?? 20;
      const fromCursor = params?.pagination?.cursor;

      const all = await drizzle
        .select()
        .from(steps)
        .where(
          and(
            eq(steps.runId, params.runId),
            map(fromCursor, (c) => lt(steps.stepId, c))
          )
        )
        .orderBy(desc(steps.stepId))
        .limit(limit + 1);
      const values = all.slice(0, limit);
      const hasMore = all.length > limit;

      return {
        data: values.map(compact),
        hasMore,
        cursor: values.at(-1)?.stepId ?? null,
      };
    },
  };
}
