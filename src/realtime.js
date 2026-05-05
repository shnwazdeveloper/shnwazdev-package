import { sleep, timeout } from "./timing.js";

function ensureFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function createAbortError(message = "Operation aborted") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function createEventBus() {
  const listeners = new Map();

  function getListeners(eventName) {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    return listeners.get(eventName);
  }

  return {
    on(eventName, handler) {
      ensureFunction(handler, "handler");
      getListeners(eventName).add(handler);
      return () => this.off(eventName, handler);
    },

    once(eventName, handler) {
      ensureFunction(handler, "handler");
      const off = this.on(eventName, (payload, meta) => {
        off();
        return handler(payload, meta);
      });
      return off;
    },

    off(eventName, handler) {
      const eventListeners = listeners.get(eventName);
      if (!eventListeners) {
        return false;
      }
      const removed = eventListeners.delete(handler);
      if (eventListeners.size === 0) {
        listeners.delete(eventName);
      }
      return removed;
    },

    emit(eventName, payload, meta = {}) {
      const eventListeners = [...(listeners.get(eventName) ?? [])];
      const errors = [];

      for (const handler of eventListeners) {
        try {
          handler(payload, { eventName, ...meta });
        } catch (error) {
          errors.push(error);
        }
      }

      if (errors.length > 0) {
        throw new AggregateError(errors, `Event "${String(eventName)}" failed`);
      }

      return eventListeners.length;
    },

    async emitAsync(eventName, payload, meta = {}) {
      const eventListeners = [...(listeners.get(eventName) ?? [])];
      const results = await Promise.allSettled(
        eventListeners.map((handler) =>
          handler(payload, { eventName, ...meta })
        )
      );
      const errors = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);

      if (errors.length > 0) {
        throw new AggregateError(errors, `Event "${String(eventName)}" failed`);
      }

      return eventListeners.length;
    },

    clear(eventName) {
      if (typeof eventName === "undefined") {
        listeners.clear();
        return;
      }
      listeners.delete(eventName);
    },

    events() {
      return [...listeners.keys()];
    },

    listenerCount(eventName) {
      return listeners.get(eventName)?.size ?? 0;
    }
  };
}

export function createRealtimeStore(initialState = {}) {
  let state = initialState;
  const listeners = new Set();

  function notify(nextState, previousState, meta) {
    const errors = [];
    for (const listener of [...listeners]) {
      try {
        listener(nextState, previousState, meta);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, "Realtime store listener failed");
    }
  }

  function resolveUpdate(update) {
    const value = typeof update === "function" ? update(state) : update;
    if (isPlainObject(state) && isPlainObject(value)) {
      return { ...state, ...value };
    }
    return value;
  }

  return {
    getState() {
      return state;
    },

    setState(update, meta = {}) {
      const previousState = state;
      const nextState = resolveUpdate(update);

      if (Object.is(previousState, nextState)) {
        return state;
      }

      state = nextState;
      notify(state, previousState, { type: "setState", ...meta });
      return state;
    },

    update(update, meta = {}) {
      return this.setState(update, meta);
    },

    subscribe(listener, options = {}) {
      ensureFunction(listener, "listener");
      listeners.add(listener);

      if (options.immediate === true) {
        listener(state, undefined, { type: "subscribe" });
      }

      return () => listeners.delete(listener);
    },

    select(selector, listener, options = {}) {
      ensureFunction(selector, "selector");
      ensureFunction(listener, "listener");
      let selected = selector(state);

      if (options.immediate === true) {
        listener(selected, undefined, { type: "select" });
      }

      return this.subscribe((nextState, previousState, meta) => {
        const nextSelected = selector(nextState);
        if (!Object.is(nextSelected, selected)) {
          const previousSelected = selected;
          selected = nextSelected;
          listener(nextSelected, previousSelected, {
            ...meta,
            previousState,
            nextState
          });
        }
      });
    },

    waitFor(predicate, options = {}) {
      ensureFunction(predicate, "predicate");

      if (predicate(state)) {
        return Promise.resolve(state);
      }

      return new Promise((resolve, reject) => {
        let settled = false;
        let timer;

        function finish(callback, value) {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          unsubscribe();
          options.signal?.removeEventListener("abort", abort);
          callback(value);
        }

        function abort() {
          finish(reject, createAbortError());
        }

        const unsubscribe = this.subscribe((nextState) => {
          try {
            if (predicate(nextState)) {
              finish(resolve, nextState);
            }
          } catch (error) {
            finish(reject, error);
          }
        });

        if (options.signal?.aborted) {
          abort();
          return;
        }

        options.signal?.addEventListener("abort", abort, { once: true });

        if (typeof options.timeout === "number") {
          timer = setTimeout(() => {
            const error = new Error("Timed out waiting for realtime store state");
            error.name = "TimeoutError";
            finish(reject, error);
          }, options.timeout);
        }
      });
    },

    listenerCount() {
      return listeners.size;
    }
  };
}

