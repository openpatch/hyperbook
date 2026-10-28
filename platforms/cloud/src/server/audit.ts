import type { Db } from "./db/client";
import { auditLog } from "./db/schema";

export type AuditTarget =
  | "user"
  | "book"
  | "group"
  | "student"
  | "instance"
  | "session";

/** Records who did what. Never store secrets in `data`. */
export function audit(
  db: Db,
  entry: {
    actorUserId: number | null;
    action: string;
    targetType: AuditTarget;
    targetId?: number | null;
    data?: Record<string, unknown>;
  },
) {
  db.insert(auditLog)
    .values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      data: entry.data ?? null,
    })
    .run();
}
