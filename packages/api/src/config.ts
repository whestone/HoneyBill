import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env["PORT"] ?? 3001),
  host: process.env["HOST"] ?? "127.0.0.1",
  jwtSecret: process.env["JWT_SECRET"] ?? "honeybill-dev-secret-change-in-production",
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  dataDir: process.env["DATA_DIR"] ?? path.resolve(__dirname, "../../..", "data"),
  get dbPath() {
    return path.join(this.dataDir, "db", "honeybill.db");
  },
  get uploadsDir() {
    return path.join(this.dataDir, "uploads");
  },
  get exportsDir() {
    return path.join(this.dataDir, "exports");
  },
  get iccPath() {
    return path.join(this.dataDir, "uploads", "icc", "sRGB_v4_ICC.icc");
  },
} as const;
