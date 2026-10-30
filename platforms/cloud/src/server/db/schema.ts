import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { LOCALES } from "../../shared/i18n";

/*
 * Teachers/admins (users) and students are separate tables: they log in on
 * different hosts, with different credentials and lifetimes. Timestamps are
 * Unix milliseconds.
 */

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "teacher"] }).notNull(),
  displayName: text("display_name").notNull().default(""),
  disabledAt: integer("disabled_at", { mode: "timestamp_ms" }),
  /** Null until the owner follows the link sent to the address (sign-up, invitation). */
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
  /** Null while a sign-up waits for an admin (sign-up mode "approval"). */
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  /** When the user accepted the privacy policy at sign-up. */
  privacyAcceptedAt: integer("privacy_accepted_at", { mode: "timestamp_ms" }),
  /** The UI and email language they chose; null: follow the instance, then the browser. */
  locale: text("locale", { enum: LOCALES }),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** sha256 of the opaque token in the cookie; the token itself is never stored. */
    idHash: text("id_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * One-time links sent by email: a password reset, the verification of a
 * new sign-up, or an invitation (set a password; verifies the address too).
 */
export const passwordResets = sqliteTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  purpose: text("purpose", { enum: ["reset", "verify", "invite"] })
    .notNull()
    .default("reset"),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

/**
 * Per-user limits and features; see domain/entitlements.ts. The value is JSON
 * text, serialized by hand: null ("unlimited") is a real value here, which
 * Drizzle's json mode would store as SQL NULL.
 */
export const entitlements = sqliteTable(
  "entitlements",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/** Instance-wide settings; see domain/instance.ts. JSON text, as above. */
export const instanceSettings = sqliteTable("instance_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/*
 * The AI assistant's usage counter, one row per user per UTC day
 * (see domain/ai-usage.ts). Kept apart from the audit log on purpose:
 * a quota is enforced state, an activity log is history.
 */
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** UTC day, "YYYY-MM-DD". */
    day: text("day").notNull(),
    requests: integer("requests").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    /** Tokens times the model's weight: what the weekly quota counts. */
    weightedTokens: integer("weighted_tokens").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  visibility: text("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("public"),
  source: text("source", { enum: ["hosted", "external"] })
    .notNull()
    .default("hosted"),
  externalUrl: text("external_url"),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  /**
   * The build served at the book's address; null when nothing is published.
   * Not a foreign key: builds reference books, and SQLite cannot add a
   * cycle's second edge without rebuilding the table.
   */
  publishedBuildId: integer("published_build_id"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  /** The newest successful build of any kind, served on the preview host. */
  previewBuildId: integer("preview_build_id"),
  /** Size of the current source (the git tree); counts toward its owners' storage. */
  sourceBytes: integer("source_bytes").notNull().default(0),
  /** Commits on refs/heads/main; the staleness hint is this minus a build's snapshot. */
  commitCount: integer("commit_count").notNull().default(0),
  /**
   * A custom domain (lowercase host). It serves the book once a CNAME to the
   * book was found (domain_verified_at); until then other books may claim it too.
   */
  domain: text("domain"),
  domainVerifiedAt: integer("domain_verified_at", { mode: "timestamp_ms" }),
  domainCheckedAt: integer("domain_checked_at", { mode: "timestamp_ms" }),
  /** Why the last check failed, for the teacher; null when it passed. */
  domainProblem: text("domain_problem"),
  /**
   * In suffix mode the book's address ends in -<slug_suffix>; it stays the
   * same when the teacher renames the book. Null: the book never had one.
   */
  slugSuffix: text("slug_suffix"),
  /** Set while the book has an address without suffix that an admin granted. */
  slugGrantedAt: integer("slug_granted_at", { mode: "timestamp_ms" }),
  slugGrantedBy: integer("slug_granted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
}, (t) => [
  uniqueIndex("books_active_domain_idx").on(t.domain).where(sql`${t.domainVerifiedAt} is not null`),
]);

/**
 * A teacher asking for an address without suffix (suffix mode). Kept after
 * the decision, so the teacher sees it and admins see what was asked before.
 */
export const slugRequests = sqliteTable(
  "slug_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    /** What the book is, in the teacher's words. */
    description: text("description").notNull(),
    status: text("status", { enum: ["pending", "approved", "declined", "withdrawn"] })
      .notNull()
      .default("pending"),
    requestedBy: integer("requested_by").references(() => users.id, { onDelete: "set null" }),
    decidedBy: integer("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    /** The admin's note to the teacher. */
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("slug_requests_book_idx").on(t.bookId), index("slug_requests_status_idx").on(t.status)],
);

/** Old slugs of renamed books, so their addresses can redirect. */
export const bookSlugs = sqliteTable("book_slugs", {
  oldSlug: text("old_slug").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
});

export const bookMembers = sqliteTable(
  "book_members",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "editor"] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.bookId, t.userId] }),
    index("book_members_user_idx").on(t.userId),
  ],
);

export const groups = sqliteTable(
  "groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("groups_book_name_idx").on(t.bookId, t.name)],
);

