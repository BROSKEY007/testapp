// Input checks in front of the analog engine's router, so the engine folder stays
// unmodified. Fixes two defects found in the audit:
//  - PROFILES[target] is truthy for "constructor" and "__proto__", so /rank crashed (500).
//  - /score called scoreSite(null) for site:null or sites:[null] (500).
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export const engineGuard = (engine) => (req, res, next) => {
  const names = engine.profileNames;
  const valid = (t) => typeof t === "string" && names.includes(t.toLowerCase());
  const bad = (message) => res.status(400).json({ error: message });
  const targetMessage = `target must be one of: ${names.join(", ")}`;
  if (req.method === "GET" && req.path === "/rank" && !valid(req.query.target))
    return bad(targetMessage);
  if (req.method === "POST" && req.path === "/score") {
    const body = plain(req.body) ? req.body : {};
    if (!valid(body.target)) return bad(targetMessage);
    const list = Array.isArray(body.sites) ? body.sites : body.site !== undefined ? [body.site] : [];
    if (list.length > 0 && !list.every(plain)) return bad("each site must be an object");
  }
  next();
};