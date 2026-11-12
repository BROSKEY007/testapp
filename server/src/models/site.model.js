import { sites as bundled } from "@terra/shared";
const toSite = (row) => ({
  id: row.id,
  datasetName: row.dataset_name,
  name: row.name,
  country: row.country,
  lat: row.lat,
  lon: row.lon,
  coordsApproximate: row.coords_approximate,
  type: row.type,
  tag: row.tag,
});
// With a pool, site details come from PostgreSQL. Without one, from shared/src/sites.js.
// If the database is configured but cannot be reached, the request still succeeds from
// the bundled list and says so in `source`, so a sleeping or over-quota database never
// takes the site down. /api/v1/health reports the database separately.
export function createSiteModel(pool) {
  if (!pool) return { source: () => "bundled", all: async () => bundled };
  let lastSource = "postgres";
  return {
    source: () => lastSource,
    async all() {
      try {
        const { rows } = await pool.query(
          `SELECT id, dataset_name, name, country, lat, lon, coords_approximate, type, tag
             FROM sites ORDER BY name`,
        );
        if (rows.length === 0) throw Error("the sites table is empty; run npm run db:seed");
        lastSource = "postgres";
        return rows.map(toSite);
      } catch (error) {
        console.error("PostgreSQL unavailable, using the bundled site list:", error.message);
        lastSource = "bundled (database unreachable)";
        return bundled;
      }
    },
  };
}
