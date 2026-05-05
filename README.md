# @shnwazdeveloper/shnwazdev

Safe real-time utility toolkit for `shnwazdev` projects, published with GitHub Packages.

Use this package when you need small, dependency-free helpers for live app state, event messages, API polling, bot status checks, retries, timeouts, fast UI input control, and safe logging that avoids leaking tokens or private data.

## Package Links

- Package: https://github.com/shnwazdeveloper/shnwazdev-package/pkgs/npm/shnwazdev
- Repository: https://github.com/shnwazdeveloper/shnwazdev-package
- Owner: `shnwazdeveloper`
- Package name: `@shnwazdeveloper/shnwazdev`
- Registry: `https://npm.pkg.github.com`

## Install From GitHub Packages

GitHub Packages does not use the normal public npm registry for this scoped package. Add this line to your user or project `.npmrc`:

```ini
@shnwazdeveloper:registry=https://npm.pkg.github.com
```

If the package is installed on your own machine, connect npm to your GitHub token:

```powershell
gh auth refresh -h github.com -s read:packages
$token = gh auth token
npm config set "//npm.pkg.github.com/:_authToken" "$token" --location=user
```

Then install:

```bash
npm install @shnwazdeveloper/shnwazdev@0.4.0
```

## What Is Inside

- `createEventBus` for app events and message passing
- `createRealtimeStore` for live state with subscriptions and selectors
- `createPoller` for APIs, bots, dashboards, and workers
- `createHeartbeat` for live status checks
- `sleep` for async delays
- `timeout` for stopping slow promises
- `retry` for retrying unstable operations
- `debounce` for search boxes, resize handlers, and input events
- `throttle` for scroll, mousemove, and high-frequency events
- `redactSensitiveData` for removing passwords, tokens, cookies, and keys
- `detectSecrets` for finding sensitive values without printing raw secrets
- `assertNoSecrets` for failing fast when a payload contains sensitive data
- `safeJsonStringify` for circular-safe, redacted JSON output
- `createSafeLogger` for console-style logging with automatic redaction
- `maskSecret` for safe secret previews
- `createSecureId` for crypto-safe request IDs and trace IDs
- `constantTimeEqual` for safer token/signature comparisons
- `sanitizeHeaders` for redacted header logs
- `sanitizeUrl` for redacted URL logs
- `createRateLimiter` for local abuse protection
- `createCircuitBreaker` for failing safely when a dependency is unhealthy
- `safeFetch` for timeout-aware, origin-guarded fetch calls with safe request logs

## Quick Start

```js
import {
  createEventBus,
  createPoller,
  createRateLimiter,
  createRealtimeStore,
  createSafeLogger,
  retry,
  safeFetch,
  timeout
} from "@shnwazdeveloper/shnwazdev";

const store = createRealtimeStore({ online: false, users: 0 });

store.subscribe((state) => {
  console.log("state changed", state);
});

store.setState({ online: true });

const bus = createEventBus();
bus.on("message", (message) => console.log(message.text));
bus.emit("message", { text: "Hello from shnwazdev" });

const poller = createPoller(
  async () => {
    const response = await fetch("https://api.github.com");
    return response.status;
  },
  { interval: 5000 }
);

poller.onData((status) => console.log("GitHub status", status));
poller.start();

const response = await retry(
  () => timeout(fetch("https://api.github.com"), 3000),
  { retries: 2, delay: 500 }
);

console.log(response.status);

const logger = createSafeLogger(console);
logger.log("safe output", {
  username: "shnwazdeveloper",
  token: "example-token-that-will-be-redacted"
});

const limiter = createRateLimiter({ limit: 10, interval: 60000 });
limiter.assert("user:shnwazdeveloper");

const { status, safeRequest } = await safeFetch("https://api.github.com", {
  allowedOrigins: ["https://api.github.com"],
  timeout: 3000
});

logger.info("request finished", { status, safeRequest });
```

## Realtime Store

Use `createRealtimeStore` when several parts of an app need to react to shared state.

```js
import { createRealtimeStore } from "@shnwazdeveloper/shnwazdev";

const store = createRealtimeStore({ connected: false, count: 0 });

const unsubscribe = store.subscribe((nextState, previousState) => {
  console.log({ nextState, previousState });
});

store.select(
  (state) => state.count,
  (count) => console.log("count changed", count)
);

store.setState({ connected: true });
store.update((state) => ({ count: state.count + 1 }));

await store.waitFor((state) => state.count >= 1, { timeout: 1000 });

unsubscribe();
```

