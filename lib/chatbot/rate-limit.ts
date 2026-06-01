// Lightweight per-user rate limiter for the chatbot endpoint.
// In-memory sliding window — adequate for a single Railway instance.
// Switch to Redis if the app ever scales horizontally.

interface Bucket {
  hourly: number[];
  minute: number[];
}

const buckets = new Map<string, Bucket>();

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOURLY_CAP = parseInt(process.env.CHATBOT_RATE_LIMIT_PER_HOUR ?? '20', 10);
const MINUTE_CAP = 5;

export interface RateLimitDecision {
  allowed: boolean;
  remainingHour: number;
  retryAfterSec?: number;
}

export function consumeRateLimit(userId: string): RateLimitDecision {
  const now = Date.now();
  const bucket: Bucket = buckets.get(userId) ?? { hourly: [], minute: [] };
  bucket.hourly = bucket.hourly.filter((t) => now - t < HOUR_MS);
  bucket.minute = bucket.minute.filter((t) => now - t < MINUTE_MS);

  if (bucket.minute.length >= MINUTE_CAP) {
    const oldest = bucket.minute[0];
    const retry = Math.ceil((MINUTE_MS - (now - oldest)) / 1000);
    buckets.set(userId, bucket);
    return { allowed: false, remainingHour: Math.max(0, HOURLY_CAP - bucket.hourly.length), retryAfterSec: retry };
  }

  if (bucket.hourly.length >= HOURLY_CAP) {
    const oldest = bucket.hourly[0];
    const retry = Math.ceil((HOUR_MS - (now - oldest)) / 1000);
    buckets.set(userId, bucket);
    return { allowed: false, remainingHour: 0, retryAfterSec: retry };
  }

  bucket.hourly.push(now);
  bucket.minute.push(now);
  buckets.set(userId, bucket);
  return { allowed: true, remainingHour: HOURLY_CAP - bucket.hourly.length };
}
