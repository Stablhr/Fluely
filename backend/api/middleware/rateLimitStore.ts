import type {IncrementResponse, Options, Store} from 'express-rate-limit';
import {rateLimitRepository} from '../repositories/rateLimit.repository';

/**
 * express-rate-limit store backed by MongoDB, so a limit holds across every
 * serverless instance instead of per instance.
 *
 * Each limiter gets its own `prefix` so two limiters keyed on the same client
 * never share a counter.
 */
export class MongoRateLimitStore implements Store {
  readonly prefix: string;
  readonly localKeys = false;
  private windowMs = 60 * 1000;

  constructor(prefix: string) {
    this.prefix = `${prefix}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const window = await rateLimitRepository.increment(this.prefix + key, this.windowMs);
    return {totalHits: window.hits, resetTime: window.resetAt};
  }

  async decrement(key: string): Promise<void> {
    await rateLimitRepository.decrement(this.prefix + key);
  }

  async resetKey(key: string): Promise<void> {
    await rateLimitRepository.reset(this.prefix + key);
  }
}
