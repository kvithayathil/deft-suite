export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly msPerToken: number;

  constructor(
    private readonly bucketSize: number,
    private readonly refillPerMinute: number,
  ) {
    this.tokens = bucketSize;
    this.lastRefill = Date.now();
    this.msPerToken = 60_000 / refillPerMinute;
  }

  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  msUntilNextToken(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    const elapsed = Date.now() - this.lastRefill;
    const msIntoCurrentToken = elapsed % this.msPerToken;
    return Math.ceil(this.msPerToken - msIntoCurrentToken);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / this.msPerToken);
    if (newTokens > 0) {
      this.tokens = Math.min(this.bucketSize, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
}
