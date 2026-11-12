'use strict';

/**
 * Learned analog-site model: L2-regularised logistic regression on standardised features,
 * with leave-one-out validation. Plain JavaScript with no dependencies, so the same file
 * runs in Node (API, training) and in the browser (static demo via dist-static/analog-model.js).
 *
 * Why this model: the dataset has about 30 labelled sites and 4 usable numbers. A model with
 * 5 parameters and a ridge penalty is about as much as that data can support. Anything more
 * flexible would memorise the sites.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AnalogModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const FEATURES = [
    { key: 'solar_index', label: 'Avg solar index' },
    { key: 'temp_swing', label: 'Max temperature swing' },
    { key: 'max_slope_deg', label: 'Max slope' },
    { key: 'avg_slope_deg', label: 'Avg slope angle' }
  ];

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

  /** Solve A x = b by Gaussian elimination with partial pivoting. */
  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }

  /**
   * Fit on rows X (array of numeric arrays) and 0/1 labels y.
   * Minimises 0.5 * lambda * |w|^2 + sum(log-loss), lambda = 1 / C, intercept unpenalised.
   * This is the same objective as scikit-learn LogisticRegression(C=C), solved with Newton steps.
   */
  function fit(X, y, C = 1) {
    const n = X.length;
    const d = X[0].length;
    const lambda = 1 / C;
    const mean = new Array(d).fill(0);
    const sd = new Array(d).fill(0);
    for (let j = 0; j < d; j++) {
      mean[j] = X.reduce((s, r) => s + r[j], 0) / n;
      sd[j] = Math.sqrt(X.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / n) || 1;
    }
    const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / sd[j]));
    const w = new Array(d).fill(0);
    let b = 0;
    for (let iter = 0; iter < 100; iter++) {
      const g = new Array(d + 1).fill(0);
      const H = Array.from({ length: d + 1 }, () => new Array(d + 1).fill(0));
      for (let i = 0; i < n; i++) {
        const xa = [1, ...Z[i]];
        let eta = b;
        for (let j = 0; j < d; j++) eta += w[j] * Z[i][j];
        const p = sigmoid(eta);
        const s = p * (1 - p);
        for (let a = 0; a <= d; a++) {
          g[a] += (p - y[i]) * xa[a];
          for (let c = 0; c <= d; c++) H[a][c] += s * xa[a] * xa[c];
        }
      }
      for (let j = 0; j < d; j++) {
        g[j + 1] += lambda * w[j];
        H[j + 1][j + 1] += lambda;
      }
      H[0][0] += 1e-9;
      const step = solve(H, g);
      b -= step[0];
      for (let j = 0; j < d; j++) w[j] -= step[j + 1];
      if (Math.max(...step.map(Math.abs)) < 1e-11) break;
    }
    return { mean, sd, coef: w, intercept: b };
  }

  /** Area under the ROC curve (probability a random good site outscores a random bad one). */
  function auc(y, scores) {
    let wins = 0;
    let pairs = 0;
    for (let i = 0; i < y.length; i++) {
      if (y[i] !== 1) continue;
      for (let j = 0; j < y.length; j++) {
        if (y[j] !== 0) continue;
        pairs++;
        wins += scores[i] > scores[j] ? 1 : scores[i] === scores[j] ? 0.5 : 0;
      }
    }
    return pairs ? wins / pairs : null;
  }

  /** Leave-one-out: refit (including the standardiser) without each site, then predict it. */
  function leaveOneOut(X, y, C = 1) {
    const probs = [];
    for (let i = 0; i < X.length; i++) {
      const Xtr = X.filter((_, k) => k !== i);
      const ytr = y.filter((_, k) => k !== i);
      const m = fit(Xtr, ytr, C);
      let eta = m.intercept;
      for (let j = 0; j < X[i].length; j++) eta += m.coef[j] * ((X[i][j] - m.mean[j]) / m.sd[j]);
      probs.push(sigmoid(eta));
    }
    return probs;
  }

  /** Percentile bootstrap interval for accuracy, with a seeded generator so results repeat. */
  function bootstrapAccuracyCI(correct, B = 5000, seed = 1) {
    let s = seed;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const n = correct.length;
    const accs = [];
    for (let b = 0; b < B; b++) {
      let k = 0;
      for (let i = 0; i < n; i++) k += correct[Math.floor(rnd() * n)];
      accs.push(k / n);
    }
    accs.sort((a, c) => a - c);
    return [accs[Math.floor(0.025 * B)], accs[Math.floor(0.975 * B)]];
  }

  /** Train on site objects that carry the feature keys and a 0/1 `label`. */
  function train(sites, { features = FEATURES, C = 1 } = {}) {
    const keys = features.map((f) => f.key);
    const usable = sites.filter((s) => (s.label === 0 || s.label === 1) && keys.every((k) => isNum(s[k])));
    const dropped = sites.length - usable.length;
    const X = usable.map((s) => keys.map((k) => s[k]));
    const y = usable.map((s) => s.label);

    const m = fit(X, y, C);
    const loo = leaveOneOut(X, y, C);
    const correct = loo.map((p, i) => ((p > 0.5 ? 1 : 0) === y[i] ? 1 : 0));
    const acc = correct.reduce((a, b) => a + b, 0) / correct.length;
    const tp = loo.filter((p, i) => p > 0.5 && y[i] === 1).length;
    const fp = loo.filter((p, i) => p > 0.5 && y[i] === 0).length;
    const tn = loo.filter((p, i) => p <= 0.5 && y[i] === 0).length;
    const fn = loo.filter((p, i) => p <= 0.5 && y[i] === 1).length;

    const warnings = [];
    if (dropped) warnings.push(`${dropped} row(s) dropped for missing label or feature values`);
    const seen = new Map();
    for (const s of usable) {
      const sig = keys.slice(0, 2).map((k) => s[k]).join('|');
      if (seen.has(sig)) warnings.push(`"${seen.get(sig)}" and "${s.name}" have identical values for ${keys.slice(0, 2).join(' and ')}, which may be a copy error in the source data`);
      else seen.set(sig, s.name);
    }
    if (usable.length < 50) warnings.push(`Only ${usable.length} labelled sites, so accuracy estimates carry wide uncertainty`);

    return {
      version: 1,
      trained_at: new Date().toISOString(),
      n: usable.length,
      class_counts: { good: y.filter((v) => v === 1).length, bad: y.filter((v) => v === 0).length },
      C,
      intercept: m.intercept,
      features: features.map((f, j) => ({ key: f.key, label: f.label, mean: m.mean[j], sd: m.sd[j], coef: m.coef[j] })),
      validation: {
        method: 'leave-one-out (standardiser refit inside every fold)',
        accuracy: round(acc, 4),
        auc: round(auc(y, loo), 4),
        accuracy_ci95: bootstrapAccuracyCI(correct).map((v) => round(v, 3)),
        baseline_accuracy: 0.5,
        confusion: { true_good: tp, false_good: fp, true_bad: tn, missed_good: fn },
        per_site: usable.map((s, i) => ({ id: String(s.id), name: s.name, label: y[i], loo_p_good: round(loo[i], 4), correct: !!correct[i] }))
      },
      data_warnings: warnings
    };
  }

  /** Score one input object. Missing features are replaced by the training mean and reported. */
  function predict(model, input) {
    const contributions = [];
    const imputed = [];
    let logit = model.intercept;
    for (const f of model.features) {
      let v = input[f.key];
      if (typeof v === 'string' && v.trim() !== '') v = Number(v);
      if (!isNum(v)) {
        imputed.push(f.key);
        v = f.mean;
      }
      const z = (v - f.mean) / f.sd;
      const contribution = f.coef * z;
      logit += contribution;
      contributions.push({ feature: f.key, label: f.label, value: v, z: round(z, 3), contribution: round(contribution, 3), imputed: !isNum(input[f.key]) && !(typeof input[f.key] === 'string' && input[f.key].trim() !== '' && isNum(Number(input[f.key]))) });
    }
    const p = sigmoid(logit);
    const verdict = p >= 0.6 ? 'good' : p <= 0.4 ? 'bad' : 'borderline';
    return {
      p_good: round(p, 4),
      score: round(p * 100, 1),
      predicted_label: p > 0.5 ? 1 : 0,
      verdict,
      confidence: imputed.length ? 'reduced' : Math.abs(p - 0.5) >= 0.25 ? 'higher' : 'low',
      imputed,
      contributions,
      summary: describe(p, verdict, contributions, imputed)
    };
  }

  /** "A", "A and B", "A, B and C" (no Oxford comma). */
  function joinList(items) {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  }

  function describe(p, verdict, contributions, imputed) {
    const head = verdict === 'good' ? 'Predicted good analog' : verdict === 'bad' ? 'Predicted poor analog' : 'Borderline analog';
    let text = `${head} (${round(p * 100, 0)} percent probability of a good analog).`;
    const phrase = (c) => `${c.z >= 0 ? 'above' : 'below'}-average ${c.label.toLowerCase()}`;
    const up = contributions.filter((c) => c.contribution >= 0.3).sort((a, b) => b.contribution - a.contribution).slice(0, 2);
    const down = contributions.filter((c) => c.contribution <= -0.3).sort((a, b) => a.contribution - b.contribution).slice(0, 2);
    if (up.length) text += ` Pushes toward good: ${joinList(up.map(phrase))}.`;
    if (down.length) text += ` Pushes toward poor: ${joinList(down.map(phrase))}.`;
    if (imputed.length) text += ` Missing ${joinList(imputed)}, so the training average was used.`;
    return text;
  }

  /** Predict every known site, add its leave-one-out probability and rank best first. */
  function predictSites(model, sites) {
    const loo = new Map((model.validation?.per_site || []).map((r) => [r.id, r]));
    return sites
      .map((s) => {
        const r = predict(model, s);
        const v = loo.get(String(s.id));
        return {
          id: s.id ?? null,
          name: s.name ?? null,
          lat: s.lat ?? null,
          lon: s.lon ?? null,
          target: 'analog',
          label: s.label ?? null,
          ...r,
          loo_p_good: v ? v.loo_p_good : null,
          loo_correct: v ? v.correct : null
        };
      })
      .sort((a, b) => b.p_good - a.p_good)
      .map((r, i) => ({ rank: i + 1, ...r }));
  }

  /** k nearest known sites in standardised feature space. */
  function nearest(model, sites, input, k = 3) {
    const rows = [];
    for (const s of sites) {
      let d2 = 0;
      let ok = true;
      for (const f of model.features) {
        const a = Number(input[f.key]);
        const b = s[f.key];
        if (!isNum(a) || !isNum(b)) {
          ok = false;
          break;
        }
        d2 += ((a - b) / f.sd) ** 2;
      }
      if (ok) rows.push({ id: s.id, name: s.name, label: s.label ?? null, distance: round(Math.sqrt(d2), 3) });
    }
    return rows.sort((a, b) => a.distance - b.distance).slice(0, k);
  }

  return { FEATURES, fit, train, predict, predictSites, nearest, leaveOneOut, auc, bootstrapAccuracyCI };
});
