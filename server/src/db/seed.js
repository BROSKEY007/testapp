import { sites } from "@terra/shared";
import { getConfig } from "../config/env.js";
import { createPool } from "./pool.js";
// Inserts or refreshes the display details in shared/src/sites.js.
// Rows with other ids are left untouched.
const pool = createPool(getConfig());
if (!pool) {
  console.error("DATABASE_URL is not set. Nothing to seed.");
  process.exit(1);
}
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const s of sites)
    await client.query(
      `INSERT INTO sites (id, dataset_name, name, country, lat, lon, coords_approximate, type, tag)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         dataset_name = EXCLUDED.dataset_name, name = EXCLUDED.name, country = EXCLUDED.country,
         lat = EXCLUDED.lat, lon = EXCLUDED.lon, coords_approximate = EXCLUDED.coords_approximate,
         type = EXCLUDED.type, tag = EXCLUDED.tag, updated_at = now()`,
      [s.id, s.datasetName, s.name, s.country, s.lat, s.lon, s.coordsApproximate, s.type, s.tag],
    );
  await client.query("COMMIT");
  console.log(`Seeded ${sites.length} sites.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
