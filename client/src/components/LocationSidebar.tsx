import type { Location } from "@/lib/types";
const verdictText = { good: "Good", borderline: "Borderline", bad: "Poor" } as const;
export default function LocationSidebar({
  locations,
  selected,
  onSelect,
}: {
  locations: Location[];
  selected: Location;
  onSelect: (site: Location) => void;
}) {
  return (
    <aside className="locations panel">
      <div className="section-label">01 / EXPLORE</div>
      <h2>Places on Earth</h2>
      <p className="muted intro">
        {locations.length} labelled sites, ranked by the model&apos;s
        probability of a good analog.
      </p>
      <nav aria-label="Earth sites ranked by predicted analog quality">
        {locations.map((site) => {
          const p = site.prediction;
          return (
            <button
              key={site.id}
              className={`location ${site.id === selected.id ? "selected" : ""}`}
              aria-pressed={site.id === selected.id}
              onClick={() => onSelect(site)}
            >
              <i className={`thumb ${p ? `verdict-${p.verdict}` : ""}`} aria-hidden="true">
                {p ? Math.round(p.pGood * 100) : "–"}
              </i>
              <span>
                <strong>{site.name}</strong>
                <small>{site.country}</small>
                <em className={p ? `verdict-${p.verdict}` : ""}>
                  {p ? `${verdictText[p.verdict]} · ` : "Not in dataset · "}
                  <span>{site.tag}</span>
                </em>
              </span>
              <b aria-hidden="true">
                {site.id === selected.id
                  ? "↗"
                  : p
                    ? String(p.rank).padStart(2, "0")
                    : "–"}
              </b>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-note">
        <span>⌖</span>
        <p>
          Choose a place to fly closer.
          <br />
          <strong>Start on Earth. Think beyond it.</strong>
        </p>
      </div>
    </aside>
  );
}
