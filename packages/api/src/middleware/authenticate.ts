import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions } from "../db/schema.js";

// Extend FastifyInstance with authenticate decorator
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authenticatePlugin = fp(async (app: FastifyInstance) => {
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    // Zusätzlich zur JWT-Signatur die Session gegen die DB prüfen.
    // So kann ein Logout / Passwort-Wechsel existierende Tokens wirksam invalidieren,
    // und abgelaufene Sessions werden zuverlässig abgewiesen.
    const payload = req.user as { sessionId?: string } | undefined;
    const sessionId = payload?.sessionId;
    if (!sessionId) {
      return reply.status(401).send({ message: "Unauthorized" });
    }
    const now = new Date().toISOString();
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)),
    });
    if (!session) {
      return reply.status(401).send({ message: "Session abgelaufen" });
    }
  });
});
