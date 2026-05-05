import test from "node:test";
import assert from "node:assert/strict";
import {
  createEventBus,
  createHeartbeat,
  createPoller,
  createRealtimeStore,
  assertNoSecrets,
  createSafeLogger,
  debounce,
  detectSecrets,
  greet,
  maskSecret,
  packageName,
  profile,
  redactSensitiveData,
  retry,
  safeJsonStringify,
  sleep,
  throttle,
  timeout
} from "../src/index.js";

test("exports package identity", () => {
  assert.equal(packageName, "@shnwazdeveloper/shnwazdev");
  assert.equal(greet("Shnwaz"), "Hello, Shnwaz! Welcome to shnwazdev.");
  assert.deepEqual(profile(), {
    owner: "shnwazdeveloper",
    brand: "shnwazdev",
    packageName: "@shnwazdeveloper/shnwazdev",
    registry: "GitHub Packages"
  });
});

test("event bus emits, counts, and removes listeners", async () => {
  const bus = createEventBus();
  const received = [];

  const off = bus.on("message", (payload) => received.push(payload.text));
  bus.once("message", (payload) => received.push(`once:${payload.text}`));

  assert.equal(bus.listenerCount("message"), 2);
  assert.equal(bus.emit("message", { text: "hello" }), 2);
  assert.equal(await bus.emitAsync("message", { text: "again" }), 1);

  off();
  assert.equal(bus.listenerCount("message"), 0);
  assert.deepEqual(received, ["hello", "once:hello", "again"]);
});

test("realtime store updates, selects, and waits for state", async () => {
  const store = createRealtimeStore({ online: false, users: 0 });
  const changes = [];
  const selected = [];

  store.subscribe((state) => changes.push(state), { immediate: true });
  store.select((state) => state.users, (users) => selected.push(users));

  const wait = store.waitFor((state) => state.users === 2, { timeout: 100 });

  store.setState({ online: true });
  store.update((state) => ({ users: state.users + 1 }));
  store.update((state) => ({ users: state.users + 1 }));

  assert.deepEqual(await wait, { online: true, users: 2 });
  assert.equal(store.listenerCount(), 2);
  assert.equal(changes.length, 4);
  assert.deepEqual(selected, [1, 2]);
});

test("heartbeat emits live beats and stops cleanly", async () => {
  const heartbeat = createHeartbeat({ interval: 5, immediate: true });
  const beats = [];
  heartbeat.onBeat((beat) => beats.push(beat.count));

  heartbeat.start();
  await sleep(14);
  const snapshot = heartbeat.stop();

  assert.equal(snapshot.running, false);
  assert.ok(snapshot.count >= 1);
  assert.ok(beats.length >= 1);
});

test("poller runs realtime task until a condition passes", async () => {
  let value = 0;
  const poller = createPoller(
    async () => {
      value += 1;
      return value;
    },
    { interval: 5 }
  );

  const result = await poller.until((data) => data >= 2, { timeout: 100 });
  const snapshot = poller.stop();

  assert.equal(result, 2);
  assert.equal(snapshot.active, false);
  assert.ok(snapshot.runCount >= 2);
});

test("sleep, timeout, and retry handle async control flow", async () => {
  await sleep(1);

  await assert.rejects(
    () => timeout(new Promise(() => {}), 1, "too slow"),
    /too slow/
  );

  let attempts = 0;
  const result = await retry(
    () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("not yet");
      }
      return "ready";
    },
    { retries: 3, delay: 1 }
  );

  assert.equal(result, "ready");
  assert.equal(attempts, 3);
});

test("sleep cleans up abort listeners after resolve and abort", async () => {
  function trackableController() {
    const controller = new AbortController();
    const signal = controller.signal;
    const originalAdd = signal.addEventListener.bind(signal);
    const originalRemove = signal.removeEventListener.bind(signal);
    let activeAbortListeners = 0;

    signal.addEventListener = (type, listener, options) => {
      if (type === "abort") {
        activeAbortListeners += 1;
      }
      return originalAdd(type, listener, options);
    };

    signal.removeEventListener = (type, listener, options) => {
      if (type === "abort") {
        activeAbortListeners -= 1;
      }
      return originalRemove(type, listener, options);
    };

    return {
      controller,
      activeAbortListeners: () => activeAbortListeners
    };
  }

  const resolved = trackableController();
  await sleep(1, { signal: resolved.controller.signal });
  assert.equal(resolved.activeAbortListeners(), 0);

  const aborted = trackableController();
  const sleeping = sleep(50, { signal: aborted.controller.signal });
  assert.equal(aborted.activeAbortListeners(), 1);
  aborted.controller.abort();

  await assert.rejects(sleeping, { name: "AbortError" });
  assert.equal(aborted.activeAbortListeners(), 0);
});

test("debounce and throttle control call frequency", async () => {
  const debouncedValues = [];
  const debounced = debounce((value) => debouncedValues.push(value), 5);

  debounced("a");
  debounced("b");
  assert.equal(debounced.pending(), true);
  await sleep(10);
  assert.deepEqual(debouncedValues, ["b"]);

  const throttledValues = [];
  const throttled = throttle((value) => throttledValues.push(value), 10);
  throttled("first");
  throttled("second");
  throttled("third");
  await sleep(15);

  assert.equal(throttledValues[0], "first");
  assert.equal(throttledValues.at(-1), "third");
});

test("security helpers redact sensitive keys and token patterns", () => {
  const bearerToken = "abcdefghijklmnopqrstuvwxyz" + "123456";
  const data = {
    username: "shnwazdeveloper",
    password: "super-secret-password",
    nested: {
      message: `Bearer ${bearerToken}`
    }
  };

  const redacted = redactSensitiveData(data);
  assert.deepEqual(redacted, {
    username: "shnwazdeveloper",
    password: "[REDACTED]",
    nested: {
      message: "[REDACTED]"
    }
  });

  const findings = detectSecrets(data);
  assert.equal(findings.length, 2);
  assert.equal(findings[0].type, "sensitive-key");
  assert.equal(findings[0].path, "$.password");
  assert.match(findings[0].preview, /^\*+$/);
});

test("security helpers stringify, assert, mask, and log safely", () => {
  assert.equal(maskSecret("abcdefghijkl"), "********");
  assert.equal(
    maskSecret("abcdefghijkl", { visibleStart: 4, visibleEnd: 4 }),
    "abcd********ijkl"
  );

  const circular = {
    token: "ghp_" + "123456789012345678901234567890123456"
  };
  circular.self = circular;
  const json = safeJsonStringify(circular);
  assert.match(json, /"token": "\[REDACTED\]"/);
  assert.match(json, /"self": "\[Circular\]"/);

  assert.throws(
    () => assertNoSecrets({ apiKey: "12345678901234567890" }),
    { name: "SensitiveDataError" }
  );

  const logged = [];
  const logger = createSafeLogger({
    log: (...args) => logged.push(args)
  });
  logger.log("user", {
    token: "gho_" + "123456789012345678901234567890123456"
  });

  assert.deepEqual(logged, [["user", { token: "[REDACTED]" }]]);
});
