import { bundledCatalog } from "@terra/shared";
import type { Catalog } from "@/lib/types";
// NEXT_PUBLIC_API_BASE_URL: the Express server origin, or "/" when the server serves
// this build itself. Empty = no server: the catalog generated from the trained model
// at build time is used instead (same numbers, see `npm run catalog`).
const apiBase = () => process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
export const apiConnected = () => Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
export const bundled = bundledCatalog as unknown as Catalog;

const inUnit = (v: unknown) => typeof v === "number" && v >= 0 && v <= 1;
const validPrediction = (p: Record<string, unknown> | null) =>
  p === null ||
  (inUnit(p.pGood) &&
    ["good", "borderline", "bad"].includes(p.verdict as string) &&
    Number.isInteger(p.rank) &&
    typeof p.summary === "string" &&
    Array.isArray(p.contributions) &&
    Array.isArray(p.nearest));

export async function getCatalog(signal: AbortSignal): Promise<Catalog> {
  if (!apiConnected()) return bundled;
  const response = await fetch(`${apiBase()}/api/v1/locations`, { signal });
  if (!response.ok) throw Error("The site catalog is unavailable.");
  const data = await response.json();
  if (
    !Array.isArray(data.locations) ||
    data.locations.length === 0 ||
    !inUnit(data.model?.validation?.accuracy) ||
    data.locations.some(
      (s: Record<string, unknown>) =>
        typeof s.id !== "string" ||
        typeof s.name !== "string" ||
        typeof s.country !== "string" ||
        typeof s.tag !== "string" ||
        typeof s.type !== "string" ||
        !Number.isFinite(s.lat) ||
        !Number.isFinite(s.lon) ||
        !validPrediction(s.prediction as Record<string, unknown> | null),
    )
  )
    throw Error("The site catalog returned an invalid result.");
  return { locations: data.locations, model: data.model };
}
