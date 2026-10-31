/**
 * HTTPS on custom domains (M5): the TLS proxy in front (Caddy, on-demand
 * TLS) obtains a certificate for a domain on the first request, after
 * /api/tls-check allowed it. The HTTPS check is one such request, passed in
 * through Deps so tests can answer it from a table.
 */
export type UrlFetcher = (url: string) => Promise<Response>;

/** Production: one request, generous timeout so a certificate can be obtained. */
export const createUrlFetcher = (): UrlFetcher => (url) =>
  fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });

/** Answers from a table instead of the network. For tests. */
export function createMemoryUrlFetcher(): UrlFetcher & {
  /** Known URLs; a status answers with that status, an Error is thrown. */
  responses: Map<string, number | Error>;
} {
  const responses = new Map<string, number | Error>();
  const fetcher = async (url: string) => {
    const reply = responses.get(url);
    if (reply === undefined)
      throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
    if (reply instanceof Error) throw reply;
    return new Response("ok", { status: reply });
  };
  return Object.assign(fetcher, { responses });
}
