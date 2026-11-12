'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const DEFAULT_MAPPING = path.join(__dirname, '..', 'config', 'columns.json');

function normalizeSpec(spec) {
  if (Array.isArray(spec)) return { columns: spec, scale: 1, offset: 0 };
  const columns = Array.isArray(spec.columns) ? spec.columns : [spec.column];
  return { columns, scale: spec.scale ?? 1, offset: spec.offset ?? 0 };
}

/** Lower-case and collapse runs of whitespace so "Avg  Slope Angle" matches "avg slope angle". */
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

function findColumn(headerMap, candidates) {
  for (const c of candidates) {
    const hit = headerMap.get(norm(c));
    if (hit) return hit;
  }
  return null;
}

/** Accepts 1/0, true/false, yes/no, good/bad. Returns 1, 0 or null. */
function toLabel(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'good'].includes(s)) return 1;
  if (['0', 'false', 'no', 'bad'].includes(s)) return 0;
  return null;
}

function toNumber(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === '' || /^(na|n\/a|nan|null|none|-)$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Load a CSV into canonical site objects using the column mapping.
 * Returns { sites, report } where report lists mapped and missing columns so a
 * wrong mapping is visible immediately instead of silently scoring everything 0.
 */
function loadCsv(csvPath, mappingPath = DEFAULT_MAPPING) {
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  if (rows.length === 0) return { sites: [], report: { rows: 0, mapped: {}, unmapped: Object.keys(mapping.attributes) } };

  const headerMap = new Map(Object.keys(rows[0]).map((h) => [norm(h), h]));

  const resolved = {};
  const mapped = {};
  const unmapped = [];
  for (const [attr, rawSpec] of Object.entries(mapping.attributes)) {
    const spec = normalizeSpec(rawSpec);
    const col = findColumn(headerMap, spec.columns);
    if (col) {
      resolved[attr] = { col, scale: spec.scale, offset: spec.offset };
      mapped[attr] = col;
    } else {
      unmapped.push(attr);
    }
  }
  const identity = {};
  for (const [key, cands] of Object.entries(mapping.identity || {})) {
    identity[key] = findColumn(headerMap, cands);
  }

  const labelCol = mapping.label ? findColumn(headerMap, mapping.label) : null;
  if (labelCol) mapped.label = labelCol;

  const sites = rows.map((row, i) => {
    const site = {
      id: identity.id ? row[identity.id] : String(i + 1),
      name: identity.name ? row[identity.name] : null,
      lat: identity.lat ? toNumber(row[identity.lat]) : null,
      lon: identity.lon ? toNumber(row[identity.lon]) : null
    };
    if (labelCol) site.label = toLabel(row[labelCol]);
    for (const [attr, r] of Object.entries(resolved)) {
      const n = toNumber(row[r.col]);
      site[attr] = n === null ? null : n * r.scale + r.offset;
    }
    return site;
  });

  return { sites, report: { rows: rows.length, mapped, unmapped } };
}

module.exports = { loadCsv };
