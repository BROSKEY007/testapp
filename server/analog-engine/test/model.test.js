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
  for (const key of ['solar_index', 'temp_swing', 'max_slope_deg', 'avg_slope_deg', 'label']) {
    assert.ok(report.mapped[key], `${key} should be mapped`);
  }
  assert.strictEqual(sites.filter((s) => s.label === 1).length, 15);
  assert.strictEqual(sites.find((s) => s.name === 'Amazon').label, 0, 'trailing space in name is trimmed');
});

test('JS logistic regression matches scikit-learn reference coefficients', () => {
  const ref = { solar_index: 1.016019, temp_swing: 1.133862, max_slope_deg: 1.450261, avg_slope_deg: -0.741575 };
  for (const f of model.features) assert.ok(Math.abs(f.coef - ref[f.key]) < 1e-4, `${f.key}: ${f.coef} vs ${ref[f.key]}`);
  assert.ok(Math.abs(model.intercept - 0.017853) < 1e-4);
});

test('leave-one-out validation matches the offline Python analysis', () => {
  assert.ok(Math.abs(model.validation.accuracy - 0.7667) < 0.001);
  assert.ok(Math.abs(model.validation.auc - 0.8267) < 0.001);
  assert.strictEqual(model.validation.per_site.length, 30);
});

test('data warnings flag the duplicated Great Plains and Rhine values', () => {
  assert.ok(model.data_warnings.some((w) => /Great Plains/.test(w) && /Rhine/.test(w)));
});

test('predictions are probabilities and clearly good or bad sites land on the right side', () => {
  const ranked = AnalogModel.predictSites(model, sites);
  assert.ok(ranked.every((r) => r.p_good >= 0 && r.p_good <= 1));
  assert.strictEqual(ranked[0].rank, 1);
  const rank = (name) => ranked.find((r) => r.name === name).rank;
  assert.ok(rank('Makhtesh Ramon') < rank('London'));
  assert.ok(rank('Death Valley') < rank('Dublin,Ireland'));
});

test('missing inputs are imputed with the training mean and reported', () => {
  const r = AnalogModel.predict(model, { solar_index: 5 });
  assert.deepStrictEqual(r.imputed.sort(), ['avg_slope_deg', 'max_slope_deg', 'temp_swing']);
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
