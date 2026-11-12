'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadCsv } = require('../src/loader');
const AnalogModel = require('../src/model');
const { buildChallengeSites } = require('../src');

const root = path.join(__dirname, '..');
const { sites } = loadCsv(path.join(root, 'data', 'nasa_sites.csv'));
const model = JSON.parse(fs.readFileSync(path.join(root, 'model', 'analog-model.json'), 'utf8'));
const predictions = AnalogModel.predictSites(model, sites);

test('every challenge site in the config exists in the dataset', () => {
  const out = buildChallengeSites({ model, sites, predictions });
  assert.strictEqual(out.results.length, 3);
  assert.deepStrictEqual(out.missing, []);
});

test('a configured site missing from the dataset is reported, not invented', () => {
  const tmp = path.join(os.tmpdir(), `challenge-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ source: 't', sites: [{ key: 'x', dataset_name: 'Nowhere Crater', display_name: 'Nowhere', lat: 0, lon: 0 }] }));
  const out = buildChallengeSites({ model, sites, predictions, configPath: tmp });
  fs.unlinkSync(tmp);
  assert.strictEqual(out.results.length, 0);
  assert.deepStrictEqual(out.missing, ['Nowhere Crater']);
});
