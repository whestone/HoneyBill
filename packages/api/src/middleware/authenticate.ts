import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

// Extend FastifyInstance with authenticate decorator
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

import type { FastifyRequest, FastifyReply } from "fastify";

export const authenticatePlugin = fp(async (app: FastifyInstance) => {
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ message: "Unauthorized" });
    }
  });
});
