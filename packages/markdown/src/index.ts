import { Script } from "@hyperbook/types";
import { process, remark } from "./process";

declare module "vfile" {
  interface DataMap {
    directives: Record<
      string,
      {
        scripts: Script[];
        styles: string[];
        addditionalDirective: string[];
      }
    >;
    js: string[][];
    css: string[][];
    headings: {
      level: 1 | 2 | 3 | 4 | 5 | 6;
      anchor: string;
      label: string;
    }[];
    /** Twemoji file names used on the page, without the .svg extension. */
    emojis: string[];
    searchDocuments: {
      description: string;
      keywords: string[];
      heading: string;
      content: string;
      href: string;
    }[];
    /**
     * Passwords of the protect blocks on this page, keyed by instance id.
     *
     * This is how the resolved password travels from the remark stage (which
     * knows the directive attributes) to rehypeProtect (which can serialize
     * the rendered HTML). It must never reach hProperties — that is exactly
     * the leak the old `data-toast` attribute was.
     */
    protect: Record<
      string,
      {
        /** Shared unlock group, from `id=` or hashed from the node. */
        groupId: string;
        password: string;
      }
    >;
    /** Per-page occurrence counts, used to disambiguate identical directives. */
    directiveIdCounts: Record<string, number>;
    /**
     * Maps each directive's current storage id to the id it had before ids
     * became position-independent, so the client can migrate saved reader data
     * once instead of losing it.
     */
    legacyDirectiveIds: Record<string, string>;
  }
}

declare module "mdast" {
  interface HeadingData {
    id?: string;
  }
}

export { process, remark };
export { collectLinkTargets } from "./collectLinks";
export type { LinkTarget } from "./collectLinks";
export { stripProtectBlocks } from "./stripProtect";
export { collectPasswords, clearCollectedPasswords } from "./collectPasswords";
export type {
  CollectedPassword,
  PasswordOrigin,
  PasswordReport,
} from "./collectPasswords";