## Event Bus

Use `createEventBus` for local publish/subscribe events.

```js
import { createEventBus } from "@shnwazdeveloper/shnwazdev";

const bus = createEventBus();

const off = bus.on("user:joined", (user) => {
  console.log(`${user.name} joined`);
});

bus.once("ready", () => {
  console.log("ready only runs one time");
});

bus.emit("user:joined", { name: "Shnwaz" });
bus.emit("ready");

off();
```

## Poller

Use `createPoller` to repeatedly run async work.

```js
import { createPoller } from "@shnwazdeveloper/shnwazdev";

const poller = createPoller(
  async ({ runCount }) => {
    const response = await fetch("https://api.github.com");
    return {
      runCount,
      ok: response.ok,
      status: response.status
    };
  },
  {
    interval: 5000,
    backoff: 2,
    maxInterval: 30000
  }
);

poller.onData((data) => console.log("data", data));
poller.onError((error) => console.error("poll failed", error));

poller.start();

const firstOk = await poller.until((data) => data.ok, { timeout: 20000 });
console.log(firstOk);

poller.stop();
```

## Heartbeat

Use `createHeartbeat` when you want a small live signal for a bot, dashboard, worker, or connection monitor.

```js
import { createHeartbeat } from "@shnwazdeveloper/shnwazdev";

const heartbeat = createHeartbeat({ interval: 1000 });

heartbeat.onBeat((beat) => {
  console.log(`beat ${beat.count}`, beat.lastBeatAt);
});

heartbeat.start();

setTimeout(() => {
  heartbeat.stop();
}, 5000);
```

## Timing Helpers

```js
import {
  debounce,
  retry,
  sleep,
  throttle,
  timeout
} from "@shnwazdeveloper/shnwazdev";

await sleep(500);

await timeout(fetch("https://api.github.com"), 3000);

await retry(
  async () => {
    const response = await fetch("https://api.github.com");
    if (!response.ok) {
      throw new Error("GitHub request failed");
    }
    return response;
  },
  { retries: 3, delay: 500, factor: 2 }
);

const onSearch = debounce((query) => {
  console.log("search", query);
}, 300);

const onScroll = throttle(() => {
  console.log("scroll event");
}, 100);
```

## Safety And Data Protection

Use these helpers before logging API responses, request headers, environment snapshots, bot session data, or errors. They are designed to keep useful structure while removing sensitive values.

### Redact Sensitive Data

```js
import { redactSensitiveData } from "@shnwazdeveloper/shnwazdev";

const safePayload = redactSensitiveData({
  username: "shnwazdeveloper",
  password: "my-password",
  headers: {
    authorization: "Bearer real-token-value"
  }
});

console.log(safePayload);
```

Output:

```js
{
  username: "shnwazdeveloper",
  password: "[REDACTED]",
  headers: {
    authorization: "[REDACTED]"
  }
}
```

### Detect Secrets Without Printing Them

```js
import { detectSecrets } from "@shnwazdeveloper/shnwazdev";

const findings = detectSecrets({
  apiKey: "real-api-key-value",
  message: "Bearer real-token-value"
});

console.log(findings);
```

Findings include the path, type, and a masked preview. Raw secret values are not returned.

### Fail Fast If Secrets Exist

```js
import { assertNoSecrets } from "@shnwazdeveloper/shnwazdev";

assertNoSecrets({
  public: "safe",
  token: "private-token"
});
```

If sensitive data is found, this throws a `SensitiveDataError`.

### Safe JSON

```js
import { safeJsonStringify } from "@shnwazdeveloper/shnwazdev";

const payload = { token: "private-token" };
payload.self = payload;

console.log(safeJsonStringify(payload));
```

This handles circular objects and redacts sensitive values.

### Safe Logger

```js
import { createSafeLogger } from "@shnwazdeveloper/shnwazdev";

const logger = createSafeLogger(console);

logger.info("request", {
  user: "shnwazdeveloper",
  cookie: "private-cookie",
  token: "private-token"
});
```

The logger keeps normal fields and replaces sensitive fields with `[REDACTED]`.

### Secure IDs And Safer Comparisons

```js
import {
  constantTimeEqual,
  createSecureId
} from "@shnwazdeveloper/shnwazdev";

const requestId = createSecureId({ prefix: "req_", size: 16 });
console.log(requestId);

if (constantTimeEqual(userInputToken, expectedToken)) {
  console.log("token matched");
}
```

