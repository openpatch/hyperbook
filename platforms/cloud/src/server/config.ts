import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Configuration comes from the environment only. In production the server
 * refuses to start with an incomplete or unsafe configuration, rather than
 * running insecurely in silence.
 */

export type Config = {
  env: "development" | "production" | "test";
  port: number;
  /** e.g. "https://cloud.example.org" — admin UI and API. */
  adminOrigin: string;
  /** Host (and port, if any) of adminOrigin, lowercased: what the Host header carries. */
  adminHost: string;
  /** Books are served at <slug>.<booksDomain>. May carry a port in development. */
  booksDomain: string;
  /** Books use the same scheme as the admin origin. */
  booksProtocol: "http:" | "https:";
  /** 32 bytes. Encrypts student passwords and login keys so lists can be reprinted. */
  credentialsKey: Buffer;
  dataDir: string;
  /** Largest accepted zip upload. */
  uploadMaxBytes: number;
  /** Largest unpacked source, and largest build output. */
  bookMaxBytes: number;
  /** Longest a git smart-HTTP child process may run before it is killed. */
  gitOpTimeoutMs: number;
  store: {
    /** Largest saved state per student, and largest request. */
    maxBytes: number;
    /** Events after which a student's events are folded into the snapshot. */
    compactAfter: number;
  };
  build: {
    concurrency: number;
    timeoutMs: number;
    memoryMb: number;
    /** dist/index.js of the Hyperbook CLI that builds books. */
    cli: string;
    /** Rebuild published books made with another Hyperbook version at startup. */
    rebuildOnUpgrade: boolean;
  };
  firstAdmin: { email: string; password: string } | null;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  } | null;
  /** Development and tests: emails are written here as files instead of sent. */
  mailOutboxDir: string | null;
  /** The editor's AI writing assistant; null: the feature is off. */
  ai: {
    /** Any OpenAI-compatible API, e.g. https://api.mistral.ai/v1 or http://localhost:11434/v1 (Ollama). */
    baseUrl: string;
    apiKey: string;
    /** The default model; always the first of `models`. */
    model: string;
    /** Models the teacher may pick in the editor; always includes `model`. */
    models: string[];
    /** Whole request, provider call and streaming included. */
    timeoutMs: number;
    maxOutputTokens: number;
    /** Steps of the agent loop (books tools), once tools are added. */
    maxSteps: number;
    requestsPerMinute: number;
  } | null;
};

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(
      "Invalid configuration:\n" + problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ConfigError";
  }
}

// Only for development and tests, so a fresh checkout runs without setup.
// Production requires a real key.
const DEV_CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64");

/**
 * Development: the admin UI is the Vite dev server (WEB_PORT), which proxies
 * /api to this server (PORT); books are answered by this server directly.
 */
function defaultsFor(
  env: "development" | "test",
  vars: NodeJS.ProcessEnv,
): { ADMIN_ORIGIN: string; BOOKS_DOMAIN: string; DATA_DIR: string } {
  if (env === "test") {
    return { ADMIN_ORIGIN: "http://admin.test", BOOKS_DOMAIN: "books.test", DATA_DIR: "./data-test" };
  }
  return {
    ADMIN_ORIGIN: `http://localhost:${vars.WEB_PORT || 5173}`,
    BOOKS_DOMAIN: `books.localhost:${vars.PORT || 3001}`,
    DATA_DIR: "./data",
  };
}

const optional = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()));

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  ADMIN_ORIGIN: optional,
  BOOKS_DOMAIN: optional,
  CREDENTIALS_KEY: optional,
  DATA_DIR: optional,
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).default(100),
  BOOK_MAX_MB: z.coerce.number().int().min(1).default(500),
  GIT_OP_TIMEOUT_SECONDS: z.coerce.number().int().min(1).default(300),
  BUILD_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(1),
  BUILD_TIMEOUT_SECONDS: z.coerce.number().int().min(10).default(300),
  BUILD_MEMORY_MB: z.coerce.number().int().min(128).default(1024),
  REBUILD_ON_UPGRADE: z.enum(["true", "false"]).default("true"),
  HYPERBOOK_CLI: optional,
  STORE_MAX_MB: z.coerce.number().int().min(1).default(10),
  STORE_COMPACT_EVENTS: z.coerce.number().int().min(1).default(100),
  ADMIN_EMAIL: optional,
  ADMIN_PASSWORD: optional,
  SMTP_HOST: optional,
  SMTP_PORT: optional,
  SMTP_USER: optional,
  SMTP_PASS: optional,
  SMTP_FROM: optional,
  MAIL_OUTBOX_DIR: optional,
  // The AI writing assistant speaks the OpenAI chat-completions protocol,
  // so any provider works: Mistral, OpenAI, Anthropic's compatibility layer,
  // or a local Ollama. All three or none, like SMTP above.
  AI_BASE_URL: optional,
  AI_API_KEY: optional,
  AI_MODEL: optional,
  /** Comma-separated extra models the editor offers; AI_MODEL stays the default. */
  AI_MODELS: optional,
  AI_TIMEOUT_SECONDS: z.coerce.number().int().min(10).default(120),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).default(2048),
  AI_MAX_STEPS: z.coerce.number().int().min(1).max(32).default(8),
  AI_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).default(6),
});

