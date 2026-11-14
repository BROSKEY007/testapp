import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApp } from "../src/app.js";
import { getConfig } from "../src/config/env.js";
import { createEngine } from "../src/services/engine.service.js";
import { renderCatalog, catalogPath } from "../scripts/generate-catalog.js";
import { sites, bundledCatalog } from "@terra/shared";

async function withServer(options, run) {
  const server = createApp({ config: getConfig({}), ...options }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}
const getJson = async (url) => (await fetch(url)).json();
const post = (url, payload) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });

test("every dataset row has display details, and nothing else is listed", () => {
  const engine = createEngine();
  assert.equal(sites.length, engine.siteCount);
  assert.equal(new Set(sites.map((s) => s.id)).size, sites.length);
  for (const s of sites)
    assert.ok(engine.predictionFor(s.datasetName), `no dataset row for ${s.datasetName}`);
});

test("locations carry the model's predictions, ranked best first", async () => {
  await withServer({}, async (base) => {
    const data = await getJson(base + "/api/v1/locations");
    assert.equal(data.catalog, "bundled");
    assert.equal(data.locations.length, 30);
    assert.deepEqual(data.locations.map((s) => s.prediction.rank), [...Array(30).keys()].map((i) => i + 1));
    // The served prediction is the engine's own number, not a copy that can drift.
    const ranked = await getJson(base + "/api/analog/predictions");
    for (const s of data.locations) {
      const p = ranked.results.find((r) => r.name === s.datasetName);
      // Headline is the held-out probability. The engine's in-sample value is kept apart.
      assert.equal(s.prediction.heldOut, true);
      assert.equal(s.prediction.pGood, p.loo_p_good);
      assert.equal(s.prediction.fitPGood, p.p_good);
      assert.equal(s.prediction.label, p.label);
      assert.equal(s.prediction.looCorrect, p.loo_correct);
      const expected = p.loo_p_good >= 0.6 ? "good" : p.loo_p_good <= 0.4 ? "bad" : "borderline";
      assert.equal(s.prediction.verdict, expected);
      assert.ok(s.prediction.summary.includes(`${Math.round(p.loo_p_good * 100)} percent held-out`));
    }
    const heldOut = data.locations.map((s) => s.prediction.pGood);
    assert.deepEqual(heldOut, [...heldOut].sort((a, b) => b - a), "rank follows the held-out probability");
    assert.equal(data.model.n, 30);
    assert.equal(data.model.validation.accuracy, 0.8667);
    assert.deepEqual(data.model.validation.accuracyCi95, [0.733, 0.967]);
  });
});

test("a site is never listed as its own nearest neighbour", () => {
  for (const s of bundledCatalog.locations)
    assert.ok(!s.prediction.nearest.some((n) => n.name === s.datasetName), s.name);
});

test("the catalog bundled into the client matches the trained model", () => {
  assert.equal(
    readFileSync(catalogPath, "utf8"),
    renderCatalog(),
    "shared/src/catalog.generated.js is stale. Run: npm run catalog",
  );
});

test("site details come from PostgreSQL when a pool is provided", async () => {
  const row = (id, dataset_name) => ({
    id, dataset_name, name: id, country: "x", lat: 1, lon: 2,
    coords_approximate: false, type: "Desert", tag: "t",
  });
  const pool = {
    async query(text) {
      if (text === "SELECT 1") return { rows: [{}] };
      return { rows: [row("not-in-dataset", "Nowhere"), row("dv", "death valley")] };
    },
  };
  await withServer({ pool }, async (base) => {
    const data = await getJson(base + "/api/v1/locations");
    assert.equal(data.catalog, "postgres");
    assert.deepEqual(data.locations.map((s) => s.id), ["dv", "not-in-dataset"]);
    assert.equal(data.locations[0].prediction.rank, 6); // held-out rank of Death Valley
    assert.equal(data.locations[0].coordsApproximate, false);
    // No dataset row means no prediction. A score is never invented.
    assert.equal(data.locations[1].prediction, null);
    assert.equal((await getJson(base + "/api/v1/health")).database, "ok");
  });
});

test("a sleeping or empty database falls back to the bundled list, not an error", async () => {
  for (const pool of [
    { query: async () => { throw Error("connection timeout"); } },
    { query: async () => ({ rows: [] }) },
  ])
    await withServer({ pool }, async (base) => {
      const response = await fetch(base + "/api/v1/locations");
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.catalog, "bundled (database unreachable)");
      assert.equal(data.locations.length, 30);
      assert.equal(data.locations[0].prediction.rank, 1);
    });
});

test("health reports the model, and degrades when the database is unreachable", async () => {
  await withServer({}, async (base) => {
    assert.deepEqual(await getJson(base + "/api/v1/health"), {
      status: "ok",
      database: "not configured",
      model: { loaded: true, sites: 30, accuracy: 0.8667 },
    });
  });
  const pool = { query: async () => { throw Error("down"); } };
  await withServer({ pool }, async (base) => {
    const r = await fetch(base + "/api/v1/health");
    assert.equal(r.status, 503);
    assert.equal((await r.json()).database, "unreachable");
  });
});