`createSecureId` uses crypto-safe random bytes. `constantTimeEqual` compares strings without returning early on the first different character.

### Safe URL And Header Logging

```js
import {
  sanitizeHeaders,
  sanitizeUrl
} from "@shnwazdeveloper/shnwazdev";

console.log(sanitizeUrl("https://example.com/search?q=node&token=private"));

console.log(sanitizeHeaders({
  authorization: "Bearer private",
  accept: "application/json"
}));
```

This keeps useful debugging details while removing sensitive values.

## Advanced Resilience Helpers

### Rate Limiter

Use `createRateLimiter` to protect local commands, bots, API handlers, and expensive tasks from repeated calls.

```js
import { createRateLimiter } from "@shnwazdeveloper/shnwazdev";

const limiter = createRateLimiter({
  limit: 5,
  interval: 60000
});

try {
  limiter.assert("user:shnwazdeveloper");
  console.log("allowed");
} catch (error) {
  console.log(error.name, error.retryAfter);
}
```

### Circuit Breaker

Use `createCircuitBreaker` around unstable downstream work. After too many failures, it opens and stops calling the failing task until the recovery time passes.

```js
import { createCircuitBreaker } from "@shnwazdeveloper/shnwazdev";

const breaker = createCircuitBreaker(
  async () => {
    const response = await fetch("https://api.github.com");
    if (!response.ok) {
      throw new Error("GitHub request failed");
    }
    return response;
  },
  {
    failureThreshold: 3,
    recoveryTime: 30000
  }
);

const response = await breaker.execute();
console.log(response.status);
```

### Safe Fetch

Use `safeFetch` when you want origin checks, timeouts, and safe request metadata for logs.

```js
import { safeFetch } from "@shnwazdeveloper/shnwazdev";

const result = await safeFetch("https://api.github.com", {
  allowedOrigins: ["https://api.github.com"],
  timeout: 3000,
  init: {
    headers: {
      authorization: "Bearer private",
      accept: "application/json"
    }
  }
});

console.log(result.status);
console.log(result.safeRequest);
```

`safeRequest` contains a sanitized URL and sanitized headers, so you can log it without exposing private data.

## Development

Clone the repository:

```bash
git clone https://github.com/shnwazdeveloper/shnwazdev-package.git
cd shnwazdev-package
```

Run tests:

```bash
npm test
```

Check for accidental secrets:

```bash
npm run secret:check
```

Check what files will be published:

```bash
npm run pack:check
```

Run every safety check before publishing:

```bash
npm run safe:check
```

## Publish A New Version To Packages

GitHub Actions publishes this package automatically when a version tag is pushed.

1. Edit the code or README.
2. Update `version` in `package.json`.
3. Run checks:

```bash
npm test
npm run secret:check
npm run pack:check
```

4. Commit and push:

```bash
git add .
git commit -m "Update package"
git push origin main
```

5. Create and push a version tag:

```bash
git tag v0.4.0
git push origin v0.4.0
```

After the tag is pushed, the `Publish Package` GitHub Actions workflow runs and publishes the new version to GitHub Packages.

## How This Package Avoids Leaking Data

- `.env` and `.env.*` are ignored by git.
- `npm run secret:check` scans source/docs for common leaked token patterns.
- `npm run safe:check` runs secret scanning, tests, and package dry-run together.
- The CI workflow runs `safe:check` on pushes and pull requests.
- The publish workflow runs secret scanning and tests before `npm publish`.
- Runtime helpers redact sensitive keys like `password`, `token`, `secret`, `apiKey`, `authorization`, `cookie`, and `privateKey`.
- Detection results only show masked previews, not raw secret values.
- `safeFetch` can restrict calls to allowed origins and returns redacted request metadata for logs.
- `createRateLimiter` and `createCircuitBreaker` help reduce repeated abuse and unsafe retry storms.

## Troubleshooting

### npm 404 from registry.npmjs.org

This means npm is looking in the wrong registry.

Fix:

```bash
npm config set "@shnwazdeveloper:registry" "https://npm.pkg.github.com" --location=user
```

### npm 401 Unauthorized

This means npm is using GitHub Packages but does not have a token.

Fix:

```powershell
gh auth refresh -h github.com -s read:packages
$token = gh auth token
npm config set "//npm.pkg.github.com/:_authToken" "$token" --location=user
```

### Package version already exists

GitHub Packages does not let the same package version be published twice. Increase the `version` in `package.json`, then push a matching new tag.

## License

MIT
