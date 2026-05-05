# @shnwazdeveloper/shnwazdev

Real-time utility toolkit for `shnwazdev` projects, published through GitHub Packages.

## Install

Create or update `.npmrc` in the project that will use this package:

```ini
@shnwazdeveloper:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @shnwazdeveloper/shnwazdev
```

## What Is Inside

- Event bus for app events
- Realtime store with subscriptions and selectors
- Poller for APIs, bots, dashboards, and workers
- Heartbeat for live status checks
- `sleep`, `timeout`, `retry`, `debounce`, and `throttle`

## Examples

### Realtime Store

```js
import { createRealtimeStore } from "@shnwazdeveloper/shnwazdev";

const store = createRealtimeStore({ online: false, users: 0 });

store.subscribe((state) => {
  console.log("state changed", state);
});

store.setState({ online: true });
store.update((state) => ({ users: state.users + 1 }));
```

### Event Bus

```js
import { createEventBus } from "@shnwazdeveloper/shnwazdev";

const bus = createEventBus();

bus.on("message", (message) => {
  console.log(message.text);
});

bus.emit("message", { text: "Hello realtime world" });
```

### Poller

```js
import { createPoller } from "@shnwazdeveloper/shnwazdev";

const poller = createPoller(
  async () => {
    const response = await fetch("https://api.github.com");
    return response.status;
  },
  { interval: 5000 }
);

poller.onData((status) => console.log("status", status));
poller.onError((error) => console.error(error));
poller.start();
```

### Retry And Timeout

```js
import { retry, timeout } from "@shnwazdeveloper/shnwazdev";

const data = await retry(
  () => timeout(fetch("https://api.github.com"), 3000),
  { retries: 2, delay: 500 }
);
```

## Scripts

```bash
npm test
npm run pack:check
```

## Publishing

This repository publishes to GitHub Packages when a tag like `v0.2.0` is pushed.
