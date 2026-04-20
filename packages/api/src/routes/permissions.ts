import type { FastifyInstance } from "fastify";
import { UpdatePermissionsSchema } from "@honeybill/shared";
import { getFullMatrix, updateMatrix } from "../services/permissions.service.js";

export async function permissionRoutes(app: FastifyInstance) {
  // Nur Admins duerfen die Matrix lesen/schreiben. Das ist bewusst hart-codiert
  // (nicht ueber die Matrix selbst steuerbar), um Lockout zu verhindern.
  const adminOnly = async (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    const payload = req.user as { role?: string } | undefined;
    if (payload?.role !== "admin") {
      return reply.status(403).send({ message: "Nur fuer Administratoren" });
    }
  };

  // GET /api/v1/permissions — volle Matrix fuer konfigurierbare Rollen
  app.get(
    "/",
    { onRequest: [app.authenticate], preHandler: [adminOnly] },
    async (_req, reply) => {
      const matrix = await getFullMatrix();
      return reply.send({ matrix });
    },
  );

  // PUT /api/v1/permissions — Matrix atomar aktualisieren
  app.put(
    "/",
    { onRequest: [app.authenticate], preHandler: [adminOnly] },
    async (req, reply) => {
      const input = UpdatePermissionsSchema.parse(req.body);
      await updateMatrix(input.entries);
      const matrix = await getFullMatrix();
      return reply.send({ matrix });
    },
  );
}