const HOST_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?::\d{1,5})?$/;

function isLocalhost(host: string): boolean {
  const name = host.replace(/:\d+$/, "");
  return name === "localhost" || name.endsWith(".localhost");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  const e = parsed.data;
  const production = e.NODE_ENV === "production";
  const defaults =
    e.NODE_ENV === "production" ? undefined : defaultsFor(e.NODE_ENV, env);
  const problems: string[] = [];

  // --- Admin origin ---------------------------------------------------------
  const adminOriginRaw = e.ADMIN_ORIGIN ?? defaults?.ADMIN_ORIGIN;
  let adminOrigin = "";
  let adminHost = "";
  let booksProtocol: Config["booksProtocol"] = "https:";
  if (!adminOriginRaw) {
    problems.push("ADMIN_ORIGIN is required, e.g. https://cloud.example.org");
  } else {
    try {
      const url = new URL(adminOriginRaw);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        problems.push("ADMIN_ORIGIN must start with http:// or https://");
      } else if (url.pathname !== "/" || url.search || url.hash) {
        problems.push(
          "ADMIN_ORIGIN must be an origin only, without a path, e.g. https://cloud.example.org",
        );
      } else {
        adminOrigin = url.origin;
        adminHost = url.host.toLowerCase();
        booksProtocol = url.protocol;
        // Session cookies use the __Host- prefix, which browsers only accept
        // over HTTPS (localhost excepted).
        if (production && url.protocol !== "https:" && !isLocalhost(adminHost)) {
          problems.push("ADMIN_ORIGIN must use https:// in production");
        }
      }
    } catch {
      problems.push(`ADMIN_ORIGIN is not a valid URL: ${adminOriginRaw}`);
    }
  }

  // --- Books domain ---------------------------------------------------------
  const booksDomain = (e.BOOKS_DOMAIN ?? defaults?.BOOKS_DOMAIN ?? "").toLowerCase();
  if (!booksDomain) {
    problems.push("BOOKS_DOMAIN is required, e.g. example.page");
  } else if (!HOST_RE.test(booksDomain)) {
    problems.push(
      "BOOKS_DOMAIN must be a bare host name, without scheme or path, e.g. example.page",
    );
  } else if (adminHost) {
    // Books run teacher-written scripts. They must never share an origin with
    // the admin UI, and the admin host must never be mistaken for a book.
    // BOOKS_DOMAIN may be the admin host itself (admin on example.org, books
    // on <slug>.example.org): a book always has a label in front.
    if (adminHost.endsWith("." + booksDomain)) {
      problems.push(
        `The host of ADMIN_ORIGIN (${adminHost}) lies inside BOOKS_DOMAIN (${booksDomain}), so it would be served as a book. Use e.g. BOOKS_DOMAIN=books.${booksDomain}`,
      );
    }
  }

  // --- Credentials key ------------------------------------------------------
  let credentialsKey = Buffer.alloc(0);
  const keyRaw =
    e.CREDENTIALS_KEY ?? (production ? undefined : DEV_CREDENTIALS_KEY);
  if (!keyRaw) {
    problems.push(
      "CREDENTIALS_KEY is required. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  } else {
    credentialsKey = Buffer.from(keyRaw, "base64");
    if (credentialsKey.length !== 32) {
      problems.push("CREDENTIALS_KEY must be 32 bytes, base64-encoded");
    }
  }

  // --- Data directory -------------------------------------------------------
  const dataDirRaw = e.DATA_DIR ?? defaults?.DATA_DIR ?? "/data";
  const dataDir = path.resolve(dataDirRaw);

  // --- Builds ---------------------------------------------------------------
  // Source (src/server/config.ts) and bundle (dist/server/main.js) both sit
  // two levels below the package root, which sits in platforms/ of the
  // Hyperbook repository; the Docker image keeps that layout.
  const cli = e.HYPERBOOK_CLI
    ? path.resolve(e.HYPERBOOK_CLI)
    : fileURLToPath(
        new URL("../../../../packages/hyperbook/dist/index.js", import.meta.url),
      );

  // --- First admin ----------------------------------------------------------
  let firstAdmin: Config["firstAdmin"] = null;
  if (e.ADMIN_EMAIL || e.ADMIN_PASSWORD) {
    if (!e.ADMIN_EMAIL || !e.ADMIN_PASSWORD) {
      problems.push("ADMIN_EMAIL and ADMIN_PASSWORD must be set together");
    } else {
      firstAdmin = { email: e.ADMIN_EMAIL.toLowerCase(), password: e.ADMIN_PASSWORD };
    }
  }

  // --- SMTP: all or nothing -------------------------------------------------
  // Half a configuration silently sends nothing, so it is rejected.
  let smtp: Config["smtp"] = null;
  const smtpFields = {
    SMTP_HOST: e.SMTP_HOST,
    SMTP_PORT: e.SMTP_PORT,
    SMTP_USER: e.SMTP_USER,
    SMTP_PASS: e.SMTP_PASS,
    SMTP_FROM: e.SMTP_FROM,
  };
  const smtpSet = Object.entries(smtpFields).filter(([, v]) => v !== undefined);
  if (smtpSet.length > 0) {
    const missing = Object.entries(smtpFields)
      .filter(([, v]) => v === undefined)
      .map(([k]) => k);
    const port = Number(e.SMTP_PORT);
    if (missing.length > 0) {
      problems.push(
        `Email is partly configured; also set ${missing.join(", ")} or unset all SMTP_* variables`,
      );
    } else if (!Number.isInteger(port) || port < 1 || port > 65535) {
      problems.push("SMTP_PORT must be a port number");
    } else {
      smtp = {
        host: e.SMTP_HOST!,
        port,
        user: e.SMTP_USER!,
        pass: e.SMTP_PASS!,
        from: e.SMTP_FROM!,
      };
    }
  }

  if (smtp && e.MAIL_OUTBOX_DIR) problems.push("Set either SMTP_* or MAIL_OUTBOX_DIR, not both");

  // --- AI assistant: all or nothing ---------------------------------------
  // Half a configuration silently answers nothing, so it is rejected.
  let ai: Config["ai"] = null;
  const aiFields = {
    AI_BASE_URL: e.AI_BASE_URL,
    AI_API_KEY: e.AI_API_KEY,
    AI_MODEL: e.AI_MODEL,
  };
  const aiSet = Object.entries(aiFields).filter(([, v]) => v !== undefined);
  if (aiSet.length > 0) {
    const missing = Object.entries(aiFields)
      .filter(([, v]) => v === undefined)
      .map(([k]) => k);
    if (missing.length > 0) {
      problems.push(
        `AI is partly configured; also set ${missing.join(", ")} or unset all AI_* variables`,
      );
    } else {
      try {
        const url = new URL(e.AI_BASE_URL!);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          problems.push("AI_BASE_URL must start with http:// or https://");
        } else if (url.search || url.hash) {
          problems.push("AI_BASE_URL must not carry a query or fragment");
        } else {
          // Anthropic's and Mistral's compatibility layers live below a path
          // (/v1), so a path is allowed; a trailing slash is not kept.
          const base = `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
          const models = [
            ...new Set(
              [e.AI_MODEL!, ...(e.AI_MODELS ?? "").split(",")]
                .map((m) => m.trim())
                .filter(Boolean),
            ),
          ];
          ai = {
            baseUrl: base,
            apiKey: e.AI_API_KEY!,
            model: e.AI_MODEL!,
            models,
            timeoutMs: e.AI_TIMEOUT_SECONDS * 1000,
            maxOutputTokens: e.AI_MAX_OUTPUT_TOKENS,
            maxSteps: e.AI_MAX_STEPS,
            requestsPerMinute: e.AI_REQUESTS_PER_MINUTE,
          };
        }
      } catch {
        problems.push(`AI_BASE_URL is not a valid URL: ${e.AI_BASE_URL}`);
      }
    }
  }

  if (problems.length > 0) throw new ConfigError(problems);

  return {
    env: e.NODE_ENV,
    port: e.PORT,
    adminOrigin,
    adminHost,
    booksDomain,
    booksProtocol,
    credentialsKey,
    dataDir,
    uploadMaxBytes: e.UPLOAD_MAX_MB * 1024 * 1024,
    bookMaxBytes: e.BOOK_MAX_MB * 1024 * 1024,
    gitOpTimeoutMs: e.GIT_OP_TIMEOUT_SECONDS * 1000,
    store: {
      maxBytes: e.STORE_MAX_MB * 1024 * 1024,
      compactAfter: e.STORE_COMPACT_EVENTS,
    },
    build: {
      concurrency: e.BUILD_CONCURRENCY,
      timeoutMs: e.BUILD_TIMEOUT_SECONDS * 1000,
      memoryMb: e.BUILD_MEMORY_MB,
      cli,
      rebuildOnUpgrade: e.REBUILD_ON_UPGRADE === "true",
    },
    firstAdmin,
    smtp,
    mailOutboxDir: e.MAIL_OUTBOX_DIR ? path.resolve(e.MAIL_OUTBOX_DIR) : null,
    ai,
  };
}

/** Public URL of a book. */
export function bookOrigin(config: Config, slug: string): string {
  return `${config.booksProtocol}//${slug}.${config.booksDomain}`;
}

/** Where a book's owners and editors see its newest build. */
export function previewOrigin(config: Config, slug: string): string {
  return bookOrigin(config, `${slug}--preview`);
}
