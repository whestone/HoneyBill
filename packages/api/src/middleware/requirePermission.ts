import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type { PermissionResource } from "@honeybill/shared";
import { hasPermission } from "../services/permissions.service.js";

declare module "fastify" {
  interface FastifyInstance {
    /**
     * Fastify-preHandler, der eine Rechte-Pruefung erzwingt.
     * Nutzung: `{ onRequest: [app.authenticate], preHandler: [app.requirePermission("documents", "edit")] }`
     * Setzt voraus, dass `authenticate` bereits gelaufen ist (JWT-Payload enthaelt `role`).
     */
    requirePermission: (
      resource: PermissionResource,
      action: "view" | "edit",
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const requirePermissionPlugin = fp(async (app: FastifyInstance) => {
  app.decorate(
    "requirePermission",
    (resource: PermissionResource, action: "view" | "edit") => {
      return async (req: FastifyRequest, reply: FastifyReply) => {
        const payload = req.user as { role?: string } | undefined;
        const role = payload?.role;
        if (!role) {
          return reply.status(401).send({ message: "Unauthorized" });
        }
        const ok = await hasPermission(role, resource, action);
        if (!ok) {
          return reply
            .status(403)
            .send({ message: "Keine Berechtigung fuer diese Aktion" });
        }
      };
    },
  );
});
