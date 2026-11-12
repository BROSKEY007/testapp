'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Optional AI-written explanations, generated ahead of time (for example with Codex on
 * your laptop) and saved as data/explanations.json:
 *
 *   { "mars": { "8": "text...", "12": "text..." }, "moon": { "8": "text..." } }
 *
 * The API never calls an AI. It only reads this file, so the demo cannot hit a rate
 * limit. Missing file or missing ids are fine: results just omit ai_explanation.
 */
function loadExplanations(filePath) {
  const p = filePath || process.env.EXPLANATIONS_PATH || path.join(__dirname, '..', 'data', 'explanations.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function attachExplanation(result, explanations) {
  const text = explanations?.[result.target]?.[String(result.id)];
  return text ? { ...result, ai_explanation: text } : result;
}

module.exports = { loadExplanations, attachExplanation };
