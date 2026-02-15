/**
 * Rate limiter for Gemini API calls (15 RPM free tier)
 */

export class RateLimiter {
  private queue: (() => Promise<void>)[] = [];
  private activeRequests = 0;
  private requestTimestamps: number[] = [];
  private readonly maxRPM: number;
  private readonly windowMs = 60000; // 1 minute

  constructor(maxRequestsPerMinute: number) {
    this.maxRPM = maxRequestsPerMinute;
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait if we're at the rate limit
    await this.waitIfNeeded();

    // Execute the function
    this.activeRequests++;
    this.requestTimestamps.push(Date.now());

    try {
      const result = await fn();
      return result;
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  private async waitIfNeeded(): Promise<void> {
    // Clean up old timestamps (older than 1 minute)
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.windowMs
    );

    // If we're at the limit, wait until the oldest request expires
    if (this.requestTimestamps.length >= this.maxRPM) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp) + 100; // +100ms buffer

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeRequests < this.maxRPM) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus() {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.windowMs
    ).length;

    return {
      activeRequests: this.activeRequests,
      recentRequests,
      availableSlots: this.maxRPM - recentRequests,
      queuedRequests: this.queue.length,
    };
  }
}
