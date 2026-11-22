import { z } from "zod";
import { LOCALES } from "./i18n";

/*
 * Input schemas shared by the API (validation) and the web app (forms), so
 * both enforce the same rules.
 *
 * Validation messages are catalog keys ("validation.email", not English):
 * the server translates them with the request's locale (admin/validate.ts)
 * and the web app with the active one (lib/form.tsx).
 */

/** The languages the platform speaks; see shared/i18n. */
export const locale = z.enum(LOCALES);

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("validation.email"));

/** For teacher and admin accounts. Students get generated passwords. */
export const newPassword = z
  .string()
  .min(10, "validation.passwordMin")
  .max(200, "validation.passwordMax");

export const loginInput = z.object({
  email,
  password: z.string().min(1, "validation.passwordRequired").max(200),
});

export const forgotPasswordInput = z.object({ email });

export const signupInput = z.object({
  email,
  displayName: z.string().trim().min(1, "validation.nameRequired").max(100),
  password: newPassword,
  acceptPrivacy: z.literal(true, "validation.acceptPrivacy"),
});

export const verifyEmailInput = z.object({ token: z.string().min(1).max(200) });

export const resetPasswordInput = z.object({
  token: z.string().min(1).max(200),
  password: newPassword,
});

export const updateMeInput = z.object({
  displayName: z.string().trim().max(100, "validation.nameMax").optional(),
  /** Null clears the choice: the instance default and browser apply again. */
  locale: locale.nullish(),
});

export const changePasswordInput = z.object({
  currentPassword: z
    .string()
    .min(1, "validation.currentPasswordRequired")
    .max(200),
  newPassword,
});

export const changeEmailInput = z.object({
  email,
  currentPassword: z
    .string()
    .min(1, "validation.currentPasswordRequired")
    .max(200),
});

export const role = z.enum(["admin", "teacher"]);

export const createUserInput = z.object({
  email,
  displayName: z.string().trim().max(100).default(""),
  role: role.default("teacher"),
  /** Left out: a password is generated and shown once. */
  password: newPassword.optional(),
});

export const updateUserInput = z
  .object({
    displayName: z.string().trim().max(100),
    role,
    disabled: z.boolean(),
  })
  .partial();

export const setPasswordInput = z.object({
  /** Left out: a password is generated and shown once. */
  password: newPassword.optional(),
});

const limit = z.number().int().min(0).max(1_000_000).nullable();

/** Per-user entitlement overrides. A missing key means "instance default". */
export const entitlementOverridesInput = z
  .object({
    private_books: z.boolean(),
    max_books: limit,
    max_storage_mb: limit,
    custom_domain: z.boolean(),
    ai: z.boolean(),
    ai_requests_per_day: limit,
    ai_tokens_per_week: z.number().int().min(0).max(1_000_000_000).nullable(),
  })
  .partial();

/**
 * The elements with a downloadable runtime, and whose runtime an admin may
 * load from the instance or from the element's public CDN. Mirrors the
 * manifest of the Hyperbook CLI (elementCoreFiles).
 */
export const ELEMENT_RUNTIMES = [
  "blockflow",
  "onlineide",
  "sqlide",
  "excalidraw",
  "openscad",
  "geogebra",
  "pyide",
  "typst",
  "pdf",
  "mathfield",
] as const;

export type ElementRuntime = (typeof ELEMENT_RUNTIMES)[number];

/** Where an element's runtime loads from, for books that do not decide in hyperbook.json. */
export const elementRuntimeChoice = z.enum(["local", "cdn"]);

/**
 * What one token of a model costs the weekly quota, per token kind: input,
 * cached input (prompt-cache hits bill less at the provider), and output.
 * Weights are relative — a model's tokens count as weight × tokens.
 */
export const modelWeightsSchema = z.object({
  in: z
    .number("validation.number")
    .positive("validation.weightPositive")
    .max(1000),
  cached: z
    .number("validation.number")
    .positive("validation.weightPositive")
    .max(1000),
  out: z
    .number("validation.number")
    .positive("validation.weightPositive")
    .max(1000),
});

