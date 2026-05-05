export const packageName = "@shnwazdeveloper/shnwazdev";

export function greet(name = "developer") {
  return `Hello, ${name}! Welcome to shnwazdev.`;
}

export function profile() {
  return {
    owner: "shnwazdeveloper",
    brand: "shnwazdev",
    packageName,
    registry: "GitHub Packages"
  };
}

export {
  createEventBus,
  createHeartbeat,
  createPoller,
  createRealtimeStore
} from "./realtime.js";

export {
  debounce,
  retry,
  sleep,
  throttle,
  timeout
} from "./timing.js";

export {
  assertNoSecrets,
  createSafeLogger,
  detectSecrets,
  maskSecret,
  redactSensitiveData,
  safeJsonStringify
} from "./security.js";
