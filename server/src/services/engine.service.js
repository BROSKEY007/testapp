import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// The analog engine is CommonJS and is kept unmodified in server/analog-engine,
// so the ML side can replace that folder without touching this code.
const require = createRequire(import.meta.url);
const engineDir = fileURLToPath(new URL("../../analog-engine/", import.meta.url));
const { createAnalogRouter, loadCsv } = require(engineDir + "src/index.js");
const AnalogModel = require(engineDir + "src/model.js");

const key = (name) => String(name).trim().toLowerCase();

export function createEngine({
  dataPath = process.env.DATA_PATH || engineDir + "data/nasa_sites.csv",
  modelPath = process.env.MODEL_PATH || engineDir + "model/analog-model.json",
} = {}) {
  // Both files are read at start-up. A missing file stops the server on purpose.
  const { sites } = loadCsv(dataPath);
  const model = JSON.parse(readFileSync(modelPath, "utf8"));
  const featureKeys = model.features.map((f) => f.key);
  const byName = new Map();
  for (const p of AnalogModel.predictSites(model, sites)) {
    const row = sites.find((s) => s.id === p.id);
    const features = Object.fromEntries(featureKeys.map((k) => [k, row[k]]));
    byName.set(key(p.name), {
      datasetId: String(p.id),
      rank: p.rank,
      of: sites.length,
      label: p.label,
      pGood: p.p_good,
      score: p.score,
      verdict: p.verdict,
      looPGood: p.loo_p_good,
      looCorrect: p.loo_correct,
      summary: p.summary,
      features,
      contributions: p.contributions.map((c) => ({
        feature: c.feature,
        label: c.label,
        value: c.value,
        contribution: c.contribution,
      })),
      // Most similar other sites by the four features (the site itself is excluded).
      nearest: AnalogModel.nearest(
        model,
        sites.filter((s) => s.id !== row.id),
        features,
        3,
      ).map((n) => ({ name: n.name, label: n.label, distance: n.distance })),
    });
  }
  const v = model.validation;
  return {
    router: () => createAnalogRouter({ dataPath, modelPath }),
    siteCount: sites.length,
    predictionFor: (datasetName) => byName.get(key(datasetName)) ?? null,
    // What the UI needs for its accuracy statement and limitations.
    modelInfo: {
      kind: "Logistic regression on 4 standardised features, ridge penalty",
      n: model.n,
      classCounts: model.class_counts,
      features: model.features.map((f) => ({ key: f.key, label: f.label, coef: f.coef })),
      validation: {
        method: v.method,
        accuracy: v.accuracy,
        accuracyCi95: v.accuracy_ci95,
        auc: v.auc,
        baselineAccuracy: v.baseline_accuracy,
        confusion: v.confusion,
      },
      dataWarnings: model.data_warnings,
      trainedAt: model.trained_at ?? null,
    },
  };
}
