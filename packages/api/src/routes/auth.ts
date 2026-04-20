import type { FastifyInstance } from "fastify";
import * as argon2 from "argon2";
import { v4 as uuidv4 } from "uuid";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { z } from "zod";
import { appendAudit } from "../services/audit.service.js";
import { getPermissionsForRole } from "../services/permissions.service.js";

const LoginSchema = z.object({
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(200),
});

/** Mindestens 12 Zeichen, mind. 1 Buchstabe und 1 Ziffer. */
const PasswordPolicy = z
  .string()
  .min(12, "Passwort muss mindestens 12 Zeichen lang sein")
  .max(200)
  .refine((v) => /[A-Za-zÄÖÜäöüß]/.test(v), "Passwort muss mindestens einen Buchstaben enthalten")
  .refine((v) => /\d/.test(v), "Passwort muss mindestens eine Ziffer enthalten");

// Strenges Rate-Limit für Auth-Endpunkte: 5 Requests / Minute / IP.
const authRateLimit = {
  rateLimit: {
    max: 5,
    timeWindow: "1 minute",
  },
} as const;

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/login
  app.post("/login", { config: authRateLimit }, async (req, reply) => {
    const body = LoginSchema.parse(req.body);

    const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (!user || !user.isActive) {
      // Konstante Antwort -> keine User-Enumeration.
      return reply.status(401).send({ message: "Ungültige Anmeldedaten" });
    }

    const valid = await argon2.verify(user.passwordHash, body.password);
    if (!valid) {
      req.log.warn({ userId: user.id, ip: req.ip }, "Fehlgeschlagener Login-Versuch");
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

    await appendAudit({
      userId: user.id,
      action: "login",
      entityType: "user",
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });

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
    const { passwordHash: _ph, ...safe } = user;
    const permissions = await getPermissionsForRole(user.role);
    return reply.send({ ...safe, permissions });
  });

  // PUT /api/v1/auth/me/password
  app.put(
    "/me/password",
    { onRequest: [app.authenticate], config: authRateLimit },
    async (req, reply) => {
      const body = z
        .object({ currentPassword: z.string().min(1), newPassword: PasswordPolicy })
        .parse(req.body);
      const payload = req.user as { sub: string; sessionId?: string };
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

      await appendAudit({
        userId: user.id,
        action: "password_change",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] ?? null,
      });

      // Bei Passwort-Wechsel alle anderen Sessions des Users invalidieren.
      if (payload.sessionId) {
        const keep = payload.sessionId;
        const allSessions = await db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.userId, user.id));
        for (const s of allSessions) {
          if (s.id !== keep) {
            await db.delete(sessions).where(eq(sessions.id, s.id));
          }
        }
      }

      return reply.send({ ok: true });
    },
  );
}

// Kleiner Export, damit authenticate-Middleware die gleichen Validitätsregeln nutzen kann.
export async function findActiveSession(sessionId: string) {
  const now = new Date().toISOString();
  return db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)),
  });
}
