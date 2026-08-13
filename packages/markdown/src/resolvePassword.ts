import { HyperbookContext } from "@hyperbook/types";
import { envVarFor } from "@hyperbook/fs";
import { Node } from "unist";
import { VFile } from "vfile";

export type PasswordRequest = {
  /** Literal password from `password=` or frontmatter. */
  password?: string;
  /** Registry key from `use=` or the string form of frontmatter `protect`. */
  use?: string;
  /** Human readable location, used in messages. */
  where: string;
  /** Node the reference came from, so failures carry a line number. */
  node?: Node;
};

/**
 * Turns a password reference into an actual password.
 *
 * An unresolvable `use=` key fails the build rather than falling back to an
 * empty password: an empty password still produces valid ciphertext, so the
 * content would be published behind a key everyone can guess.
 */
export const resolvePassword = (
  ctx: HyperbookContext,
  file: VFile,
  { password, use, where, node }: PasswordRequest,
): string => {
  if (use) {
    if (password) {
      file.info(
        `${where} sets both "use" and "password". Using the registry entry "${use}".`,
        node,
      );
    }
    // The per-key variable also covers keys the registry never listed, so CI
    // can supply a password without maintaining a registry file at all.
    const value = ctx.passwords?.[use]?.value || process.env[envVarFor(use)];
    if (!value) {
      file.fail(
        `${where} uses the password "${use}", which is not defined.\n` +
          `  Add it to your password registry, or set ${envVarFor(use)}.\n` +
          `  Run "hyperbook passwords check" to list everything that is missing.`,
        node,
      );
    }
    return value!;
  }

  if (password) {
    return password;
  }

  file.info(
    `${where} has no password. Its content will be readable by anyone who submits an empty password.`,
    node,
  );
  return "";
};