test("the analog engine API works when mounted in this Express 5 app", async () => {
  await withServer({}, async (base) => {
    const a = base + "/api/analog";
    const health = await getJson(a + "/health");
    assert.equal(health.sites_loaded, 30);
    assert.equal(health.model_loaded, true);
    assert.equal((await getJson(a + "/predictions?label=1")).total, 15);
    assert.equal((await getJson(a + "/challenge-sites")).total, 3);
    assert.equal((await getJson(a + "/model")).validation.accuracy, 0.8667);

    // All 16 features, as documented in the engine hand-off (p_good 0.9747).
    const input = {
      solar_index: 5.9, temp_swing: 23, max_slope_deg: 70, avg_slope_deg: 5, precip_mm_yr: 190,
      pet_mm_yr: 1700, aridity_index: 0.11, max_wind_ms: 12.7, peak_wind_ms: 14.6, max_tri: 260,
      mean_tri: 7.5, max_twi: 24, mean_twi: 7.4, albedo: 0.35, insolation_kwh: 6.0, ndvi: 0.12,
    };
    const viaPost = await (await post(a + "/predict", input)).json();
    const viaGet = await getJson(a + "/predict?" + new URLSearchParams(input));
    assert.equal(viaPost.p_good, 0.9747);
    assert.equal(viaGet.p_good, viaPost.p_good);
    assert.equal(viaPost.nearest_known_sites.length, 3);

    // Fewer than 12 of the 16 features are refused. 12 are scored with the rest imputed.
    const keys = Object.keys(input);
    const subset = (n) => Object.fromEntries(keys.slice(0, n).map((k) => [k, input[k]]));
    assert.equal((await post(a + "/predict", { solar_index: 5 })).status, 400);
    assert.equal((await post(a + "/predict", subset(3))).status, 400);
    assert.equal((await post(a + "/predict", subset(11))).status, 400);
    const twelve = await (await post(a + "/predict", subset(12))).json();
    assert.equal(twelve.confidence, "reduced");
    assert.equal(twelve.imputed.length, 4);
    assert.equal(twelve.nearest_known_sites.length, 3);
    // Only the model's features are echoed back.
    const echoed = await getJson(a + "/predict?" + new URLSearchParams({ ...input, zzz: "<script>" }));
    assert.deepEqual(Object.keys(echoed.input).sort(), Object.keys(input).sort());

    assert.equal((await post(a + "/predict", {})).status, 400);
    assert.equal((await post(a + "/predict", { solar_index: "abc" })).status, 400);
    assert.equal((await post(a + "/predict", "{not json")).status, 400);
    assert.equal((await fetch(a + "/sites/999")).status, 404);
    assert.equal((await fetch(base + "/api/nope")).status, 404);
  });
});

test("engine reload is refused in production without an admin token", async () => {
  const before = { ...process.env };
  process.env.NODE_ENV = "production";
  delete process.env.ADMIN_TOKEN;
  try {
    await withServer({}, async (base) => {
      assert.equal((await post(base + "/api/analog/reload", {})).status, 403);
    });
    process.env.ADMIN_TOKEN = "secret-token";
    await withServer({}, async (base) => {
      assert.equal((await post(base + "/api/analog/reload", {})).status, 401);
    });
  } finally {
    process.env.NODE_ENV = before.NODE_ENV ?? "";
    if (before.NODE_ENV === undefined) delete process.env.NODE_ENV;
    delete process.env.ADMIN_TOKEN;
  }
});

test("configuration: production binds publicly, bad values are rejected", () => {
  assert.throws(() => getConfig({ TRUST_PROXY: "yes" }));
  assert.throws(() => getConfig({ PORT: "70000" }));
  assert.equal(getConfig({}).host, "127.0.0.1");
  assert.equal(getConfig({ NODE_ENV: "production" }).host, "0.0.0.0");
  assert.equal(getConfig({ NODE_ENV: "production", HOST: "10.0.0.5" }).host, "10.0.0.5");
});

test("rate limit covers both APIs and counts the real visitor behind one proxy", async () => {
  await withServer({ config: getConfig({ TRUST_PROXY: "1" }) }, async (base) => {
    const hit = (path, ip) => fetch(base + path, { headers: { "X-Forwarded-For": ip } });
    for (let i = 0; i < 60; i++) await hit("/api/analog/health", "203.0.113.7");
    assert.equal((await hit("/api/v1/locations", "203.0.113.7")).status, 429);
    assert.equal((await hit("/api/analog/predict?solar_index=5", "203.0.113.7")).status, 429);
    assert.equal((await hit("/api/v1/locations", "203.0.113.8")).status, 200);
  });
});

test("engine routes reject prototype keys and null sites instead of returning 500", async () => {
  await withServer({}, async (base) => {
    const a = base + "/api/analog";
    for (const target of ["constructor", "__proto__", "toString", "", "venus"])
      assert.equal((await fetch(a + "/rank?target=" + target)).status, 400, target);
    assert.equal((await fetch(a + "/rank?target=moon&target=mars")).status, 400);
    assert.equal((await fetch(a + "/rank?target=Moon")).status, 200);
    assert.equal((await post(a + "/score", { target: "moon", site: null, sites: [null] })).status, 400);
    assert.equal((await post(a + "/score", { target: "moon", sites: [null] })).status, 400);
    assert.equal((await post(a + "/score", { target: "moon", sites: [1] })).status, 400);
    assert.equal((await post(a + "/score", { target: "constructor", site: {} })).status, 400);
    assert.equal((await post(a + "/score", { target: "moon", site: { albedo: 0.1 } })).status, 200);
  });
});

test("TRUST_PROXY: start-up can tell whether it was set deliberately", () => {
  assert.equal(getConfig({}).trustProxyExplicit, false);
  assert.equal(getConfig({ TRUST_PROXY: "" }).trustProxyExplicit, false);
  assert.equal(getConfig({ TRUST_PROXY: "0" }).trustProxyExplicit, true);
  assert.equal(getConfig({ TRUST_PROXY: "1" }).trustProxy, 1);
});