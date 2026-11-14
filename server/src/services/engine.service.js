import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// The analog engine is CommonJS and is kept unmodified in server/analog-engine,
// so the ML side can replace that folder without touching this code.
const require = createRequire(import.meta.url);
const engineDir = fileURLToPath(new URL("../../analog-engine/", import.meta.url));
const { createAnalogRouter, loadCsv } = require(engineDir + "src/index.js");
const AnalogModel = require(engineDir + "src/model.js");
const { PROFILES } = require(engineDir + "src/profiles.js");

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
  // The engine's p_good comes from a model fitted on all sites INCLUDING the one being
  // shown, so it flatters every site (30 of 30 look better than when held out). The
  // headline, verdict and rank use the leave-one-out probability instead. The in-sample
  // value stays available as fitPGood. Thresholds match the engine (0.6 and 0.4).
  const verdictOf = (x) => (x >= 0.6 ? "good" : x <= 0.4 ? "bad" : "borderline");
  const verdictHead = { good: "Predicted good analog", bad: "Predicted poor analog", borderline: "Borderline analog" };
  const ranked = AnalogModel.predictSites(model, sites)
    .map((p) => {
      const heldOut = typeof p.loo_p_good === "number";
      return { p, heldOut, headline: heldOut ? p.loo_p_good : p.p_good };
    })
    .sort((a, b) => b.headline - a.headline || String(a.p.name).localeCompare(String(b.p.name)));
  for (const [index, { p, heldOut, headline }] of ranked.entries()) {
    const row = sites.find((s) => s.id === p.id);
    const verdict = verdictOf(headline);
    // Replace the engine's opening sentence (written from the in-sample probability) and
    // keep its feature-push sentences.
    const rest = p.summary.replace(/^[^(]*\([^)]*\)\.\s*/, "");
    const summary =
      `${verdictHead[verdict]} (${Math.round(headline * 100)} percent ${heldOut ? "held-out " : ""}probability of a good analog).` +
      (rest ? " " + rest : "");
    const features = Object.fromEntries(featureKeys.map((k) => [k, row[k]]));
    byName.set(key(p.name), {
      datasetId: String(p.id),
      rank: index + 1,
      of: sites.length,
      label: p.label,
      pGood: headline,
      heldOut,
      fitPGood: p.p_good,
      score: Math.round(headline * 1000) / 10,
      verdict,
      looPGood: p.loo_p_good,
      looCorrect: p.loo_correct,
      summary,
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
    featureKeys,
    profileNames: Object.keys(PROFILES),
    // Same response shape as the engine's /predict. The engine's nearest() uses only the
    // features present in the input, so partial input still returns neighbours.
    predict(input) {
      const result = AnalogModel.predict(model, input);
      return {
        ...result,
        input,
        nearest_known_sites: AnalogModel.nearest(model, sites, input, 3),
        model_accuracy: { method: "leave-one-out", accuracy: v.accuracy, auc: v.auc, n: model.n },
      };
    },
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