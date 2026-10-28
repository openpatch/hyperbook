import { rm } from "node:fs/promises";
import { afterAll } from "vitest";
import { dataDirs } from "./helpers";

afterAll(async () => {
  for (const dir of dataDirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
