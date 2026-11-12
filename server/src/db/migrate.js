import { readFile } from "node:fs/promises";
import { getConfig } from "../config/env.js";
import { createPool } from "./pool.js";
const pool = createPool(getConfig());
if (!pool) {
  console.error("DATABASE_URL is not set. Nothing to migrate.");
  process.exit(1);
}
try {
  await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  console.log("Schema is up to date.");
} finally {
  await pool.end();
}
