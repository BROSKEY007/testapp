import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getConfig } from "./config/env.js";
import { createSiteModel } from "./models/site.model.js";
import { createEngine } from "./services/engine.service.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { createHealthController } from "./controllers/health.controller.js";
import { createV1Router } from "./routes/v1.routes.js";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";

const clientBuild = fileURLToPath(new URL("../../client/out/", import.meta.url));

export function createApp({
  config = getConfig(),
  pool = null,
  siteModel = createSiteModel(pool),
  engine = createEngine(),
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // The Next.js static export hydrates from inline scripts.
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          upgradeInsecureRequests: config.nodeEnv === "production" ? [] : null,
        },
      },
      // HSTS only makes sense once the site is really served over HTTPS.
      strictTransportSecurity: config.nodeEnv === "production",
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin(origin, done) {
        done(null, !origin || config.origins.includes(origin));
      },
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"],
    }),
  );
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/v1/health", createHealthController({ pool, engine }));
  app.use("/api", apiRateLimit());
  // Site list with predictions, for the client.
  app.use("/api/v1", createV1Router({ siteModel, engine }));
  // The analog engine's own API (predict, predictions, model, challenge-sites, ...).
  // See server/analog-engine/docs/api-reference.md.
  app.use("/api/analog", engine.router());
  app.use("/api", apiNotFound);

  // Serve the exported React client when it has been built (npm run build).
  if (existsSync(clientBuild)) {
    app.use(
      express.static(clientBuild, {
        extensions: ["html"],
        setHeaders(res, file) {
          const rel = path.relative(clientBuild, file).split(path.sep).join("/");
          if (rel.startsWith("_next/static/"))
            // File names contain a content hash, so they can be cached forever.
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          else if (rel.startsWith("assets/"))
            res.setHeader("Cache-Control", "public, max-age=86400");
          else res.setHeader("Cache-Control", "no-cache");
        },
      }),
    );
    app.use((_req, res) =>
      res.status(404).sendFile(path.join(clientBuild, "404.html")),
    );
  }
  app.use(errorHandler);
  return app;
}
