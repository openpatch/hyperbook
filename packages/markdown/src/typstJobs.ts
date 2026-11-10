import { createHash } from "crypto";
import path from "path";
import { VFile } from "vfile";

/*
 * Typst documents a page asks for. `::pdf[…]{src="blatt.typ"}` registers a
 * compile job on the page's vfile; the build runs the jobs after the pages,
 * like the archive includes, and the page already links to the PDF the job
 * will write.
 */

export interface TypstJob {
  /** The source, relative to the book's root (`book/blatt.typ`, posix). */
  src: string;
  /** Where the PDF is served (`/blatt.pdf`, `/blatt.1a2b3c4d.pdf`). */
  out: string;
  /** `--input` values, sorted by key. */
  inputs: Record<string, string>;
}

const INPUT_KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * `inputs="loesung=true, gruppe=A"` as an object, or an error message. Keys
 * are Typst identifiers; a value runs to the next comma.
 */
export function parseTypstInputs(
  value: string,
): { inputs: Record<string, string> } | { error: string } {
  const inputs: Record<string, string> = {};
  for (const part of value.split(",")) {
    if (part.trim() === "") continue;
    const at = part.indexOf("=");
    if (at < 0) return { error: `"${part.trim()}" is not key=value` };
    const key = part.slice(0, at).trim();
    if (!INPUT_KEY.test(key)) return { error: `"${key}" is not a valid input name` };
    inputs[key] = part.slice(at + 1).trim();
  }
  return { inputs: sortInputs(inputs) };
}

export const sortInputs = (inputs: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(inputs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );

/** A short hash over the sorted inputs, part of the PDF's name. */
export function inputsHash(inputs: Record<string, string>): string {
  const text = Object.entries(sortInputs(inputs))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  return createHash("sha256").update(text).digest("hex").slice(0, 8);
}

/**
 * The address of the PDF built from the source at `href`: `.typ` becomes
 * `.pdf`, and with inputs the hash goes in between.
 */
export function typstOutputHref(
  href: string,
  inputs: Record<string, string>,
): string {
  const dir = path.posix.dirname(href);
  const name = path.posix.basename(href, path.posix.extname(href));
  const file =
    Object.keys(inputs).length > 0
      ? `${name}.${inputsHash(inputs)}.pdf`
      : `${name}.pdf`;
  return path.posix.join(dir, file);
}

/** Records a job on the page; one per output, however often it is named. */
export function registerTypstJob(file: VFile, job: TypstJob) {
  const jobs = (file.data.typstJobs ||= []) as TypstJob[];
  if (!jobs.some((existing) => existing.out === job.out)) jobs.push(job);
}

/** Records a `.typ` source a `:download` hands out as it is. */
export function registerTypstDownload(file: VFile, href: string) {
  const hrefs = (file.data.typstDownloads ||= []) as string[];
  if (!hrefs.includes(href)) hrefs.push(href);
}