export type ModelWeights = z.infer<typeof modelWeightsSchema>;

/**
 * What a model costs at the provider, per token kind, in € per million
 * tokens: input, cached input (prompt-cache hits bill less), output. The
 * admin enters these friendly numbers; the quota weights are derived from
 * them (see weightsFromPrices in server/domain/instance.ts).
 */
export const modelPricesSchema = z.object({
  in: z
    .number("validation.number")
    .positive("validation.pricePositive")
    .max(1_000_000),
  cached: z
    .number("validation.number")
    .positive("validation.pricePositive")
    .max(1_000_000),
  out: z
    .number("validation.number")
    .positive("validation.pricePositive")
    .max(1_000_000),
});

export type ModelPrices = z.infer<typeof modelPricesSchema>;

export const instanceSettingsInput = z
  .object({
    name: z.string().trim().min(1, "validation.name").max(100),
    defaultEntitlements: entitlementOverridesInput,
    reservedSlugs: z
      .array(z.string().trim().toLowerCase().min(1).max(63))
      .max(500),
    imprintUrl: z.union([
      z.url("validation.fullUrl"),
      z.literal(""),
    ]),
    privacyUrl: z.union([
      z.url("validation.fullUrl"),
      z.literal(""),
    ]),
    imprintMarkdown: z.string().max(100_000, "validation.max100k"),
    privacyMarkdown: z.string().max(100_000, "validation.max100k"),
    signupMode: z.enum(["closed", "open", "domains", "approval"]),
    signupDomains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/,
            "validation.domains",
          ),
      )
      .max(200),
    slugSuffix: z.boolean(),
    landingPage: z.boolean(),
    /** Null: follow the browser's language. */
    defaultLocale: locale.nullish(),
    elementRuntimes: z.partialRecord(
      z.enum(ELEMENT_RUNTIMES),
      elementRuntimeChoice,
    ),
    aiModels: z
      .array(
        z.object({
          id: z.string().trim().min(1, "validation.modelName").max(200),
          prices: modelPricesSchema,
          label: z.string().trim().max(60).optional(),
        }),
      )
      .max(50)
      .refine(
        (models) => new Set(models.map((m) => m.id)).size === models.length,
        "validation.modelOnce",
      ),
    aiDefaultModel: z.string().nullable(),
    /** What one AI credit is worth in € of provider cost; weights derive from it. */
    aiCreditValueEur: z
      .number("validation.number")
      .positive("validation.positive")
      .max(1000),
    /** Markup on provider prices (failed requests, running costs): 1.3 = 30% buffer. */
    aiCostBuffer: z
      .number("validation.number")
      .positive("validation.positive")
      .max(100),
  })
  .partial();

/** An optional note on a publish, stored on the build row (shown in the builds table). */
export const publishInput = z
  .object({
    note: z.string().trim().max(200, "validation.max200").default(""),
  })
  .partial();

/** A rollback target: one of the book's version tags. */
/** An editor's request that the owners publish the latest save. */
export const publishRequestInput = z
  .object({
    note: z.string().trim().max(500, "validation.max500").default(""),
  })
  .partial();

export const rollbackInput = z.object({
  tag: z.string().regex(/^v\d+$/, "validation.versionTag"),
});

/** A label for a new git API token, so it can be told apart later. */
export const gitTokenInput = z
  .object({
    label: z.string().trim().max(100, "validation.max100").default(""),
  })
  .partial();

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "validation.slugRequired")
  .max(63, "validation.max63")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "validation.slugCharacters",
  )
  .refine((s) => !s.includes("--"), "errors.books.slugDoubleHyphen");

export const createBookInput = z.object({
  title: z.string().trim().min(1, "validation.title").max(200),
  slug,
  description: z.string().trim().max(2000).default(""),
});

