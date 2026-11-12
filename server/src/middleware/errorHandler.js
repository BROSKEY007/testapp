export const apiNotFound = (_req, res) =>
  res.status(404).json({ error: "API route not found" });
// Last middleware: malformed JSON, oversized bodies and unexpected failures.
export function errorHandler(error, _req, res, _next) {
  if (error.type === "entity.too.large")
    return res.status(413).json({ error: "Request body too large" });
  if (error.type === "entity.parse.failed" || error.status === 400)
    return res.status(400).json({ error: "Invalid request body" });
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
}