/**
 * Anonymous on purpose: there is no name column. Teachers write real names
 * on their printed list, never into the platform.
 *
 * Password and login key are each stored twice: hashed, to check a login,
 * and sealed (encrypted with CREDENTIALS_KEY), so lists can be reprinted.
 */
export const students = sqliteTable(
  "students",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSealed: text("password_sealed").notNull(),
    loginKeyHash: text("login_key_hash").notNull(),
    loginKeySealed: text("login_key_sealed").notNull(),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("students_book_username_idx").on(t.bookId, t.username),
    uniqueIndex("students_login_key_idx").on(t.loginKeyHash),
    index("students_group_idx").on(t.groupId),
  ],
);

/**
 * One build of a book's source at a commit. A succeeded build's output lives
 * in $DATA_DIR/books/<bookId>/builds/<id>/ until it is pruned.
 */
export const builds = sqliteTable(
  "builds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    commit: text("commit").notNull(),
    status: text("status", {
      enum: ["queued", "running", "succeeded", "failed", "canceled"],
    }).notNull(),
    trigger: text("trigger", {
      enum: ["upload", "rebuild", "edit", "publish", "upgrade", "push", "rollback"],
    }).notNull(),
    /**
     * An upgrade build rebuilds a published build with a newer Hyperbook; it
     * takes that build's place only if it is still the one served.
     */
    replacesBuildId: integer("replaces_build_id"),
    /** Whether the build goes live when it succeeds; builds after a save only preview. */
    publish: integer("publish", { mode: "boolean" }).notNull().default(true),
    requestedBy: integer("requested_by").references(() => users.id, {
      onDelete: "set null",
    }),
    /** The book's commit count when this build was queued, for the staleness hint. */
    commitCount: integer("commit_count").notNull().default(0),
    /** A short note from whoever triggered the build (e.g. a publish note). */
    note: text("note"),
    hyperbookVersion: text("hyperbook_version"),
    log: text("log").notNull().default(""),
    error: text("error"),
    sizeBytes: integer("size_bytes"),
    createdAt: createdAt(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("builds_book_idx").on(t.bookId, t.id),
    index("builds_status_idx").on(t.status),
  ],
);

/**
 * A student logged in on a book host: a cookie there (hosted books) or a
 * Bearer token (books hosted elsewhere). Only the token's hash is stored.
 * Read-only sessions are teachers looking at a student's state.
 */
export const studentSessions = sqliteTable(
  "student_sessions",
  {
    idHash: text("id_hash").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["cookie", "token"] }).notNull(),
    readonly: integer("readonly", { mode: "boolean" }).notNull().default(false),
    impersonatedBy: integer("impersonated_by").references(() => users.id, {
      onDelete: "cascade",
    }),
    /** False for "shared device" logins: shorter, never extended. */
    persistent: integer("persistent", { mode: "boolean" }).notNull().default(true),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("student_sessions_student_idx").on(t.studentId)],
);

/** One-time codes that hand a teacher's "view as student" over to a book host. */
export const impersonationCodes = sqliteTable("impersonation_codes", {
  codeHash: text("code_hash").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * A student's saved state in a book: the latest snapshot (a Dexie export) and
 * the revision the client uses as its watermark (`lastEventId`).
 */
export const storeHeads = sqliteTable("store_heads", {
  studentId: integer("student_id")
    .primaryKey()
    .references(() => students.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(0),
  snapshot: text("snapshot"),
  snapshotRevision: integer("snapshot_revision").notNull().default(0),
  sizeBytes: integer("size_bytes").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/** Changes since the snapshot, in the wire format of cloud.js. */
export const storeEvents = sqliteTable(
  "store_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    tableName: text("table_name").notNull(),
    tableSchema: text("table_schema"),
    operation: text("operation", { enum: ["create", "update", "delete"] }).notNull(),
    primKey: text("prim_key").notNull(),
    data: text("data"),
    createdAt: createdAt(),
  },
  (t) => [index("store_events_student_idx").on(t.studentId, t.id)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: integer("target_id"),
    data: text("data", { mode: "json" }),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_target_idx").on(t.targetType, t.targetId)],
);

/** One-time codes that hand a teacher's editor over to a book's preview host. */
export const previewCodes = sqliteTable("preview_codes", {
  codeHash: text("code_hash").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

/** A teacher looking at a book's preview host. Only the token's hash is stored. */
export const previewSessions = sqliteTable(
  "preview_sessions",
  {
    idHash: text("id_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("preview_sessions_book_idx").on(t.bookId)],
);

/**
 * An API token for git over HTTPS, scoped to one book and one user: a leaked
 * token grants only that book. Only the token's hash is stored; the token is
 * shown once when it is created. Revoked rows keep their audit trail.
 */
export const gitTokens = sqliteTable(
  "git_tokens",
  {
    /** sha256 of the opaque token; the token itself is never stored. */
    idHash: text("id_hash").primaryKey(),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("git_tokens_book_user_idx").on(t.bookId, t.userId)],
);

/**
 * A word a teacher added to a book's spell-check dictionary, so its pages'
 * prose stops being underlined. Lowercase; one row per word.
 */
export const bookDictionary = sqliteTable(
  "book_dictionary",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    word: text("word").notNull(),
    addedBy: integer("added_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.word] })],
);
