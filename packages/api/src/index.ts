import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { authenticatePlugin } from "./middleware/authenticate.js";
import { authRoutes } from "./routes/auth.js";
import { customerRoutes } from "./routes/customers.js";
import { productRoutes, productCategoryRoutes } from "./routes/products.js";
import { documentRoutes } from "./routes/documents.js";
import { settingsRoutes, taxRateRoutes, numberSeriesRoutes } from "./routes/settings.js";
import { openItemsRoutes } from "./routes/open-items.js";
import { auditLogRoutes } from "./routes/audit-log.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: {
    level: config.nodeEnv === "production" ? "warn" : "info",
    transport: config.nodeEnv !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  },
});

// ─── Plugins ──────────────────────────────────────────────────────────────────

await app.register(cors, {
  origin: config.nodeEnv === "production" ? false : ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
});

await app.register(jwt, {
  secret: config.jwtSecret,
  sign: { expiresIn: "7d" },
});

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

await app.register(staticFiles, {
  root: config.uploadsDir,
  prefix: "/uploads/",
});

await app.register(authenticatePlugin);

// ─── Routes ───────────────────────────────────────────────────────────────────

await app.register(authRoutes, { prefix: "/api/v1/auth" });
await app.register(customerRoutes, { prefix: "/api/v1/customers" });
await app.register(productRoutes, { prefix: "/api/v1/products" });
await app.register(productCategoryRoutes, { prefix: "/api/v1/product-categories" });
await app.register(documentRoutes, { prefix: "/api/v1/documents" });
await app.register(settingsRoutes, { prefix: "/api/v1/settings" });
await app.register(taxRateRoutes, { prefix: "/api/v1/tax-rates" });
await app.register(numberSeriesRoutes, { prefix: "/api/v1/number-series" });
await app.register(openItemsRoutes, { prefix: "/api/v1/open-items" });
await app.register(auditLogRoutes, { prefix: "/api/v1/audit-log" });

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", async () => ({ status: "ok", version: "0.1.0" }));

// ─── Error Handler ────────────────────────────────────────────────────────────

app.setErrorHandler((error, _req, reply) => {
  app.log.error(error);
  if (error.name === "ZodError") {
    return reply.status(400).send({ message: "Validierungsfehler", errors: error.message });
  }
  const statusCode = error.statusCode ?? 500;
  return reply.status(statusCode).send({
    message: error.message ?? "Interner Serverfehler",
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`\n🍯 HoneyBill API running at http://${config.host}:${config.port}\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
