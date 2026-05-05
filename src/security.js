const DEFAULT_REDACTION = "[REDACTED]";

const DEFAULT_SENSITIVE_KEYS = [
  "apiKey",
  "apikey",
  "auth",
  "authorization",
  "bearer",
  "clientSecret",
  "cookie",
  "credentials",
  "databaseUrl",
  "dbPassword",
  "githubToken",
  "jwt",
  "key",
  "npmToken",
  "password",
  "privateKey",
  "refreshToken",
  "secret",
  "session",
  "token"
];

const DEFAULT_SECRET_PATTERNS = [
  {
    type: "github-token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,255}\b/g
  },
  {
    type: "github-fine-grained-token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{40,255}\b/g
  },
  {
    type: "npm-token",
    pattern: /\bnpm_[A-Za-z0-9]{20,255}\b/g
  },
  {
    type: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
  },
  {
    type: "bearer-token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/g
  }
];

function normalizeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isSensitiveKey(key, keys = DEFAULT_SENSITIVE_KEYS) {
  const normalized = normalizeKey(key);
  return keys.some((sensitiveKey) => {
    const normalizedSensitiveKey = normalizeKey(sensitiveKey);
    return (
      normalized === normalizedSensitiveKey ||
      normalized.endsWith(normalizedSensitiveKey)
    );
  });
}

function getPatterns(patterns = DEFAULT_SECRET_PATTERNS) {
  return patterns.map((entry) => ({
    type: entry.type,
    pattern: new RegExp(entry.pattern.source, entry.pattern.flags.includes("g")
      ? entry.pattern.flags
      : `${entry.pattern.flags}g`)
  }));
}

export function maskSecret(value, options = {}) {
  const text = String(value ?? "");
  const visibleStart = options.visibleStart ?? 0;
  const visibleEnd = options.visibleEnd ?? 0;
  const mask = options.mask ?? "*";
  const minMaskLength = options.minMaskLength ?? 8;

  if (visibleStart === 0 && visibleEnd === 0) {
    return mask.repeat(minMaskLength);
  }

  if (text.length <= visibleStart + visibleEnd) {
    return mask.repeat(Math.max(minMaskLength, text.length, 1));
  }

  return `${text.slice(0, visibleStart)}${mask.repeat(minMaskLength)}${text.slice(-visibleEnd)}`;
}

export function detectSecrets(value, options = {}) {
  const findings = [];
  const seen = new WeakSet();
  const sensitiveKeys = options.sensitiveKeys ?? DEFAULT_SENSITIVE_KEYS;
  const patterns = getPatterns(options.patterns);

  function addFinding(path, type, secret) {
    findings.push({
      path,
      type,
      preview: maskSecret(secret)
    });
  }

  function scanString(text, path) {
    for (const { type, pattern } of patterns) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        addFinding(path, type, match[0]);
      }
    }
  }

  function visit(input, path) {
    if (typeof input === "string") {
      scanString(input, path);
      return;
    }

    if (input === null || typeof input !== "object") {
      return;
    }

    if (seen.has(input)) {
      return;
    }
    seen.add(input);

    if (input instanceof Error) {
      visit(input.message, `${path}.message`);
      visit(input.stack, `${path}.stack`);
      return;
    }

    if (Array.isArray(input)) {
      input.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    for (const [key, nestedValue] of Object.entries(input)) {
      const nestedPath = path ? `${path}.${key}` : key;
      if (isSensitiveKey(key, sensitiveKeys) && nestedValue != null) {
        addFinding(nestedPath, "sensitive-key", String(nestedValue));
        continue;
      }
      visit(nestedValue, nestedPath);
    }
  }

  visit(value, options.path ?? "$");
  return findings;
}

export function redactSensitiveData(value, options = {}) {
  const redaction = options.redaction ?? DEFAULT_REDACTION;
  const sensitiveKeys = options.sensitiveKeys ?? DEFAULT_SENSITIVE_KEYS;
  const patterns = getPatterns(options.patterns);
  const seen = new WeakMap();

  function redactString(text) {
    let next = text;
    for (const { pattern } of patterns) {
      pattern.lastIndex = 0;
      next = next.replace(pattern, redaction);
    }
    return next;
  }

  function visit(input) {
    if (typeof input === "string") {
      return redactString(input);
    }

    if (input === null || typeof input !== "object") {
      return input;
    }

    if (seen.has(input)) {
      return "[Circular]";
    }

    if (input instanceof Error) {
      return {
        name: input.name,
        message: redactString(input.message),
        stack: input.stack ? redactString(input.stack) : undefined
      };
    }

    if (Array.isArray(input)) {
      const output = [];
      seen.set(input, output);
      for (const item of input) {
        output.push(visit(item));
      }
      return output;
    }

    const output = {};
    seen.set(input, output);

    for (const [key, nestedValue] of Object.entries(input)) {
      output[key] = isSensitiveKey(key, sensitiveKeys)
        ? redaction
        : visit(nestedValue);
    }

    return output;
  }

  return visit(value);
}

export function safeJsonStringify(value, options = {}) {
  return JSON.stringify(
    redactSensitiveData(value, options),
    null,
    options.space ?? 2
  );
}

export function assertNoSecrets(value, options = {}) {
  const findings = detectSecrets(value, options);
  if (findings.length === 0) {
    return value;
  }

  const summary = findings
    .map((finding) => `${finding.type} at ${finding.path}`)
    .join(", ");
  const error = new Error(`Sensitive data detected: ${summary}`);
  error.name = "SensitiveDataError";
  error.findings = findings;
  throw error;
}

export function createSafeLogger(logger = console, options = {}) {
  const methods = options.methods ?? ["debug", "error", "info", "log", "warn"];
  const safeLogger = {};

  for (const method of methods) {
    const target = typeof logger[method] === "function"
      ? logger[method].bind(logger)
      : logger.log?.bind(logger);

    safeLogger[method] = (...args) => {
      const redactedArgs = args.map((arg) => redactSensitiveData(arg, options));
      return target?.(...redactedArgs);
    };
  }

  return safeLogger;
}
