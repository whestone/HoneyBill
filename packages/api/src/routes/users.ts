import type { FastifyInstance } from "fastify";
import * as argon2 from "argon2";
import { eq, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { CreateUserSchema, UpdateUserSchema } from "@honeybill/shared";

function requireAdmin(req: any, reply: any, done: () => void) {
  const payload = req.user as { role?: string };
  if (payload.role !== "admin") {
    reply.status(403).send({ message: "Nur Administratoren haben Zugriff" });
    return;
  }
  done();
}

export async function userRoutes(app: FastifyInstance) {
  // GET /api/v1/users
  app.get("/", { onRequest: [app.authenticate, requireAdmin] }, async (_req, reply) => {
    const rows = await db.query.users.findMany({ orderBy: (u, { asc }) => [asc(u.fullName)] });
    return reply.send(rows.map(({ passwordHash: _, ...u }) => u));
  });

  // POST /api/v1/users
  app.post("/", { onRequest: [app.authenticate, requireAdmin] }, async (req, reply) => {
    const input = CreateUserSchema.parse(req.body);

    const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
    if (existing) {
      return reply.status(409).send({ message: "E-Mail-Adresse bereits vergeben" });
    }

    const passwordHash = await argon2.hash(input.password);
    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        passwordHash,
        isActive: true,
      })
      .returning();

    const { passwordHash: _, ...safe } = user!;
    return reply.status(201).send(safe);
  });

  // PUT /api/v1/users/:id
  app.put("/:id", { onRequest: [app.authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = Number(id);
    const input = UpdateUserSchema.parse(req.body);
    const caller = req.user as { sub: string };

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return reply.status(404).send({ message: "Benutzer nicht gefunden" });

    // Prevent admin from deactivating themselves
    if (input.isActive === false && String(userId) === caller.sub) {
      return reply.status(400).send({ message: "Sie können sich nicht selbst deaktivieren" });
    }

    // Check email uniqueness if changing
    if (input.email !== undefined && input.email !== user.email) {
      const conflict = await db.query.users.findFirst({ where: eq(users.email, input.email) });
      if (conflict) return reply.status(409).send({ message: "E-Mail-Adresse bereits vergeben" });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (input.email !== undefined) updateData.email = input.email;
    if (input.fullName !== undefined) updateData.fullName = input.fullName;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.password !== undefined) updateData.passwordHash = await argon2.hash(input.password);

    await db.update(users).set(updateData).where(eq(users.id, userId));

    // If deactivated, revoke all sessions
    if (input.isActive === false) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    }

    const updated = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const { passwordHash: _, ...safe } = updated!;
    return reply.send(safe);
  });

  // DELETE /api/v1/users/:id  (deactivate only — no hard delete to preserve audit trail)
  app.delete("/:id", { onRequest: [app.authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = Number(id);
    const caller = req.user as { sub: string };

    if (String(userId) === caller.sub) {
      return reply.status(400).send({ message: "Sie können sich nicht selbst löschen" });
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return reply.status(404).send({ message: "Benutzer nicht gefunden" });

    await db.update(users)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));

    return reply.status(204).send();
  });
}
