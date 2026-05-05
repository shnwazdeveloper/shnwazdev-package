import { sanitizeHeaders, sanitizeUrl } from "./security.js";
import { timeout } from "./timing.js";

function createNamedError(name, message, details = {}) {
  const error = new Error(message);
  error.name = name;
  Object.assign(error, details);
  return error;
}

export function createRateLimiter(options = {}) {
  const limit = options.limit ?? 60;
  const interval = options.interval ?? 60000;
  const now = options.now ?? Date.now;
  const buckets = new Map();

  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError("limit must be a positive integer");
  }

  if (typeof interval !== "number" || interval < 1) {
    throw new TypeError("interval must be a positive number");
  }

  function getBucket(key) {
    const bucketKey = String(key ?? "global");
    const currentTime = now();
    const existing = buckets.get(bucketKey);

    if (!existing || currentTime >= existing.resetAt) {
      const fresh = {
        count: 0,
        resetAt: currentTime + interval
      };
      buckets.set(bucketKey, fresh);
      return fresh;
    }

    return existing;
  }

  function check(key = "global", cost = 1) {
    if (!Number.isInteger(cost) || cost < 1) {
      throw new TypeError("cost must be a positive integer");
    }

    const bucket = getBucket(key);
    const remaining = Math.max(0, limit - bucket.count);
    const allowed = remaining >= cost;

    return {
      allowed,
      limit,
      remaining: allowed ? remaining - cost : remaining,
      resetAt: bucket.resetAt,
      retryAfter: allowed ? 0 : Math.max(0, bucket.resetAt - now())
    };
  }

  return {
    check,

    consume(key = "global", cost = 1) {
      const result = check(key, cost);
      if (result.allowed) {
        getBucket(key).count += cost;
      }
      return result;
    },

    assert(key = "global", cost = 1) {
      const result = this.consume(key, cost);
      if (!result.allowed) {
        throw createNamedError(
          "RateLimitError",
          `Rate limit exceeded for ${String(key)}`,
          result
        );
      }
      return result;
    },

    reset(key) {
      if (typeof key === "undefined") {
        buckets.clear();
        return;
      }
      buckets.delete(String(key));
    },

    snapshot(key = "global") {
      const bucket = getBucket(key);
      return {
        limit,
        used: bucket.count,
        remaining: Math.max(0, limit - bucket.count),
        resetAt: bucket.resetAt
      };
    }
  };
}

export function createCircuitBreaker(task, options = {}) {
  if (typeof task !== "function") {
    throw new TypeError("task must be a function");
  }

  const failureThreshold = options.failureThreshold ?? 3;
  const recoveryTime = options.recoveryTime ?? 30000;
  const successThreshold = options.successThreshold ?? 1;
  const now = options.now ?? Date.now;
  let state = "closed";
  let failures = 0;
  let successes = 0;
  let openedAt = 0;
  let lastError;

  function setState(nextState) {
    if (state === nextState) {
      return;
    }
    const previousState = state;
    state = nextState;
    options.onStateChange?.(state, previousState, snapshot());
  }

  function open(error) {
    failures += 1;
    successes = 0;
    lastError = error;
    openedAt = now();
    setState("open");
  }

  function close() {
    failures = 0;
    successes = 0;
    lastError = undefined;
    openedAt = 0;
    setState("closed");
  }

  function snapshot() {
    return {
      state,
      failures,
      successes,
      openedAt,
      lastError
    };
  }

  return {
    async execute(...args) {
      if (state === "open") {
        if (now() - openedAt < recoveryTime) {
          throw createNamedError(
            "CircuitBreakerOpenError",
            "Circuit breaker is open",
            snapshot()
          );
        }
        setState("half-open");
      }

      try {
        const result = await task(...args);
        if (state === "half-open") {
          successes += 1;
          if (successes >= successThreshold) {
            close();
          }
        } else {
          failures = 0;
        }
        return result;
      } catch (error) {
        if (state === "half-open" || failures + 1 >= failureThreshold) {
          open(error);
        } else {
          failures += 1;
          lastError = error;
        }
        throw error;
      }
    },

    reset: close,
    snapshot
  };
}

function assertAllowedUrl(url, allowedOrigins = []) {
  if (allowedOrigins.length === 0) {
    return;
  }

  if (!allowedOrigins.includes(url.origin)) {
    throw createNamedError(
      "UnsafeUrlError",
      `Origin is not allowed: ${url.origin}`,
      { origin: url.origin }
    );
  }
}

export async function safeFetch(input, options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available in this runtime");
  }

  const url = new URL(input, options.baseUrl);
  assertAllowedUrl(url, options.allowedOrigins ?? []);

  const request = fetchImpl(url.toString(), {
    ...options.init,
    headers: options.init?.headers
  });

  const response = typeof options.timeout === "number"
    ? await timeout(request, options.timeout, "safeFetch timed out")
    : await request;

  return {
    response,
    safeRequest: {
      url: sanitizeUrl(url.toString(), options),
      headers: sanitizeHeaders(options.init?.headers, options)
    },
    ok: response.ok,
    status: response.status,
    statusText: response.statusText
  };
}
