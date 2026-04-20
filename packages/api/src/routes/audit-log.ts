import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLog } from "../db/schema.js";
import { verifyAuditChain } from "../services/audit.service.js";

export async function auditLogRoutes(app: FastifyInstance) {
  app.get("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as {
      entity?: string; entityId?: string; user?: string;
      from?: string; to?: string; page?: string; limit?: string;
    };
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (q.entity) conditions.push(eq(auditLog.entityType, q.entity));
    if (q.entityId) conditions.push(eq(auditLog.entityId, Number(q.entityId)));
    if (q.user) conditions.push(eq(auditLog.userId, Number(q.user)));
    if (q.from) conditions.push(gte(auditLog.createdAt, q.from));
    if (q.to) conditions.push(lte(auditLog.createdAt, q.to));

    const [total, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(auditLog)
        .where(conditions.length ? and(...conditions) : undefined)
        .then((r) => r[0]?.count ?? 0),
      db
        .select()
        .from(auditLog)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    return reply.send({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  // GoBD: Integritätsprüfung der Hash-Kette
  app.get("/verify", { onRequest: [app.authenticate] }, async (_req, reply) => {
    const result = await verifyAuditChain();
    return reply.status(result.ok ? 200 : 409).send(result);
  });
}
