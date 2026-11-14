// POST or GET /api/analog/predict. Replaces the engine's own handler, which accepted a
// single feature and returned a confident verdict from imputed means.
// Evidence (leave-one-out, 200 random masks per level, 16-feature model): 16 of 16 features
// give 87 percent accuracy, 12 of 16 give 82 percent, 8 give 75 percent, 4 give 59 percent
// and 3 give 56 percent, which is close to a coin flip. So at least 75 percent of the
// model's features must be supplied.
export const MIN_FRACTION = 0.75;
const LIMIT = 1e6;

export const createPredictController = ({ engine }) =>
  function predict(req, res) {
    const raw = req.method === "GET" ? req.query : req.body;
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return res.status(400).json({ error: "Send a JSON object or query string of feature values" });
    // Only the model's own features are read and echoed back, never arbitrary keys.
    const input = {};
    for (const key of engine.featureKeys) {
      const value = raw[key];
      if (typeof value !== "number" && !(typeof value === "string" && value.trim() !== "")) continue;
      const n = Number(value);
      if (Number.isFinite(n) && Math.abs(n) <= LIMIT) input[key] = n;
    }
    const needed = Math.ceil(engine.featureKeys.length * MIN_FRACTION);
    if (Object.keys(input).length < needed)
      return res.status(400).json({
        error: `provide at least ${needed} of the ${engine.featureKeys.length} features: ${engine.featureKeys.join(", ")}`,
      });
    res.json(engine.predict(input));
  };