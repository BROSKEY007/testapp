'use strict';

const { PROFILES, ATTRIBUTE_META, READINESS } = require('./profiles');

// Floor on per-attribute similarity so one extreme miss gives a very low score, not exactly zero.
const SIM_FLOOR = 0.02;

/**
 * Similarity of one value to one target band, in [0, 1].
 * Inside the band: 1. Outside: Gaussian falloff by distance to the nearest bound.
 */
function attributeSimilarity(value, spec) {
  const [lo, hi] = spec.range;
  if (value >= lo && value <= hi) return 1;
  const d = value < lo ? lo - value : value - hi;
  return Math.exp(-0.5 * (d / spec.softness) ** 2);
}

function isNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Score one site against one target profile.
 *
 * Missing attributes are skipped and the remaining weights are renormalized.
 * `coverage` reports the share of total profile weight actually measured, so the
 * caller can discard or flag sites scored on thin data.
 *
 * purpose: 'base' (pure analog similarity) or 'training' (blends in accessibility
 * when infra_distance_km is available).
 */
function scoreSite(site, target, options = {}) {
  const profile = PROFILES[target];
  if (!profile) throw new Error(`Unknown target "${target}". Use one of: ${Object.keys(PROFILES).join(', ')}`);
  const purpose = options.purpose || 'base';

  // Weighted geometric mean: score = 100 * exp( sum(w * ln(sim)) / sum(w) ).
  // Unlike an arithmetic mean, failing a heavily weighted attribute (no rain, no
  // vegetation) cannot be hidden by many easy attributes that happen to be in range.
  let logSum = 0;
  let usedWeight = 0;
  let totalWeight = 0;
  const breakdown = [];

  for (const [attr, spec] of Object.entries(profile.attributes)) {
    totalWeight += spec.weight;
    const value = site[attr];
    if (!isNumber(value)) {
      breakdown.push({ attribute: attr, label: ATTRIBUTE_META[attr].label, unit: ATTRIBUTE_META[attr].unit, value: null, similarity: null, weight: spec.weight, status: 'missing' });
      continue;
    }
    const sim = attributeSimilarity(value, spec);
    const penalty = -spec.weight * Math.log(Math.max(sim, SIM_FLOOR));
    logSum += penalty;
    usedWeight += spec.weight;
    breakdown.push({
      attribute: attr,
      label: ATTRIBUTE_META[attr].label,
      unit: ATTRIBUTE_META[attr].unit,
      value,
      target_range: spec.range,
      similarity: round(sim, 3),
      weight: spec.weight,
      points_lost: null, // filled below once the total loss is known
      _penalty: penalty,
      status: sim >= 0.999 ? 'in_range' : sim >= 0.5 ? 'near' : 'off'
    });
  }

  const analog = usedWeight > 0 ? Math.exp(-logSum / usedWeight) * 100 : 0;
  // Distribute the points lost (100 - score) across attributes in proportion to their penalty.
  const totalLoss = 100 - analog;
  for (const b of breakdown) {
    if (b._penalty !== undefined) {
      b.points_lost = logSum > 0 ? round((b._penalty / logSum) * totalLoss, 2) : 0;
      delete b._penalty;
    }
  }

  let score = analog;
  let readiness = null;
  if (purpose === 'training' && isNumber(site[READINESS.attribute])) {
    readiness = Math.exp(-site[READINESS.attribute] / READINESS.scale_km);
    score = (1 - READINESS.training_blend) * analog + READINESS.training_blend * readiness * 100;
  }

  const coverage = totalWeight > 0 ? usedWeight / totalWeight : 0;
  const ranked = breakdown.filter((b) => b.similarity !== null).sort((a, b) => b.similarity - a.similarity);

  const strengths = ranked.filter((b) => b.similarity >= 0.9).slice(0, 3).map((b) => b.label);
  const weaknesses = ranked.filter((b) => b.similarity < 0.5).map((b) => b.label);
  const confidence = coverage >= 0.8 ? 'high' : coverage >= 0.5 ? 'medium' : 'low';

  return {
    id: site.id ?? null,
    name: site.name ?? null,
    lat: site.lat ?? null,
    lon: site.lon ?? null,
    target,
    purpose,
    score: round(score, 2),
    analog_score: round(analog, 2),
    readiness: readiness === null ? null : round(readiness, 3),
    coverage: round(coverage, 3),
    confidence,
    summary: buildSummary({ label: profile.label, score, confidence, coverage, strengths, breakdown }),
    strengths,
    weaknesses,
    breakdown
  };
}

/** "A", "A and B", "A, B and C" (no Oxford comma). */
function joinList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Deterministic one-paragraph explanation built only from the numbers above.
 * Free, instant and always consistent with the score. No AI involved.
 */
function buildSummary({ label, score, confidence, coverage, strengths, breakdown }) {
  const tier = score >= 85 ? 'Strong' : score >= 65 ? 'Moderate' : score >= 40 ? 'Weak' : 'Poor';
  let text = `${tier} ${label} analog (score ${round(score, 1)}, ${confidence} confidence).`;
  if (strengths.length) text += ` Matches well on ${joinList(strengths.map((s) => s.toLowerCase()))}.`;
  const gaps = breakdown
    .filter((b) => b.points_lost !== null && b.points_lost !== undefined && b.points_lost >= 1)
    .sort((a, b) => b.points_lost - a.points_lost)
    .slice(0, 2)
    .map((b) => `${b.label.toLowerCase()} (${round(b.points_lost, 1)} points lost)`);
  if (gaps.length) text += ` Main gaps: ${joinList(gaps)}.`;
  if (confidence !== 'high') text += ` Only ${Math.round(coverage * 100)} percent of the profile was measured.`;
  return text;
}

/**
 * Rank many sites. Returns best first. Sites below minCoverage are dropped so a
 * single well-matching attribute cannot push a barely-measured site to the top.
 */
function rankSites(sites, target, options = {}) {
  const { limit = 10, minCoverage = 0.5, purpose = 'base', includeBreakdown = true } = options;
  const scored = sites
    .map((s) => scoreSite(s, target, { purpose }))
    .filter((r) => r.coverage >= minCoverage)
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage);
  const top = scored.slice(0, limit).map((r, i) => {
    const out = { rank: i + 1, ...r };
    if (!includeBreakdown) delete out.breakdown;
    return out;
  });
  return { target, purpose, evaluated: sites.length, eligible: scored.length, results: top };
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

module.exports = { attributeSimilarity, scoreSite, rankSites };
