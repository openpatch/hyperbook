import { and, desc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auditLog, users } from "../../db/schema";
import type { Deps } from "../../deps";
import type { AuthedEnv } from "../env";
import { requireAdmin } from "../middleware";
import { validate } from "../validate";

/*
 * The admin's view of the AI assistant's use. The numbers come from the
 * `ai.assist` entries of the audit log (metadata only: model, tokens, steps),
 * so the monitor needs no table of its own and shows exactly what the
 * provider was asked.
 */

const monitorQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  userId: z.coerce.number().int().positive().optional(),
});

type Totals = {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  credits: number;
  steps: number;
  failed: number;
};

const empty = (): Totals => ({ requests: 0, tokensIn: 0, tokensOut: 0, credits: 0, steps: 0, failed: 0 });

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function add(totals: Totals, data: Record<string, unknown>) {
  const tokensIn = num(data.tokensIn);
  const tokensOut = num(data.tokensOut);
  totals.requests += 1;
  totals.tokensIn += tokensIn;
  totals.tokensOut += tokensOut;
  totals.credits += Math.ceil((tokensIn + tokensOut) * (num(data.weight) || 1));
  totals.steps += num(data.steps);
  if (data.finish === "error") totals.failed += 1;
}

export function aiMonitorRoutes({ db }: Deps) {
  return new Hono<AuthedEnv>()
    .use(requireAdmin)
    .get("/", validate("query", monitorQuery), (c) => {
      const { days, userId } = c.req.valid("query");
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = db
        .select({
          id: auditLog.id,
          userId: auditLog.actorUserId,
          email: users.email,
          data: auditLog.data,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorUserId))
        .where(
          and(
            eq(auditLog.action, "ai.assist"),
            gte(auditLog.createdAt, since),
            userId ? eq(auditLog.actorUserId, userId) : undefined,
          ),
        )
        .orderBy(desc(auditLog.id))
        .all();

      const total = empty();
      const byModel = new Map<string, Totals>();
      const byDay = new Map<string, Totals>();
      const byUser = new Map<number | null, Totals & { email: string | null }>();
      for (const row of rows) {
        const data = (row.data ?? {}) as Record<string, unknown>;
        add(total, data);
        const model = typeof data.model === "string" ? data.model : "?";
        add(byModel.get(model) ?? byModel.set(model, empty()).get(model)!, data);
        const day = row.createdAt.toISOString().slice(0, 10);
        add(byDay.get(day) ?? byDay.set(day, empty()).get(day)!, data);
        const user =
          byUser.get(row.userId) ?? byUser.set(row.userId, { ...empty(), email: row.email }).get(row.userId)!;
        add(user, data);
      }

      return c.json({
        days,
        userId: userId ?? null,
        total,
        byModel: [...byModel].map(([model, t]) => ({ model, ...t })).sort((a, b) => b.credits - a.credits),
        byDay: [...byDay].map(([day, t]) => ({ day, ...t })).sort((a, b) => b.day.localeCompare(a.day)),
        byUser: [...byUser]
          .map(([id, t]) => ({ userId: id, ...t }))
          .sort((a, b) => b.credits - a.credits)
          .slice(0, 100),
        recent: rows.slice(0, 50).map((row) => {
          const data = (row.data ?? {}) as Record<string, unknown>;
          return {
            id: row.id,
            at: row.createdAt.getTime(),
            email: row.email,
            model: typeof data.model === "string" ? data.model : "?",
            tokensIn: num(data.tokensIn),
            tokensOut: num(data.tokensOut),
            steps: num(data.steps),
            finish: typeof data.finish === "string" ? data.finish : "?",
          };
        }),
      });
    });
}
