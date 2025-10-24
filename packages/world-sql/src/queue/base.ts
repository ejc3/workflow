import type { Queue } from '@workflow/world';

/**
 * Base interface for queue adapters
 */
export interface QueueAdapter extends Queue {
  /**
   * Start the queue workers
   */
  start(): Promise<void>;

  /**
   * Stop the queue workers
   */
  stop?(): Promise<void>;
}

export interface QueueAdapterConfig {
  jobPrefix?: string;
  queueConcurrency?: number;
}
