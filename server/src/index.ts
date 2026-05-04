import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { teachersRoutes } from "./routes/teachers.js";

const app = new Hono();

// Logger HTTP
app.use("*", logger());

/**
 * CORS — permite el dominio de Vercel + localhost.
 * Puedes pasar varios separados por coma en CORS_ORIGINS,
 * o '*' para permitir cualquier origen (no recomendado en prod con cookies).
 */
const corsOriginsRaw = process.env.CORS_ORIGINS ?? "*";
const allowedOrigins = corsOriginsRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (allowedOrigins.includes("*")) return origin;
      return allowedOrigins.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 86400,
  })
);

// Health checks
app.get("/", (c) =>
  c.json({
    name: "quicesiaproyect-api",
    status: "ok",
    docs: "/api/teachers",
  })
);
app.get("/health", (c) => c.json({ status: "ok" }));

// API
app.route("/api/teachers", teachersRoutes);

// 404 fallback
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("[unhandled]", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT) || 3001;

serve(
  { fetch: app.fetch, port, hostname: "0.0.0.0" },
  ({ port }) => {
    console.log(`API lista en http://0.0.0.0:${port}`);
    console.log(`CORS origins: ${corsOriginsRaw}`);
  }
);
