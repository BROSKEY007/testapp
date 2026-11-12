'use strict';

/**
 * Trains the analog model from the labelled dataset and writes model/analog-model.json.
 *
 *   npm run train
 *   DATA_PATH=data/other.csv npm run train
 *
 * Re-run whenever the dataset or column mapping changes, then restart the server
 * (or POST /api/analog/reload) and re-run `npm run export` for the static files.
 */

const fs = require('fs');
const path = require('path');
const { loadCsv } = require('../src/loader');
const { train, FEATURES } = require('../src/model');

const csvPath = process.env.DATA_PATH || path.join(__dirname, '..', 'data', 'nasa_sites.csv');
const outPath = process.env.MODEL_PATH || path.join(__dirname, '..', 'model', 'analog-model.json');

const { sites, report } = loadCsv(csvPath);
if (!report.mapped.label) {
  console.error('No label column found. Add its name under "label" in config/columns.json.');
  process.exit(1);
}
const missing = FEATURES.filter((f) => !report.mapped[f.key]).map((f) => f.key);
if (missing.length) {
  console.error(`Feature columns not found: ${missing.join(', ')}. Fix config/columns.json.`);
  process.exit(1);
}

const model = train(sites);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(model, null, 2) + '\n');

const v = model.validation;
console.log(`trained on ${model.n} sites (${model.class_counts.good} good, ${model.class_counts.bad} bad) from ${path.basename(csvPath)}`);
for (const f of model.features) console.log(`  ${f.label.padEnd(24)} coef ${f.coef.toFixed(3).padStart(7)}`);
console.log(`leave-one-out accuracy ${(v.accuracy * 100).toFixed(1)} percent (95% interval ${(v.accuracy_ci95[0] * 100).toFixed(0)} to ${(v.accuracy_ci95[1] * 100).toFixed(0)}), AUC ${v.auc}, baseline 50`);
console.log(`confusion: ${JSON.stringify(v.confusion)}`);
for (const w of model.data_warnings) console.log(`WARNING: ${w}`);
console.log(`wrote ${outPath}`);
