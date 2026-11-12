'use strict';

/**
 * Precomputes everything into plain files so the demo runs with NO server.
 * Host the output folder on GitHub Pages, Vercel or Netlify (all free).
 *
 *   npm run train && npm run export
 *
 * dist-static/
 *   index.html          ready-made demo page (ranked sites + live prediction form)
 *   analog-model.js     the same model code as the API, for use in a browser
 *   model.json          coefficients, validation numbers, data warnings
 *   predictions.json    every known site ranked by predicted probability of "good"
 *   challenge-sites.json  Atacama, Haughton Crater and Death Valley (named in the challenge) with scores
 *   sites.json          raw sites
 *   data-report.json    which columns were mapped
 *   rank-*.json         Moon and Mars profile rankings, only when the dataset supports them
 *
 * In a browser, a new site can be scored without a server:
 *   const model = await (await fetch('model.json')).json();
 *   AnalogModel.predict(model, { solar_index: 5, temp_swing: 20, max_slope_deg: 60, avg_slope_deg: 3 });
 */

const fs = require('fs');
const path = require('path');
const { loadCsv } = require('../src/loader');
const { rankSites, scoreSite } = require('../src/scoring');
const { PROFILES, ATTRIBUTE_META } = require('../src/profiles');
const { loadExplanations, attachExplanation } = require('../src/explanations');
const AnalogModel = require('../src/model');
const { buildChallengeSites } = require('../src/challenge');

const root = path.join(__dirname, '..');
const csvPath = process.env.DATA_PATH || path.join(root, 'data', 'nasa_sites.csv');
const modelPath = process.env.MODEL_PATH || path.join(root, 'model', 'analog-model.json');
const outDir = path.join(root, 'dist-static');
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(modelPath)) {
  console.error('No trained model found. Run "npm run train" first.');
  process.exit(1);
}

const { sites, report } = loadCsv(csvPath);
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
const explanations = loadExplanations();
const write = (name, data) => fs.writeFileSync(path.join(outDir, name), JSON.stringify(data));

write('sites.json', sites);
write('data-report.json', report);
write('model.json', model);
write('predictions.json', {
  total: sites.length,
  results: AnalogModel.predictSites(model, sites).map((r) => attachExplanation(r, explanations))
});
const predictions = AnalogModel.predictSites(model, sites).map((r) => attachExplanation(r, explanations));
write('challenge-sites.json', buildChallengeSites({ model, sites, predictions }));
write('profiles.json', { profiles: PROFILES, attributes: ATTRIBUTE_META });

fs.copyFileSync(path.join(root, 'src', 'model.js'), path.join(outDir, 'analog-model.js'));
fs.copyFileSync(path.join(root, 'public', 'demo.html'), path.join(outDir, 'index.html'));

// Moon and Mars profile rankings only make sense if the dataset has the attributes they need.
let profileFiles = 0;
for (const target of Object.keys(PROFILES)) {
  for (const purpose of ['base', 'training']) {
    const ranked = rankSites(sites, target, { limit: sites.length, purpose, minCoverage: 0.5 });
    if (ranked.eligible === 0) continue;
    ranked.results = ranked.results.map((r) => attachExplanation(r, explanations));
    write(`rank-${target}-${purpose}.json`, ranked);
    profileFiles++;
  }
}
if (profileFiles) {
  write('compare.json', sites.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, moon: scoreSite(s, 'moon').score, mars: scoreSite(s, 'mars').score })));
}

console.log(`exported ${sites.length} sites, model and demo page to ${outDir}${profileFiles ? '' : ' (no Moon or Mars profile files: dataset lacks those attributes)'}`);
