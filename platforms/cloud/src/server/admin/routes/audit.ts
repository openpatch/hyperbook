import { desc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { auditQuery } from "../../../shared/schemas";
import { auditLog, users } from "../../db/schema";
import type { Deps } from "../../deps";
import type { AuthedEnv } from "../env";
import { requireAdmin } from "../middleware";
import { validate } from "../validate";

export function auditRoutes({ db }: Deps) {
  return new Hono<AuthedEnv>()
    .use(requireAdmin)
    .get("/", validate("query", auditQuery), (c) => {
      const { before, limit } = c.req.valid("query");
      const rows = db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          targetType: auditLog.targetType,
          targetId: auditLog.targetId,
          data: auditLog.data,
          createdAt: auditLog.createdAt,
          actorEmail: users.email,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorUserId))
        .where(before ? lt(auditLog.id, before) : undefined)
        .orderBy(desc(auditLog.id))
        .limit(limit + 1)
        .all();
      const page = rows.slice(0, limit);
      return c.json({
        entries: page.map((r) => ({
          ...r,
          data: r.data as Record<string, unknown> | null,
          createdAt: r.createdAt.getTime(),
        })),
        // Pass as `before` to get the next, older page.
        next: rows.length > limit ? page.at(-1)!.id : null,
      });
    });
}