export function createHeartbeat(options = {}) {
  const interval = options.interval ?? 1000;
  const immediate = options.immediate ?? true;
  const now = options.now ?? Date.now;
  const bus = createEventBus();
  let timer;
  let running = false;
  let count = 0;
  let startedAt;
  let lastBeatAt;

  function beat() {
    count += 1;
    lastBeatAt = now();
    const payload = { count, startedAt, lastBeatAt };
    options.onBeat?.(payload);
    bus.emit("beat", payload);
    return payload;
  }

  return {
    onBeat(handler) {
      return bus.on("beat", handler);
    },

    start() {
      if (running) {
        return this.snapshot();
      }

      running = true;
      count = 0;
      startedAt = now();
      lastBeatAt = undefined;

      if (immediate) {
        beat();
      }

      timer = setInterval(beat, interval);
      return this.snapshot();
    },

    stop() {
      if (!running) {
        return this.snapshot();
      }
      clearInterval(timer);
      timer = undefined;
      running = false;
      bus.emit("stop", this.snapshot());
      return this.snapshot();
    },

    snapshot() {
      return { running, count, startedAt, lastBeatAt, interval };
    }
  };
}

export function createPoller(task, options = {}) {
  ensureFunction(task, "task");

  const bus = createEventBus();
  const interval = options.interval ?? 1000;
  const maxInterval = options.maxInterval ?? interval;
  const backoff = options.backoff ?? 1;
  let active = false;
  let timer;
  let runCount = 0;
  let currentInterval = interval;
  let lastData;
  let lastError;

  async function execute() {
    runCount += 1;
    const meta = { runCount };
    try {
      const result = await task(meta);
      lastData = result;
      lastError = undefined;
      currentInterval = interval;
      options.onData?.(result, meta);
      await bus.emitAsync("data", result, meta);
      return result;
    } catch (error) {
      lastError = error;
      currentInterval = Math.min(maxInterval, currentInterval * backoff);
      options.onError?.(error, meta);
      await bus.emitAsync("error", error, meta);
      throw error;
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (!active) {
      return;
    }
    timer = setTimeout(async () => {
      try {
        await execute();
      } catch {
        // The error is already available through onError and the error event.
      } finally {
        schedule();
      }
    }, currentInterval);
  }

  function stop() {
    clearTimeout(timer);
    timer = undefined;
    active = false;
    return snapshot();
  }

  function snapshot() {
    return {
      active,
      interval,
      currentInterval,
      runCount,
      lastData,
      lastError
    };
  }

  options.signal?.addEventListener("abort", stop, { once: true });

  return {
    onData(handler) {
      return bus.on("data", handler);
    },

    onError(handler) {
      return bus.on("error", handler);
    },

    async runOnce(options = {}) {
      const run = execute();
      if (typeof options.timeout === "number") {
        return timeout(run, options.timeout, "Poller task timed out");
      }
      return run;
    },

    start() {
      if (active) {
        return snapshot();
      }
      active = true;

      if (options.immediate === false) {
        schedule();
        return snapshot();
      }

      queueMicrotask(async () => {
        try {
          await execute();
        } catch {
          // The error is already available through onError and the error event.
        } finally {
          schedule();
        }
      });

      return snapshot();
    },

    stop,
    snapshot,

    async until(predicate, options = {}) {
      ensureFunction(predicate, "predicate");
      const waiter = new Promise((resolve, reject) => {
        const offData = this.onData((data) => {
          try {
            if (predicate(data)) {
              offData();
              offError();
              resolve(data);
            }
          } catch (error) {
            offData();
            offError();
            reject(error);
          }
        });
        const offError = this.onError((error) => {
          if (options.rejectOnError === true) {
            offData();
            offError();
            reject(error);
          }
        });
      });

      if (!active) {
        this.start();
      }

      if (typeof options.timeout === "number") {
        return timeout(waiter, options.timeout, "Timed out waiting for poller");
      }

      return waiter;
    },

    async wait(ms) {
      return sleep(ms, { signal: options.signal });
    }
  };
}
