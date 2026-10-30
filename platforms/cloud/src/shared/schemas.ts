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
  currentPassword: z.string().min(1, "validation.currentPasswordRequired").max(200),
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
] as const;

export type ElementRuntime = (typeof ELEMENT_RUNTIMES)[number];

/** Where an element's runtime loads from, for books that do not decide in hyperbook.json. */
export const elementRuntimeChoice = z.enum(["local", "cdn"]);

export const instanceSettingsInput = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(100),
    defaultEntitlements: entitlementOverridesInput,
    reservedSlugs: z
      .array(z.string().trim().toLowerCase().min(1).max(63))
      .max(500),
    imprintUrl: z.union([
      z.url("Enter a full URL, starting with https://"),
      z.literal(""),
    ]),
    privacyUrl: z.union([
      z.url("Enter a full URL, starting with https://"),
      z.literal(""),
    ]),
    imprintMarkdown: z.string().max(100_000, "At most 100 000 characters"),
    privacyMarkdown: z.string().max(100_000, "At most 100 000 characters"),
    signupMode: z.enum(["closed", "open", "domains", "approval"]),
    signupDomains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/,
            "Enter domains like schule.de",
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
    gitPushUpdatesPreview: z.boolean(),
    aiModels: z
      .array(
        z.object({
          id: z.string().trim().min(1, "Enter a model name").max(200),
          weight: z.number("Enter a number").positive("The weight must be above 0").max(1000),
          label: z.string().trim().max(60).optional(),
        }),
      )
      .max(50)
      .refine((models) => new Set(models.map((m) => m.id)).size === models.length, "Each model may be listed once"),
    aiDefaultModel: z.string().nullable(),
  })
  .partial();

/** An optional note on a publish, stored on the build row (shown in the builds table). */
export const publishInput = z
  .object({
    note: z.string().trim().max(200, "At most 200 characters").default(""),
  })
  .partial();

/** A rollback target: one of the book's version tags. */
export const rollbackInput = z.object({
  tag: z.string().regex(/^v\d+$/, "Choose a version tag like v3"),
});

/** A label for a new git API token, so it can be told apart later. */
export const gitTokenInput = z
  .object({
    label: z.string().trim().max(100, "At most 100 characters").default(""),
  })
  .partial();

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter an address")
  .max(63, "Use at most 63 characters")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use lowercase letters, digits and hyphens; start and end with a letter or digit",
  )
  .refine((s) => !s.includes("--"), "Two hyphens in a row are not allowed");

export const createBookInput = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  slug,
  description: z.string().trim().max(2000).default(""),
});

export const updateBookInput = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(200),
    slug,
    description: z.string().trim().max(2000),
    visibility: z.enum(["public", "private"]),
    /** A book hosted elsewhere (e.g. GitHub Pages); null to host it here. */
    externalUrl: z.union([
      z.url("Enter a full URL, starting with https://"),
      z.null(),
    ]),
  })
  .partial();

/** A custom domain for a book (M5); the server checks the rest. */
export const bookDomainInput = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/\.$/, ""))
    .pipe(
      z.string().min(1, "Enter a domain").max(253, "The domain is too long"),
    ),
});

export const slugRequestInput = z.object({
  slug,
  description: z
    .string()
    .trim()
    .min(1, "Say what the book is about, for the admin who decides")
    .max(2000, "Use at most 2000 characters"),
});

export const slugDecisionInput = z.object({
  note: z.string().trim().max(2000, "Use at most 2000 characters").default(""),
});

export const addMemberInput = z.object({
  email,
  role: z.enum(["owner", "editor"]).default("editor"),
});

export const updateMemberInput = z.object({
  role: z.enum(["owner", "editor"]),
});

export const groupInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
});

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter a username")
  .max(40, "Use at most 40 characters")
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    "Use lowercase letters, digits, dots, hyphens and underscores",
  );

export const createStudentInput = z.object({
  username,
  /** Left out: generated. */
  password: z.string().min(4, "Use at least 4 characters").max(100).optional(),
});

export const generateStudentsInput = z.object({
  count: z.number().int().min(1, "At least 1").max(200, "At most 200 at once"),
  prefix: z
    .string()
    .trim()
    .toLowerCase()
    .max(20, "Use at most 20 characters")
    .regex(
      /^[a-z][a-z0-9-]*$|^$/,
      "Start with a letter; then letters, digits and hyphens",
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
  password: z.string().min(4, "Use at least 4 characters").max(100).optional(),
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
  if (/[\0\\]/.test(path))
    return "validation.pathCharacters";
  if (path.startsWith("/") || path.endsWith("/"))
    return "validation.pathEnds";
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
  .regex(
    /^[\p{L}\p{M}][\p{L}\p{M}'’-]*$/u,
    "validation.singleWord",
  )
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

export const initFilesInput = z.object({
  template: z.enum(["default", "empty"]),
});

/** A request to the editor's AI writing assistant (docs/cloud-ai-assistant.md). */
export const aiAssistInput = z
  .object({
    action: z.enum(["free", "continue", "improve"]),
    /** What the assistant should do; required for "free". */
    prompt: z.string().trim().max(4000).optional(),
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
  })
  .superRefine((input, ctx) => {
    if (input.action === "free" && !input.prompt) {
      ctx.addIssue({
        code: "custom",
        message: "validation.aiPromptRequired",
        path: ["prompt"],
      });
    }
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
