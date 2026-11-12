'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { attributeSimilarity, scoreSite, rankSites } = require('../src/scoring');

const marsLike = {
  id: 'a', temp_mean_c: -10, precip_mm_yr: 20, ndvi: 0.02, temp_diurnal_range_c: 30,
  albedo: 0.2, soil_iron_pct: 12, elevation_m: 3000, slope_deg: 8, rock_abundance_pct: 15, radar_backscatter_db: -10
};
const rainforest = {
  id: 'b', temp_mean_c: 27, precip_mm_yr: 2300, ndvi: 0.85, temp_diurnal_range_c: 8,
  albedo: 0.13, soil_iron_pct: 8, elevation_m: 60, slope_deg: 2, rock_abundance_pct: 1, radar_backscatter_db: -7
};

test('attribute inside range scores 1, outside decays monotonically', () => {
  const spec = { range: [0, 10], softness: 5, weight: 1 };
  assert.strictEqual(attributeSimilarity(5, spec), 1);
  const near = attributeSimilarity(12, spec);
  const far = attributeSimilarity(30, spec);
  assert.ok(near < 1 && near > far && far >= 0);
});

test('Mars-like site beats rainforest for Mars', () => {
  const a = scoreSite(marsLike, 'mars');
  const b = scoreSite(rainforest, 'mars');
  assert.ok(a.score > 90, `expected >90 got ${a.score}`);
  assert.ok(b.score < 40, `expected <40 got ${b.score}`);
});

test('missing attributes lower coverage but do not crash or zero the score', () => {
  const thin = { id: 'c', ndvi: 0.01, precip_mm_yr: 10 };
  const r = scoreSite(thin, 'moon');
  assert.ok(r.coverage < 0.5);
  assert.strictEqual(r.confidence, 'low');
  assert.ok(r.score > 0);
});

test('rankSites orders best first and filters low coverage', () => {
  const thin = { id: 'c', ndvi: 0.01 };
  const out = rankSites([rainforest, marsLike, thin], 'mars', { minCoverage: 0.5 });
  assert.strictEqual(out.results[0].id, 'a');
  assert.ok(!out.results.some((r) => r.id === 'c'));
  assert.strictEqual(out.results[0].rank, 1);
});

test('training purpose penalizes remote sites', () => {
  const near = scoreSite({ ...marsLike, infra_distance_km: 10 }, 'mars', { purpose: 'training' });
  const remote = scoreSite({ ...marsLike, infra_distance_km: 1500 }, 'mars', { purpose: 'training' });
  assert.ok(near.score > remote.score);
});

test('summary is deterministic text consistent with the score', () => {
  const good = scoreSite(marsLike, 'mars');
  const bad = scoreSite(rainforest, 'mars');
  assert.match(good.summary, /^Strong Mars analog/);
  assert.match(bad.summary, /^Poor Mars analog/);
  assert.match(bad.summary, /Main gaps:/);
  assert.ok(!good.summary.includes('—'), 'no em dashes');
  assert.ok(!/,\s+and\s/.test(bad.summary), 'no Oxford comma');
});

test('explanations attach only when present', () => {
  const { attachExplanation } = require('../src/explanations');
  const r = { id: 7, target: 'mars' };
  assert.strictEqual(attachExplanation(r, {}).ai_explanation, undefined);
  assert.strictEqual(attachExplanation(r, { mars: { 7: 'hello' } }).ai_explanation, 'hello');
});

test('unknown target throws a clear error', () => {
  assert.throws(() => scoreSite(marsLike, 'venus'), /Unknown target/);
});
