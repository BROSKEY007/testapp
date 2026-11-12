'use strict';

const express = require('express');
const path = require('path');
const { loadCsv } = require('./loader');
const { PROFILES, ATTRIBUTE_META } = require('./profiles');
const { scoreSite, rankSites } = require('./scoring');
const { loadExplanations, attachExplanation } = require('./explanations');
const AnalogModel = require('./model');
const { buildChallengeSites } = require('./challenge');
const fs = require('fs');
const crypto = require('crypto');

const VALID_PURPOSES = ['base', 'training'];

function clampInt(v, def, min, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/**
 * Express router factory. Mount it in the teammate's app:
 *
 *   const { createAnalogRouter } = require('./analog-engine');
 *   app.use('/api/analog', createAnalogRouter({ dataPath: 'data/sites.csv' }));
 */
function createAnalogRouter({ dataPath, mappingPath, modelPath: modelPathOpt } = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  const csvPath = dataPath || process.env.DATA_PATH || path.join(__dirname, '..', 'data', 'nasa_sites.csv');
  const mapPath = mappingPath || process.env.COLUMNS_PATH || undefined;
  const modelPath = modelPathOpt || process.env.MODEL_PATH || path.join(__dirname, '..', 'model', 'analog-model.json');

  function loadModel() {
    try {
      return JSON.parse(fs.readFileSync(modelPath, 'utf8'));
    } catch {
      return null; // run `npm run train` to create it
    }
  }

  let state = { sites: [], report: null, loadedAt: null, explanations: {}, model: null, predictions: [] };
  function reload() {
    const { sites, report } = loadCsv(csvPath, mapPath);
    const model = loadModel();
    const explanations = loadExplanations();
    const predictions = model ? AnalogModel.predictSites(model, sites).map((r) => attachExplanation(r, explanations)) : [];
    state = { sites, report, loadedAt: new Date().toISOString(), explanations, model, predictions };
    return state;
  }
  reload();

  function requireModel(res) {
    if (!state.model) {
      res.status(503).json({ error: 'model not trained yet. Run "npm run train" and then POST /reload' });
      return null;
    }
    return state.model;
  }

  const byId = () => new Map(state.sites.map((s) => [String(s.id), s]));

  function parseTarget(q, res) {
    const target = String(q || '').toLowerCase();
    if (!PROFILES[target]) {
      res.status(400).json({ error: `target must be one of: ${Object.keys(PROFILES).join(', ')}` });
      return null;
    }
    return target;
  }
  function parsePurpose(q, res) {
    const purpose = String(q || 'base').toLowerCase();
    if (!VALID_PURPOSES.includes(purpose)) {
      res.status(400).json({ error: `purpose must be one of: ${VALID_PURPOSES.join(', ')}` });
      return null;
    }
    return purpose;
  }

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      sites_loaded: state.sites.length,
      model_loaded: !!state.model,
      loaded_at: state.loadedAt,
      data_source: path.basename(csvPath)
    });
  });

  // ---- Learned model (primary): good or bad analog, trained on the labelled dataset ----

  // GET /model -> coefficients, validation numbers and data warnings (show this to the judges)
  router.get('/model', (_req, res) => {
    const model = requireModel(res);
    if (model) res.json(model);
  });

  // GET /predictions?limit=30&label=1 -> every known site ranked by predicted probability of "good"
  router.get('/predictions', (req, res) => {
    if (!requireModel(res)) return;
    const limit = clampInt(req.query.limit, 200, 1, 500);
    let rows = state.predictions;
    if (req.query.label === '0' || req.query.label === '1') rows = rows.filter((r) => String(r.label) === req.query.label);
    res.json({ total: rows.length, results: rows.slice(0, limit) });
  });

  // GET /challenge-sites -> the three sites named in the challenge text, with model scores and nearest known sites
  router.get('/challenge-sites', (_req, res) => {
    const model = requireModel(res);
    if (!model) return;
    res.json(buildChallengeSites({ model, sites: state.sites, predictions: state.predictions }));
  });

  // GET or POST /predict with solar_index, temp_swing, max_slope_deg, avg_slope_deg
  function handlePredict(input, res) {
    const model = requireModel(res);
    if (!model) return;
    const provided = model.features.filter((f) => input[f.key] !== undefined && input[f.key] !== '' && Number.isFinite(Number(input[f.key])));
    if (provided.length === 0) {
      return res.status(400).json({ error: `provide at least one of: ${model.features.map((f) => f.key).join(', ')}` });
    }
    const result = AnalogModel.predict(model, input);
    res.json({
      ...result,
      input,
      nearest_known_sites: AnalogModel.nearest(model, state.sites, input, 3),
      model_accuracy: { method: 'leave-one-out', accuracy: model.validation.accuracy, auc: model.validation.auc, n: model.n }
    });
  }
  router.get('/predict', (req, res) => handlePredict(req.query, res));
  router.post('/predict', (req, res) => handlePredict(req.body || {}, res));

  router.get('/profiles', (_req, res) => {
    res.json({ profiles: PROFILES, attributes: ATTRIBUTE_META });
  });

  router.get('/data-report', (_req, res) => res.json(state.report));

  router.get('/sites', (req, res) => {
    const limit = clampInt(req.query.limit, 50, 1, 500);
    const offset = clampInt(req.query.offset, 0, 0, 1e9);
    res.json({ total: state.sites.length, limit, offset, sites: state.sites.slice(offset, offset + limit) });
  });

  // GET /rank?target=mars&purpose=training&limit=10&minCoverage=0.5&breakdown=false
  router.get('/rank', (req, res) => {
    const target = parseTarget(req.query.target, res);
    if (!target) return;
    const purpose = parsePurpose(req.query.purpose, res);
    if (!purpose) return;
    const limit = clampInt(req.query.limit, 10, 1, 200);
    const minCoverage = Math.min(1, Math.max(0, Number(req.query.minCoverage ?? 0.5)));
    const includeBreakdown = req.query.breakdown !== 'false';
    const ranked = rankSites(state.sites, target, { limit, minCoverage, purpose, includeBreakdown });
    ranked.results = ranked.results.map((r) => attachExplanation(r, state.explanations));
    if (ranked.eligible === 0) {
      ranked.note = 'The loaded dataset lacks the attributes the Moon and Mars profiles need. Use GET /predictions and POST /predict, which use the model trained on your labelled data.';
    }
    res.json(ranked);
  });

  // GET /compare?id=12 -> same site scored against Moon and Mars
  router.get('/compare', (req, res) => {
    const site = byId().get(String(req.query.id));
    if (!site) return res.status(404).json({ error: 'site not found' });
    const purpose = parsePurpose(req.query.purpose, res);
    if (!purpose) return;
    res.json({
      site,
      moon: attachExplanation(scoreSite(site, 'moon', { purpose }), state.explanations),
      mars: attachExplanation(scoreSite(site, 'mars', { purpose }), state.explanations)
    });
  });

  router.get('/sites/:id', (req, res) => {
    const site = byId().get(String(req.params.id));
    if (!site) return res.status(404).json({ error: 'site not found' });
    res.json(site);
  });

  // POST /score  { "target": "moon", "purpose": "base", "site": {...} }  or  { "sites": [...] }
  router.post('/score', (req, res) => {
    const body = req.body || {};
    const target = parseTarget(body.target, res);
    if (!target) return;
    const purpose = parsePurpose(body.purpose, res);
    if (!purpose) return;
    const list = Array.isArray(body.sites) ? body.sites : body.site ? [body.site] : null;
    if (!list || list.length === 0) return res.status(400).json({ error: 'provide "site" (object) or "sites" (array)' });
    if (list.length > 1000) return res.status(413).json({ error: 'max 1000 sites per request' });
    const results = list.map((s) => scoreSite(s, target, { purpose }));
    res.json(body.site ? results[0] : { target, purpose, results });
  });

  // Reload is an admin action. With ADMIN_TOKEN set it needs the header x-admin-token.
  // In production without ADMIN_TOKEN it is disabled, so an open API cannot be poked to reread files.
  function requireAdmin(req, res, next) {
    const token = process.env.ADMIN_TOKEN;
    if (token) {
      const given = Buffer.from(String(req.get('x-admin-token') || ''));
      const want = Buffer.from(token);
      if (given.length === want.length && crypto.timingSafeEqual(given, want)) return next();
      return res.status(401).json({ error: 'missing or wrong x-admin-token header' });
    }
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'reload is disabled in production unless ADMIN_TOKEN is set' });
    }
    next();
  }

  router.post('/reload', requireAdmin, (_req, res) => {
    try {
      const s = reload();
      res.json({ status: 'reloaded', sites_loaded: s.sites.length, model_loaded: !!s.model, loaded_at: s.loadedAt });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = { createAnalogRouter };