export const updateBookInput = z
  .object({
    title: z.string().trim().min(1, "validation.title").max(200),
    slug,
    description: z.string().trim().max(2000),
    visibility: z.enum(["public", "private"]),
    /** A book hosted elsewhere (e.g. GitHub Pages); null to host it here. */
    externalUrl: z.union([
      z.url("validation.fullUrl"),
      z.null(),
    ]),
  })
  .partial();

/** The publishing lock of a book: while disabled, nothing of it goes live. */
export const publishingLockInput = z.object({ disabled: z.boolean() });

/** A custom domain for a book (M5); the server checks the rest. */
export const bookDomainInput = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/\.$/, ""))
    .pipe(
      z.string().min(1, "validation.domain").max(253, "validation.domainTooLong"),
    ),
});

export const slugRequestInput = z.object({
  slug,
  description: z
    .string()
    .trim()
    .min(1, "validation.slugReason")
    .max(2000, "validation.max2000"),
});

export const slugDecisionInput = z.object({
  note: z.string().trim().max(2000, "validation.max2000").default(""),
});

export const bookRole = z.enum(["owner", "editor", "commenter"]);

export const addMemberInput = z.object({
  email,
  role: bookRole.default("editor"),
});

export const updateMemberInput = z.object({
  role: bookRole,
});

export const groupInput = z.object({
  name: z.string().trim().min(1, "validation.name").max(100),
});

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "validation.username")
  .max(40, "validation.max40")
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    "validation.usernameCharacters",
  );

export const createStudentInput = z.object({
  username,
  /** Left out: generated. */
  password: z.string().min(4, "validation.min4").max(100).optional(),
});

export const generateStudentsInput = z.object({
  count: z.number().int().min(1, "validation.atLeastOne").max(200, "validation.max200AtOnce"),
  prefix: z
    .string()
    .trim()
    .toLowerCase()
    .max(20, "validation.max20")
    .regex(
      /^[a-z][a-z0-9-]*$|^$/,
      "validation.prefixCharacters",
    )
    .default("student"),
  passwordLength: z.number().int().min(4).max(20).default(6),
});

export const updateStudentInput = z
  .object({
    username,
    groupId: z.number().int().positive(),
  })
  .partial();

export const resetStudentPasswordInput = z.object({
  password: z.string().min(4, "validation.min4").max(100).optional(),
});

/**
 * A page of a book's published versions, newest first. `q` matches the tag
 * or the note; `limit=0` asks only for the total and the live version.
 */
export const versionsQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(0).max(100).default(20),
  q: z.string().trim().max(200).optional(),
});

export const auditQuery = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Folders and files a book's repository never holds. */
const NOT_IN_BOOKS = new Set([".git", ".hyperbook", "node_modules"]);

/** Why `path` cannot be a file of a book, or null if it can. */
export function bookPathProblem(path: string): string | null {
  if (path.length === 0) return "validation.pathName";
  if (path.length > 1024) return "validation.pathTooLong";
  if (/[\0\\]/.test(path)) return "validation.pathCharacters";
  if (path.startsWith("/") || path.endsWith("/")) return "validation.pathEnds";
  for (const segment of path.split("/")) {
    if (segment === "" || segment === "." || segment === "..")
      return "validation.pathSegments";
    if (NOT_IN_BOOKS.has(segment.toLowerCase()))
      return "validation.pathReserved";
    if (new TextEncoder().encode(segment).length > 255)
      return "validation.pathNameTooLong";
  }
  return null;
}

export const bookPath = z.string().superRefine((path, ctx) => {
  const problem = bookPathProblem(path);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

/** A page with the editor's unsaved text, for the preview. */
export const renderPageInput = z.object({
  path: bookPath,
  text: z.string().max(2 * 1024 * 1024),
});

/** A word in a book's spell-check dictionary; lowercase, no punctuation. */
export const dictionaryWord = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}'’-]*$/u, "validation.singleWord")
  .max(64);

export const addDictionaryWordInput = z.object({ word: dictionaryWord });

/** A blob id: what the teacher's copy of a file was made from. */
const oid = z.string().regex(/^[0-9a-f]{40}$/);

export const fileChange = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("write"),
    path: bookPath,
    content: z.string(),
    encoding: z.enum(["utf8", "base64"]).default("utf8"),
    /** null: the file must not exist yet. */
    baseOid: oid.nullable(),
  }),
  z.object({ op: z.literal("delete"), path: bookPath, baseOid: oid }),
  z.object({
    op: z.literal("move"),
    from: bookPath,
    to: bookPath,
    baseOid: oid,
  }),
]);

