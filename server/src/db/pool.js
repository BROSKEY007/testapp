import pg from "pg";
// Returns null when DATABASE_URL is not set, so the server can still run
// from the bundled site list (useful for the offline demo and for tests).
export function createPool(config) {
  if (!config.databaseUrl) return null;
  // An explicit `ssl` option overrides sslmode in the connection string, so only
  // set one when the URL does not already say. Managed providers (Neon, Supabase,
  // Render) present publicly trusted certificates, so these verify them;
  // never pass rejectUnauthorized:false, which would accept any certificate.
  const hasSslMode = new URL(config.databaseUrl).searchParams.has("sslmode");
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ...(hasSslMode ? {} : { ssl: config.databaseSsl }),
    max: 10,
    idleTimeoutMillis: 30000,
    // Serverless Postgres (Neon and similar) suspends when idle, so the first
    // connection after a pause waits for the database to wake up.
    connectionTimeoutMillis: 20000,
  });
  // An idle client error must not crash the process.
  pool.on("error", (error) => console.error("PostgreSQL pool error:", error.message));
  return pool;
}
