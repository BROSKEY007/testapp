'use strict';

const fs = require('fs');
const path = require('path');
const AnalogModel = require('./model');

const DEFAULT_PATH = path.join(__dirname, '..', 'config', 'challenge-sites.json');

/**
 * Join the challenge-named reference sites with the trained model's predictions.
 * Every number comes from the dataset and model. The config only supplies names,
 * map coordinates and short terrain notes. A configured site that is missing from
 * the dataset is reported in `missing` and is never given invented values.
 */
function buildChallengeSites({ model, sites, predictions, configPath = DEFAULT_PATH }) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const byName = new Map(predictions.map((p) => [String(p.name).trim().toLowerCase(), p]));
  const siteByName = new Map(sites.map((s) => [String(s.name).trim().toLowerCase(), s]));
  const results = [];
  const missing = [];

  for (const c of config.sites) {
    const key = c.dataset_name.trim().toLowerCase();
    const p = byName.get(key);
    const s = siteByName.get(key);
    if (!p || !s) {
      missing.push(c.dataset_name);
      continue;
    }
    const input = Object.fromEntries(model.features.map((f) => [f.key, s[f.key]]));
    const nearest = AnalogModel.nearest(model, sites.filter((x) => x.id !== s.id), input, 3);
    results.push({
      key: c.key,
      display_name: c.display_name,
      dataset_name: c.dataset_name,
      region: c.region,
      lat: c.lat,
      lon: c.lon,
      terrain: c.terrain,
      analog_for: c.analog_for,
      note: c.note,
      rank: p.rank,
      of: predictions.length,
      label: p.label,
      p_good: p.p_good,
      score: p.score,
      verdict: p.verdict,
      loo_p_good: p.loo_p_good,
      loo_correct: p.loo_correct,
      summary: p.summary,
      features: input,
      nearest_known_sites: nearest
    });
  }
  return { source: config.source, total: results.length, missing, results };
}

module.exports = { buildChallengeSites };