export type FileChange = z.input<typeof fileChange>;

export const commitFilesInput = z.object({
  message: z.string().trim().max(500).optional(),
  changes: z.array(fileChange).min(1).max(1000),
});

/** The editor's unsaved text of `path`, typed on `baseOid`, to merge with the file as it is now. */
export const mergeFileInput = z.object({
  path: bookPath,
  baseOid: oid,
  text: z.string().max(4 * 1024 * 1024),
});

export const initFilesInput = z.object({
  template: z.enum(["default", "empty"]),
});

/** One page of a book's commit history, as the editor's History pane asks for it. */
export const historyInput = z.object({
  /** The last commit of the page before (the keyset cursor); null: the newest. */
  after: oid.nullish(),
  /** The page size; a book can have many commits, so the pane pages through them. */
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** Only the commits that touched this file. */
  path: bookPath.optional(),
});

/** The changes since the live version, of the whole book or one file. */
export const liveDiffInput = z.object({
  path: bookPath.optional(),
});

/** At most this many attachments per message. */
export const AI_ATTACHMENTS_MAX = 4;
/** An image attachment's data URL, after the editor scaled it down. */
export const AI_IMAGE_MAX = 4 * 1024 * 1024;
/** A document's text (a PDF's or a text file's), per attachment. */
export const AI_ATTACHMENT_TEXT_MAX = 200_000;

/**
 * A file the teacher attached to a message: an image as a data URL (the
 * model looks at it), or a document as its text (a PDF's, read in the
 * editor) — the model reads it like a pasted text.
 */
export const aiAttachment = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    name: z.string().trim().min(1).max(200),
    data: z
      .string()
      .max(AI_IMAGE_MAX)
      .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/),
  }),
  z.object({
    kind: z.literal("text"),
    name: z.string().trim().min(1).max(200),
    text: z.string().max(AI_ATTACHMENT_TEXT_MAX),
  }),
]);

export type AiAttachment = z.infer<typeof aiAttachment>;

/** A request to the editor's AI writing assistant (platforms/cloud/docs/cloud-ai-assistant.md). */
export const aiAssistInput = z.object({
    /** What the assistant should do. */
    prompt: z
      .string("validation.aiPromptRequired")
      .trim()
      .min(1, "validation.aiPromptRequired")
      .max(4000),
    /** The model the teacher picked; the route allows only the instance's list. */
    model: z.string().trim().max(100).optional(),
    /** The page the teacher is editing. */
    pagePath: bookPath,
    /** The text the teacher selected, if any. */
    selection: z.string().max(16000).optional(),
    /** Lines around the cursor or selection, as the editor assembles them. */
    context: z.string().max(16000).optional(),
    /** The open file's full text, as the editor has it now — with unsaved changes. Capped at what the editor sends (128 KiB), so the prompt stays bounded. */
    pageText: z
      .string()
      .max(128 * 1024)
      .optional(),
    /**
     * The conversation this request continues; omitted: a new one. The
     * server keeps the conversation, so follow-ups see what came before.
     */
    conversationId: z.number().int().positive().optional(),
    /**
     * Edit and resend: the id of one of the conversation's own messages
     * (the teacher's). It and everything after it are replaced by this
     * request — also how an answer is regenerated.
     */
    replaceFrom: z.number().int().positive().optional(),
    /** Images and documents the teacher attached to this message. */
    attachments: z.array(aiAttachment).max(AI_ATTACHMENTS_MAX).optional(),
    /** How hard a reasoning model thinks; omitted: the model's default. */
    reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
});

export type AiAssistInput = z.input<typeof aiAssistInput>;

