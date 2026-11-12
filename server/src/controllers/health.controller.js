export const createHealthController = ({ pool, engine }) =>
  async function health(_req, res) {
    let database = "not configured";
    if (pool) {
      try {
        await pool.query("SELECT 1");
        database = "ok";
      } catch {
        database = "unreachable";
      }
    }
    res.status(database === "unreachable" ? 503 : 200).json({
      status: database === "unreachable" ? "degraded" : "ok",
      database,
      model: { loaded: true, sites: engine.siteCount, accuracy: engine.modelInfo.validation.accuracy },
    });
  };
