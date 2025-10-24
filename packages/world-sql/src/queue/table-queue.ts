import * as Stream from 'node:stream';
import { JsonTransport } from '@vercel/queue';
import {
  MessageId,
  QueuePayloadSchema,
  type QueuePrefix,
  type ValidQueueName,
} from '@workflow/world';
import { createEmbeddedWorld } from '@workflow/world-local';
import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { monotonicFactory } from 'ulid';
import type { DatabaseType } from '../config.js';
import type { DatabaseAdapter } from '../adapters/index.js';
import { MessageData } from '../boss.js';
import type { QueueAdapter, QueueAdapterConfig } from './base.js';

/**
 * Table-based queue adapter for MySQL and SQLite using polling
 */
export function createTableQueue(
  dbType: DatabaseType,
  adapter: DatabaseAdapter,
  schema: any,
  config: QueueAdapterConfig
): QueueAdapter {
  const port = process.env.PORT ? Number(process.env.PORT) : undefined;
  const embeddedWorld = createEmbeddedWorld({ dataDir: undefined, port });

  const transport = new JsonTransport();
  const generateMessageId = monotonicFactory();
  const drizzle = adapter.drizzle;
  const { jobs } = schema;

  const prefix = config.jobPrefix || 'workflow_';
  const Queues = {
    __wkf_workflow_: `${prefix}flows`,
    __wkf_step_: `${prefix}steps`,
  } as const satisfies Record<QueuePrefix, string>;

  const createQueueHandler = embeddedWorld.createQueueHandler;

  const getDeploymentId = async () => {
    return 'sql';
  };

  const queue: QueueAdapter['queue'] = async (queue, message, opts) => {
    const [prefix, queueId] = parseQueueName(queue);
    const jobName = Queues[prefix];
    const body = transport.serialize(message);
    const messageId = MessageId.parse(`msg_${generateMessageId()}`);

    const jobData = MessageData.encode({
      id: queueId,
      data: body,
      attempt: 1,
      messageId,
      idempotencyKey: opts?.idempotencyKey,
    });

    // Check for existing job with idempotency key
    if (opts?.idempotencyKey) {
      const [existing] = await drizzle
        .select()
        .from(jobs)
        .where(eq(jobs.idempotencyKey, opts.idempotencyKey))
        .limit(1);

      if (existing) {
        return { messageId: existing.id };
      }
    }

    await drizzle.insert(jobs).values({
      id: messageId,
      queueName: jobName,
      payload: jobData,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      scheduledFor: new Date(),
      idempotencyKey: opts?.idempotencyKey,
    });

    return { messageId };
  };

  // Worker state
  let workerIntervals: NodeJS.Timeout[] = [];
  let isRunning = false;

  async function processJob(job: any) {
    const now = new Date();
    const lockDuration = 30000; // 30 seconds
    const lockUntil = new Date(now.getTime() + lockDuration);

    // Try to lock the job
    let locked;
    if (dbType === 'mysql') {
      // MySQL doesn't support RETURNING, so UPDATE then SELECT
      const result = await drizzle
        .update(jobs)
        .set({
          status: 'processing',
          lockedUntil: lockUntil,
          attempts: job.attempts + 1,
        })
        .where(
          and(
            eq(jobs.id, job.id),
            eq(jobs.status, 'pending'),
            or(isNull(jobs.lockedUntil), lte(jobs.lockedUntil, now))
          )
        );

      // Check if update succeeded (affected rows > 0)
      if ((result as any).rowsAffected === 0) {
        // Job was locked by another worker
        return;
      }

      // SELECT the locked job
      const [lockedJob] = await drizzle
        .select()
        .from(jobs)
        .where(eq(jobs.id, job.id))
        .limit(1);
      locked = lockedJob;
    } else {
      // SQLite supports RETURNING
      const [lockedJob] = await drizzle
        .update(jobs)
        .set({
          status: 'processing',
          lockedUntil: lockUntil,
          attempts: job.attempts + 1,
        })
        .where(
          and(
            eq(jobs.id, job.id),
            eq(jobs.status, 'pending'),
            or(isNull(jobs.lockedUntil), lte(jobs.lockedUntil, now))
          )
        )
        .returning();
      locked = lockedJob;
    }

    if (!locked) {
      // Job was locked by another worker
      return;
    }

    try {
      const messageData = MessageData.parse(job.payload);
      const bodyStream = Stream.Readable.toWeb(
        Stream.Readable.from([messageData.data])
      );
      const body = await transport.deserialize(
        bodyStream as ReadableStream<Uint8Array>
      );
      const message = QueuePayloadSchema.parse(body);

      // Determine queue prefix from job queue name
      let queuePrefix: QueuePrefix;
      if (job.queueName.endsWith('flows')) {
        queuePrefix = '__wkf_workflow_';
      } else if (job.queueName.endsWith('steps')) {
        queuePrefix = '__wkf_step_';
      } else {
        throw new Error(`Unknown queue name: ${job.queueName}`);
      }

      const queueName = `${queuePrefix}${messageData.id}` as const;
      await embeddedWorld.queue(queueName, message, {
        idempotencyKey: messageData.idempotencyKey,
      });

      // Mark job as completed
      await drizzle
        .update(jobs)
        .set({
          status: 'completed',
          lockedUntil: null,
        })
        .where(eq(jobs.id, job.id));
    } catch (error) {
      // Handle job failure
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (job.attempts + 1 >= job.maxAttempts) {
        // Max attempts reached, mark as failed
        await drizzle
          .update(jobs)
          .set({
            status: 'failed',
            error: errorMessage,
            lockedUntil: null,
          })
          .where(eq(jobs.id, job.id));
      } else {
        // Retry with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, job.attempts), 60000);
        const scheduledFor = new Date(Date.now() + retryDelay);

        await drizzle
          .update(jobs)
          .set({
            status: 'pending',
            scheduledFor,
            error: errorMessage,
            lockedUntil: null,
          })
          .where(eq(jobs.id, job.id));
      }
    }
  }

  async function pollQueue(queueName: string) {
    if (!isRunning) return;

    try {
      const now = new Date();

      // Get available jobs
      const availableJobs = await drizzle
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.queueName, queueName),
            eq(jobs.status, 'pending'),
            lte(jobs.scheduledFor, now),
            or(isNull(jobs.lockedUntil), lte(jobs.lockedUntil, now))
          )
        )
        .limit(10); // Process up to 10 jobs per poll

      await Promise.all(availableJobs.map(processJob));
    } catch (error) {
      console.error(`Error polling queue ${queueName}:`, error);
    }
  }

  async function startWorker(queueName: string) {
    // Poll every 200ms (cheap polling as requested)
    const interval = setInterval(() => pollQueue(queueName), 200);
    workerIntervals.push(interval);
  }

  async function setupListeners() {
    for (const [_prefix, jobName] of Object.entries(Queues) as [
      QueuePrefix,
      string,
    ][]) {
      // Start multiple workers for concurrency
      const concurrency = config.queueConcurrency || 10;
      for (let i = 0; i < concurrency; i++) {
        await startWorker(jobName);
      }
    }
  }

  return {
    createQueueHandler,
    getDeploymentId,
    queue,
    async start() {
      isRunning = true;
      await setupListeners();
    },
    async stop() {
      isRunning = false;
      workerIntervals.forEach(clearInterval);
      workerIntervals = [];
    },
  };
}

const parseQueueName = (name: ValidQueueName): [QueuePrefix, string] => {
  const prefixes: QueuePrefix[] = ['__wkf_step_', '__wkf_workflow_'];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      return [prefix, name.slice(prefix.length)];
    }
  }
  throw new Error(`Invalid queue name: ${name}`);
};
