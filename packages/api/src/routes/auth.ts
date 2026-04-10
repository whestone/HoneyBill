import type { FastifyInstance } from "fastify";
import * as argon2 from "argon2";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/login
  app.post("/login", async (req, reply) => {
    const body = LoginSchema.parse(req.body);

    const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (!user || !user.isActive) {
      return reply.status(401).send({ message: "Ungültige Anmeldedaten" });
    }

    const valid = await argon2.verify(user.passwordHash, body.password);
    if (!valid) {
      return reply.status(401).send({ message: "Ungültige Anmeldedaten" });
    }

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });

    await db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, user.id));

    const token = app.jwt.sign({ sub: String(user.id), sessionId, role: user.role });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  });

  // POST /api/v1/auth/logout
  app.post("/logout", { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sessionId?: string };
    if (payload.sessionId) {
      await db.delete(sessions).where(eq(sessions.id, payload.sessionId));
    }
    return reply.send({ ok: true });
  });

  // GET /api/v1/auth/me
  app.get("/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(payload.sub)),
    });
    if (!user) return reply.status(401).send({ message: "Unauthorized" });
    const { passwordHash: _, ...safe } = user;
    return reply.send(safe);
  });

  // PUT /api/v1/auth/me/password
  app.put(
    "/me/password",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const body = z
        .object({ currentPassword: z.string(), newPassword: z.string().min(8) })
        .parse(req.body);
      const payload = req.user as { sub: string };
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(payload.sub)),
      });
      if (!user) return reply.status(401).send({ message: "Unauthorized" });
      const valid = await argon2.verify(user.passwordHash, body.currentPassword);
      if (!valid) return reply.status(400).send({ message: "Aktuelles Passwort falsch" });
      const newHash = await argon2.hash(body.newPassword);
      await db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
        .where(eq(users.id, user.id));
      return reply.send({ ok: true });
    }
  );
}
