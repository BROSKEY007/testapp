// Joins display details (PostgreSQL or bundled) with the engine's predictions.
// A site with no matching dataset row gets prediction: null, never an invented score.
export function buildCatalog(siteRows, engine) {
  const key = (name) => String(name).trim().toLowerCase();
  const displayNames = new Map(siteRows.map((s) => [key(s.datasetName), s.name]));
  const withDisplayNames = (prediction) =>
    prediction && {
      ...prediction,
      nearest: prediction.nearest.map((n) => ({
        ...n,
        displayName: displayNames.get(key(n.name)) ?? n.name,
      })),
    };
  const locations = siteRows
    .map((s) => ({ ...s, prediction: withDisplayNames(engine.predictionFor(s.datasetName)) }))
    .sort(
      (a, b) =>
        (a.prediction?.rank ?? Infinity) - (b.prediction?.rank ?? Infinity) ||
        a.name.localeCompare(b.name),
    );
  return { locations, model: engine.modelInfo };
}
