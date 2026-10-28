import { Resolver } from "node:dns/promises";

/**
 * The DNS lookups custom domains need. Names that do not exist, or have no
 * record of the kind, give an empty list; other failures (timeouts, refused
 * servers) throw.
 */
export type Dns = {
  cname(name: string): Promise<string[]>;
};

const NO_RECORDS = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

async function orEmpty<T>(lookup: Promise<T[]>): Promise<T[]> {
  try {
    return await lookup;
  } catch (error) {
    if (NO_RECORDS.has((error as NodeJS.ErrnoException).code ?? "")) return [];
    throw error;
  }
}

export function createDns(): Dns {
  const resolver = new Resolver({ timeout: 5000, tries: 2 });
  return {
    cname: (name) => orEmpty(resolver.resolveCname(name)),
  };
}

/** Answers from a table instead of the network. For tests. */
export function createMemoryDns(): Dns & { records: Map<string, { cname?: string[] }> } {
  const records = new Map<string, { cname?: string[] }>();
  return {
    records,
    cname: async (name) => records.get(name.toLowerCase().replace(/\.$/, ""))?.cname ?? [],
  };
}
