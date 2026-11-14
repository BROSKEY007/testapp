// Reads and validates every environment variable in one place.
export function getConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const port = Number(env.PORT || 4175);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw Error("PORT must be a valid port number");
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0)
    throw Error("TRUST_PROXY must be a non-negative integer");
  return {
    nodeEnv,
    // Hosts route traffic to 0.0.0.0; loopback keeps local development private.
    host: env.HOST || (nodeEnv === "production" ? "0.0.0.0" : "127.0.0.1"),
    port,
    trustProxy,
    // False when the variable was never set, so start-up can warn in production.
    trustProxyExplicit: env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== "",
    origins: (env.CORS_ORIGINS || "http://localhost:4174,http://127.0.0.1:4174")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    databaseUrl: env.DATABASE_URL || "",
    databaseSsl: env.DATABASE_SSL === "true",
  };
}