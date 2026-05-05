# @shnwazdeveloper/shnwazdev

Real-time utility toolkit for `shnwazdev` projects, published with GitHub Packages.

Use this package when you need small, dependency-free helpers for live app state, event messages, API polling, bot status checks, retries, timeouts, and fast UI input control.

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
npm install @shnwazdeveloper/shnwazdev@0.2.1
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

## Quick Start

```js
import {
  createEventBus,
  createPoller,
  createRealtimeStore,
  retry,
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

Check what files will be published:

```bash
npm run pack:check
```

## Publish A New Version To Packages

GitHub Actions publishes this package automatically when a version tag is pushed.

1. Edit the code or README.
2. Update `version` in `package.json`.
3. Run checks:

```bash
npm test
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
git tag v0.2.1
git push origin v0.2.1
```

After the tag is pushed, the `Publish Package` GitHub Actions workflow runs and publishes the new version to GitHub Packages.

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
