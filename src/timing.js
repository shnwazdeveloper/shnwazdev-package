function ensurePositiveNumber(value, name) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new TypeError(`${name} must be a positive number`);
  }
}

function createAbortError(message = "Operation aborted") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function sleep(ms, options = {}) {
  ensurePositiveNumber(ms, "ms");

  if (options.signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let timer;

    function cleanup() {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }

    function done() {
      cleanup();
      resolve();
    }

    function abort() {
      cleanup();
      reject(createAbortError());
    }

    timer = setTimeout(done, ms);
    options.signal?.addEventListener("abort", abort, { once: true });
  });
}

export function timeout(promise, ms, message = "Operation timed out") {
  ensurePositiveNumber(ms, "ms");

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message);
      error.name = "TimeoutError";
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

export async function retry(task, options = {}) {
  if (typeof task !== "function") {
    throw new TypeError("task must be a function");
  }

  const retries = options.retries ?? 3;
  const delay = options.delay ?? 0;
  const factor = options.factor ?? 1;
  const shouldRetry = options.shouldRetry ?? (() => true);
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      return await task({ attempt });
    } catch (error) {
      lastError = error;
      if (attempt >= retries || shouldRetry(error, { attempt }) === false) {
        throw error;
      }

      const wait = delay * Math.pow(factor, attempt);
      if (wait > 0) {
        await sleep(wait, { signal: options.signal });
      }
      attempt += 1;
    }
  }

  throw lastError;
}

export function debounce(fn, delay = 0) {
  if (typeof fn !== "function") {
    throw new TypeError("fn must be a function");
  }
  ensurePositiveNumber(delay, "delay");

  let timer;
  let lastArgs;
  let lastThis;

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn.apply(lastThis, lastArgs);
    }, delay);
  }

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
    lastThis = undefined;
  };

  debounced.flush = () => {
    if (!timer) {
      return undefined;
    }
    clearTimeout(timer);
    timer = undefined;
    return fn.apply(lastThis, lastArgs);
  };

  debounced.pending = () => Boolean(timer);

  return debounced;
}

export function throttle(fn, delay = 0, options = {}) {
  if (typeof fn !== "function") {
    throw new TypeError("fn must be a function");
  }
  ensurePositiveNumber(delay, "delay");

  const trailing = options.trailing ?? true;
  let lastRun = 0;
  let timer;
  let lastArgs;
  let lastThis;

  function invoke() {
    lastRun = Date.now();
    timer = undefined;
    fn.apply(lastThis, lastArgs);
    lastArgs = undefined;
    lastThis = undefined;
  }

  function throttled(...args) {
    lastArgs = args;
    lastThis = this;

    const remaining = delay - (Date.now() - lastRun);
    if (remaining <= 0 || remaining > delay) {
      clearTimeout(timer);
      invoke();
      return;
    }

    if (trailing && !timer) {
      timer = setTimeout(invoke, remaining);
    }
  }

  throttled.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
    lastThis = undefined;
  };

  return throttled;
}
