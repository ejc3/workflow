import { EventEmitter } from 'node:events';
import { and, eq, gt } from 'drizzle-orm';
import { monotonicFactory } from 'ulid';
import type { DatabaseAdapter } from '../adapters/index.js';
import type { StreamingAdapter } from './base.js';

interface StreamChunkEvent {
  id: `chnk_${string}`;
  data: Uint8Array;
  eof: boolean;
}

/**
 * Polling-based streaming adapter for MySQL and SQLite
 */
export function createPollingStreaming(
  adapter: DatabaseAdapter,
  schema: any
): StreamingAdapter {
  const ulid = monotonicFactory();
  const events = new EventEmitter<{
    [key: `strm:${string}`]: [StreamChunkEvent];
  }>();
  const { streams } = schema;
  const drizzle = adapter.drizzle;
  const genChunkId = () => `chnk_${ulid()}` as const;

  // Track last seen chunk ID per stream for polling
  const lastSeenChunks = new Map<string, string>();
  const pollingIntervals = new Map<string, NodeJS.Timeout>();

  function startPolling(streamId: string) {
    if (pollingIntervals.has(streamId)) {
      return; // Already polling
    }

    const interval = setInterval(async () => {
      try {
        const lastChunkId = lastSeenChunks.get(streamId) || '';

        // Query for new chunks since last seen
        const conditions = [eq(streams.streamId, streamId)];
        if (lastChunkId) {
          conditions.push(gt(streams.chunkId, lastChunkId));
        }

        const newChunks = await drizzle
          .select({
            id: streams.chunkId,
            eof: streams.eof,
            data: streams.chunkData,
          })
          .from(streams)
          .where(and(...conditions))
          .orderBy(streams.chunkId)
          .limit(100);

        if (newChunks.length > 0) {
          const key = `strm:${streamId}` as const;

          for (const chunk of newChunks) {
            events.emit(key, {
              id: chunk.id,
              data: chunk.data instanceof Buffer
                ? new Uint8Array(chunk.data)
                : chunk.data,
              eof: chunk.eof,
            });
            lastSeenChunks.set(streamId, chunk.id);

            // Stop polling if we hit EOF
            if (chunk.eof) {
              stopPolling(streamId);
            }
          }
        }
      } catch (error) {
        console.error(`Error polling stream ${streamId}:`, error);
      }
    }, 200); // Poll every 200ms

    pollingIntervals.set(streamId, interval);
  }

  function stopPolling(streamId: string) {
    const interval = pollingIntervals.get(streamId);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.delete(streamId);
      lastSeenChunks.delete(streamId);
    }
  }

  return {
    async writeToStream(name, chunk) {
      const chunkId = genChunkId();
      await drizzle.insert(streams).values({
        chunkId,
        streamId: name,
        chunkData: !Buffer.isBuffer(chunk) ? Buffer.from(chunk) : chunk,
        eof: false,
      });

      // Start polling for this stream if there are listeners
      if (events.listenerCount(`strm:${name}` as const) > 0) {
        startPolling(name);
      }
    },
    async closeStream(name: string): Promise<void> {
      const chunkId = genChunkId();
      await drizzle.insert(streams).values({
        chunkId,
        streamId: name,
        chunkData: Buffer.from([]),
        eof: true,
      });
    },
    async readFromStream(
      name: string,
      startIndex?: number
    ): Promise<ReadableStream<Uint8Array>> {
      const cleanups: (() => void)[] = [];

      return new ReadableStream<Uint8Array>({
        async start(controller) {
          let lastChunkId = '';
          let offset = startIndex ?? 0;
          let buffer = [] as StreamChunkEvent[] | null;
          let closed = false;

          function enqueue(msg: {
            id: string;
            data: Uint8Array;
            eof: boolean;
          }) {
            if (closed || lastChunkId >= msg.id) {
              // already sent or out of order or closed
              return;
            }

            if (offset > 0) {
              offset--;
              return;
            }

            if (msg.data.byteLength) {
              controller.enqueue(new Uint8Array(msg.data));
            }
            if (msg.eof) {
              controller.close();
              closed = true;
              stopPolling(name);
            }
            lastChunkId = msg.id;
          }

          function onData(data: StreamChunkEvent) {
            if (buffer) {
              buffer.push(data);
              return;
            }
            enqueue(data);
          }

          events.on(`strm:${name}`, onData);
          cleanups.push(() => {
            events.off(`strm:${name}`, onData);
          });

          // Fetch existing chunks
          const chunks = await drizzle
            .select({
              id: streams.chunkId,
              eof: streams.eof,
              data: streams.chunkData,
            })
            .from(streams)
            .where(eq(streams.streamId, name))
            .orderBy(streams.chunkId);

          for (const chunk of chunks) {
            const data = chunk.data instanceof Buffer
              ? new Uint8Array(chunk.data)
              : chunk.data;

            if (buffer) {
              buffer.push({ id: chunk.id, data, eof: chunk.eof });
            } else {
              enqueue({ id: chunk.id, data, eof: chunk.eof });
            }
          }

          // If there's a buffered chunk list, process it now
          if (buffer) {
            for (const chunk of buffer) {
              enqueue(chunk);
            }
            buffer = null;
          }

          // Start polling for new chunks if not EOF yet
          if (!closed) {
            startPolling(name);
            lastSeenChunks.set(name, lastChunkId);
          }
        },
        cancel() {
          cleanups.forEach((fn) => fn());
          stopPolling(name);
        },
      });
    },
    async stop() {
      // Clean up all polling intervals
      for (const streamId of pollingIntervals.keys()) {
        stopPolling(streamId);
      }
    },
  };
}
