'use strict';

// Integration test: mounts the router in a bare Express app exactly as the backend engineer will.

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createAnalogRouter } = require('../src');

let server;
let base;

test.before(async () => {
  const app = express();
  app.use('/api/analog', createAnalogRouter());
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api/analog`;
});

test.after(() => server.close());

const get = async (p) => {
  const r = await fetch(base + p);
  return { status: r.status, body: await r.json() };
};
const post = async (p, body, headers = {}) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};

test('health reports data and model loaded', async () => {
  const { status, body } = await get('/health');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.sites_loaded, 30);
  assert.strictEqual(body.model_loaded, true);
});

test('predictions returns all 30 sites ranked best first', async () => {
  const { body } = await get('/predictions');
  assert.strictEqual(body.results.length, 30);
  assert.strictEqual(body.results[0].rank, 1);
  for (let i = 1; i < body.results.length; i++) assert.ok(body.results[i - 1].p_good >= body.results[i].p_good);
  assert.ok('loo_correct' in body.results[0] && 'summary' in body.results[0]);
});

test('predictions can be filtered by dataset label and limited', async () => {
  const { body } = await get('/predictions?label=1&limit=5');
  assert.strictEqual(body.results.length, 5);
  assert.ok(body.results.every((r) => r.label === 1));
});

test('POST /predict returns probability, contributions and nearest sites', async () => {
  const { status, body } = await post('/predict', { solar_index: 5.9, temp_swing: 23, max_slope_deg: 70, avg_slope_deg: 5 });
  assert.strictEqual(status, 200);
  assert.ok(body.p_good > 0 && body.p_good < 1);
  assert.strictEqual(body.contributions.length, 4);
  assert.strictEqual(body.nearest_known_sites.length, 3);
  assert.strictEqual(body.model_accuracy.n, 30);
});

test('GET /predict accepts the same values as a query string', async () => {
  const { status, body } = await get('/predict?solar_index=2&temp_swing=8&max_slope_deg=30&avg_slope_deg=1');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.verdict, 'bad');
});

test('predict rejects input with no usable feature', async () => {
  assert.strictEqual((await post('/predict', {})).status, 400);
  assert.strictEqual((await get('/predict?solar_index=abc')).status, 400);
  assert.strictEqual((await get('/predict?foo=1')).status, 400);
});

test('model endpoint exposes validation numbers', async () => {
  const { body } = await get('/model');
  assert.ok(Math.abs(body.validation.accuracy - 0.7667) < 0.001);
  assert.ok(body.data_warnings.length >= 1);
});

test('unknown site returns 404', async () => {
  assert.strictEqual((await get('/sites/999')).status, 404);
});

test('reload is protected: disabled in production, token-gated when ADMIN_TOKEN is set', async () => {
  const prevEnv = process.env.NODE_ENV;
  const prevTok = process.env.ADMIN_TOKEN;
  try {
    delete process.env.ADMIN_TOKEN;
    process.env.NODE_ENV = 'production';
    assert.strictEqual((await post('/reload', {})).status, 403);

    process.env.ADMIN_TOKEN = 'secret-test-token';
    assert.strictEqual((await post('/reload', {})).status, 401);
    assert.strictEqual((await post('/reload', {}, { 'x-admin-token': 'wrong-token-value' })).status, 401);
    const ok = await post('/reload', {}, { 'x-admin-token': 'secret-test-token' });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.body.model_loaded, true);
  } finally {
    if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;
    if (prevTok === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = prevTok;
  }
});

test('GET /challenge-sites returns the three sites named in the challenge with model scores', async () => {
  const { status, body } = await get('/challenge-sites');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.total, 3);
  assert.deepStrictEqual(body.missing, []);
  const names = body.results.map((r) => r.dataset_name).sort();
  assert.deepStrictEqual(names, ['Atacama', 'Death Valley', 'Haughton Crater']);
  for (const r of body.results) {
    assert.ok(r.p_good > 0 && r.p_good < 1);
    assert.strictEqual(r.label, 1);
    assert.strictEqual(r.nearest_known_sites.length, 3);
    assert.ok(!r.nearest_known_sites.some((n) => n.name === r.dataset_name));
    assert.ok(Number.isFinite(r.lat) && Number.isFinite(r.lon));
  }
  // must agree with /predictions, not carry its own numbers
  const preds = (await get('/predictions')).body.results;
  for (const r of body.results) assert.strictEqual(r.p_good, preds.find((p) => p.name === r.dataset_name).p_good);
});
