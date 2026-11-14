'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadCsv } = require('../src/loader');
const AnalogModel = require('../src/model');

const csv = path.join(__dirname, '..', 'data', 'nasa_sites.csv');
const { sites, report } = loadCsv(csv);
const model = AnalogModel.train(sites);

test('loader maps the real dataset headers, including double spaces and the label', () => {
  assert.strictEqual(sites.length, 30);
  for (const key of [...AnalogModel.FEATURES.map((f) => f.key), 'label']) {
    assert.ok(report.mapped[key], `${key} should be mapped`);
  }
  assert.strictEqual(sites.filter((s) => s.label === 1).length, 15);
  assert.strictEqual(sites.find((s) => s.name === 'Amazon').label, 0);
});

test('the model uses all 16 numeric dataset parameters and keeps all 30 sites', () => {
  assert.strictEqual(model.features.length, 16);
  assert.strictEqual(model.n, 30, 'McMurdo has no NDVI but must not be dropped');
  const mcmurdo = sites.find((s) => s.name === 'McMurdo Dry Valleys');
  assert.strictEqual(mcmurdo.ndvi, null);
});

test('JS logistic regression matches scikit-learn reference coefficients', () => {
  // Reference: StandardScaler (population sd, NaN -> 0) + LogisticRegression(C=1) on the same 16 columns.
  const ref = { solar_index: 0.154428, temp_swing: 0.278258, max_slope_deg: 0.244014, avg_slope_deg: -0.181527, precip_mm_yr: -0.868943, pet_mm_yr: 0.02055, aridity_index: 0.220463, max_wind_ms: 0.096882, peak_wind_ms: -0.133844, max_tri: 0.318525, mean_tri: -0.107415, max_twi: 0.387515, mean_twi: 0.487605, albedo: 0.623182, insolation_kwh: 1.007536, ndvi: -1.381831 };
  for (const f of model.features) assert.ok(Math.abs(f.coef - ref[f.key]) < 5e-3, `${f.key}: ${f.coef} vs ${ref[f.key]}`);
  assert.ok(Math.abs(model.intercept) < 5e-3);
});

test('leave-one-out validation matches the offline Python analysis', () => {
  assert.ok(Math.abs(model.validation.accuracy - 0.8667) < 0.001);
  assert.ok(Math.abs(model.validation.auc - 0.9422) < 0.001);
  assert.strictEqual(model.validation.per_site.length, 30);
});

test('data warnings flag the duplicated Great Plains and Rhine insolation and the missing NDVI', () => {
  assert.ok(model.data_warnings.some((w) => /Great Plains/.test(w) && /Rhine/.test(w) && /insolation_kwh/.test(w)));
  assert.ok(model.data_warnings.some((w) => /McMurdo/.test(w) && /ndvi/.test(w)));
});

test('predictions are probabilities and clearly good or bad sites land on the right side', () => {
  const ranked = AnalogModel.predictSites(model, sites);
  assert.ok(ranked.every((r) => r.p_good >= 0 && r.p_good <= 1));
  assert.strictEqual(ranked[0].rank, 1);
  const rank = (name) => ranked.find((r) => r.name === name).rank;
  assert.ok(rank('Makhtesh Ramon') < rank('London'));
  assert.ok(rank('Death Valley') < rank('Dublin'));
});

test('missing inputs are imputed with the training mean and reported', () => {
  const r = AnalogModel.predict(model, { solar_index: 5 });
  assert.strictEqual(r.imputed.length, 15);
  assert.ok(!r.imputed.includes('solar_index'));
  assert.strictEqual(r.confidence, 'reduced');
  const avg = AnalogModel.predict(model, Object.fromEntries(model.features.map((f) => [f.key, f.mean])));
  assert.ok(Math.abs(avg.p_good - 0.5) < 0.01, 'an average site sits near 50 percent');
});

test('summary text has no em dashes and no Oxford comma', () => {
  for (const r of AnalogModel.predictSites(model, sites)) {
    assert.ok(!r.summary.includes('—'));
    assert.ok(!/,\s+and\s/.test(r.summary), r.summary);
  }
});

test('nearest returns the closest known sites first', () => {
  const atacama = sites.find((s) => s.name === 'Atacama');
  const n = AnalogModel.nearest(model, sites, atacama, 2);
  assert.strictEqual(n[0].name, 'Atacama');
  assert.strictEqual(n[0].distance, 0);
});
