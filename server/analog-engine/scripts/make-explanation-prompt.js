'use strict';

/**
 * Builds explanation-prompt.md: paste its contents into Codex (or any chat assistant).
 * Save the JSON reply as data/explanations.json, then run `npm run export` or POST /reload.
 * The API never calls an AI at request time, so the demo cannot hit a rate limit.
 *
 *   npm run prompt
 */

const fs = require('fs');
const path = require('path');
const { loadCsv } = require('../src/loader');
const AnalogModel = require('../src/model');

const root = path.join(__dirname, '..');
const csvPath = process.env.DATA_PATH || path.join(root, 'data', 'nasa_sites.csv');
const modelPath = process.env.MODEL_PATH || path.join(root, 'model', 'analog-model.json');

if (!fs.existsSync(modelPath)) {
  console.error('No trained model found. Run "npm run train" first.');
  process.exit(1);
}
const { sites } = loadCsv(csvPath);
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

const rows = AnalogModel.predictSites(model, sites).map((r) => ({
  id: String(r.id),
  name: r.name,
  actual_label_in_dataset: r.label === 1 ? 'good analog' : 'bad analog',
  model_probability_good: r.p_good,
  model_agreed_when_held_out: r.loo_correct,
  features: r.contributions.map((c) => ({
    feature: c.label,
    value: c.value,
    vs_dataset_average: c.z >= 0 ? 'above' : 'below',
    effect_on_prediction: c.contribution >= 0 ? 'toward good' : 'toward poor'
  }))
}));

const prompt = `# Task

Write a short explanation (2 to 3 sentences, plain language, for judges of a NASA Space Apps challenge) for each Earth site below, saying why it is or is not a good analog for Moon and Mars base design and astronaut training, according to the model and the dataset label.

# Rules

- Use ONLY the numbers and labels given. Do not invent measurements, history or facts about the real place.
- Where actual_label_in_dataset and the model disagree, say so plainly and say the model is uncertain about that site.
- Do not claim Earth matches lunar or Martian radiation, pressure or gravity.
- No em dashes. No Oxford comma.
- Output ONLY valid JSON in exactly this shape, nothing else:

{ "analog": { "<id>": "<explanation>" } }

# Data

\`\`\`json
${JSON.stringify(rows, null, 2)}
\`\`\`
`;

const out = path.join(process.cwd(), 'explanation-prompt.md');
fs.writeFileSync(out, prompt);
console.log(`wrote ${out} (${rows.length} sites)`);
