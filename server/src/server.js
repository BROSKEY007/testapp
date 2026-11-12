import { createApp } from "./app.js";
import { getConfig } from "./config/env.js";
import { createPool } from "./db/pool.js";

const config = getConfig();
const pool = createPool(config);
const server = createApp({ config, pool }).listen(config.port, config.host, () =>
  console.log(
    `TERRA server on http://${config.host}:${config.port} · site details: ${pool ? "PostgreSQL" : "bundled (no DATABASE_URL)"}`,
  ),
);

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await pool?.end().catch(() => {});
    process.exit(0);
  });
  // Do not hang forever on open keep-alive connections.
  setTimeout(() => process.exit(1), 10000).unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, shutdown);
