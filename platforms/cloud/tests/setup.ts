import { rm } from "node:fs/promises";
import { afterAll } from "vitest";
import { dataDirs } from "./helpers";

afterAll(async () => {
  // A render may still be writing into its folder when the tests end; rm
  // retries until the folder is empty instead of failing with ENOTEMPTY.
  for (const dir of dataDirs.splice(0))
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
