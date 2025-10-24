import type { Streamer } from '@workflow/world';

/**
 * Base interface for streaming adapters
 */
export interface StreamingAdapter extends Streamer {
  /**
   * Start the streaming system (if needed)
   */
  start?(): Promise<void>;

  /**
   * Stop the streaming system (if needed)
   */
  stop?(): Promise<void>;
}
