/**
 * Simple in-memory rate limiter.
 *
 * Works per-serverless-instance. For multi-instance production deployments
 * replace the backing store with Upstash Redis (@upstash/ratelimit).
 *
 * Usage:
 *   const ok = rateLimit("generate-docx", ip, 10, 60_000); // 10 req / min
 *   if (!ok) return new Response("Too many requests", { status: 429 });
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Prune expired buckets periodically to avoid memory leaks
let lastPrune = Date.now();
function pruneIfNeeded() {
  const now = Date.now();
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}

/**
 * Returns `true` if the request is within the allowed rate.
 * Returns `false` if the limit has been exceeded.
 *
 * @param namespace  Logical group (e.g. "generate-docx")
 * @param identifier Unique key — typically user ID or IP
 * @param limit      Max requests per window
 * @param windowMs   Window size in milliseconds
 */
export function rateLimit(
  namespace: string,
  identifier: string,
  limit: number,
  windowMs: number
): boolean {
  pruneIfNeeded();

  const key = `${namespace}:${identifier}`;
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count++;
  return true;
}
