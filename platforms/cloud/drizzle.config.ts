import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from src/server/db/schema.ts into drizzle/:
//   pnpm --filter @hyperbook/cloud db:generate
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
});