/** One file change of an AI proposal, with the diff the teacher reviews. */
export const aiProposedChange = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("write"),
    path: bookPath,
    /** What the book (or an earlier write in the same request) had before. */
    oldText: z.string().nullable(),
    newText: z.string(),
    /** The committed file's blob id the change is based on; null: new file. */
    baseOid: oid.nullable(),
    /** A unified diff, computed server-side with git. */
    diff: z.string(),
  }),
  z.object({
    op: z.literal("delete"),
    path: bookPath,
    oldText: z.string(),
    baseOid: oid,
    diff: z.string(),
  }),
]);

export type AiProposedChange = z.infer<typeof aiProposedChange>;

// --- Review: access links and comments (docs/cloud-platform.md, M7) --------

export const linkRole = z.enum(["commenter", "editor"]);

export const createLinkInput = z.object({
  name: z.string().trim().min(1, "validation.linkName").max(80, "validation.nameMax"),
  role: linkRole.default("commenter"),
  /** Unix milliseconds; null: until deleted. */
  expiresAt: z.number().int().positive().nullable().default(null),
});

export const redeemLinkInput = z.object({
  token: z.string().min(16).max(200),
});

/** Long enough for any comment, short enough to keep threads readable. */
export const COMMENT_MAX = 10_000;

const commentBody = z
  .string()
  .trim()
  .min(1, "validation.commentRequired")
  .max(COMMENT_MAX, "validation.commentMax");

/** Where a thread sits: offsets into the file's blob `oid`. */
export const commentAnchor = z
  .object({
    path: bookPath,
    oid,
    from: z.number().int().min(0),
    to: z.number().int().min(0),
  })
  .refine((a) => a.to > a.from, { message: "validation.commentRange", path: ["to"] });

export const createThreadInput = z.object({
  anchor: commentAnchor,
  body: commentBody,
  suggestion: z.string().max(COMMENT_MAX, "validation.commentMax").nullable().default(null),
});

export const replyInput = z.object({
  body: commentBody,
  suggestion: z.string().max(COMMENT_MAX, "validation.commentMax").nullable().default(null),
});

export const editCommentInput = z.object({ body: commentBody });

/** The editor's mapped positions after a save (see domain/comments.ts). */
export const anchorsInput = z.object({
  path: bookPath,
  oid,
  anchors: z
    .array(
      z.object({
        threadId: z.number().int().positive(),
        /** null: its text was deleted. */
        from: z.number().int().min(0).nullable(),
        to: z.number().int().min(0).nullable(),
      }),
    )
    .max(1000),
});

export const commentsQuery = z.object({ path: bookPath.optional() });

export const commentMailInput = z.object({ commentMail: z.boolean() });

import type { AiAnswerPart } from "./ai-parts";

/** A tool the assistant used, as the chat shows it: "read_files" + "a.md, b.md". */
export type AiToolUse = { name: string; detail: string | null };

export type AiProposalStatus = "pending" | "applied" | "denied" | "superseded";

/** One stored message of an assistant conversation, as the editor shows it. */
export type AiMessageView = {
  id: number;
  role: "user" | "assistant";
  content: string;
  pagePath: string | null;
  /** Images keep their data; a document only its name. */
  attachments: { kind: "image" | "text"; name: string; data?: string }[];
  reasoning: string | null;
  tools: AiToolUse[];
  /** Thinking, tool steps and text in the order they happened. */
  parts: AiAnswerPart[];
  proposal: AiProposedChange[] | null;
  proposalStatus: AiProposalStatus | null;
  finish: string | null;
  error: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  credits: number | null;
  durationMs: number | null;
  createdAt: number;
};

export type AiConversationSummary = { id: number; title: string; updatedAt: number };

/** The teacher accepted (some of) a proposal, or denied it. */
export const aiProposalStatusInput = z.object({
  status: z.enum(["applied", "denied"]),
});

export const aiConversationRenameInput = z.object({
  title: z.string().trim().min(1).max(120),
});
