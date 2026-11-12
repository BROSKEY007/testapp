import type { Location, ModelInfo } from "@/lib/types";
const pct = (v: number) => Math.round(v * 100);
const heading = {
  good: "Predicted good analog",
  borderline: "Borderline analog",
  bad: "Predicted poor analog",
} as const;
const labelText = (label: 0 | 1 | null) =>
  label === 1 ? "good" : label === 0 ? "bad" : "unlabelled";

export default function ResultsPanel({
  site,
  model,
}: {
  site: Location;
  model: ModelInfo;
}) {
  const p = site.prediction;
  const v = model.validation;
  // Bars share one scale so their lengths can be compared across features.
  const widest = p
    ? Math.max(0.01, ...p.contributions.map((c) => Math.abs(c.contribution)))
    : 1;
  return (
    <aside className="results panel" aria-live="polite">
      <div className="section-label">02 / UNDERSTAND</div>
      <h2>Analog prediction</h2>
      <p className="muted intro">
        What a model trained on {model.n} labelled sites says about this place.
      </p>
      {!p ? (
        <div className="result-message">
          This place is not in the labelled dataset, so there is no prediction
          for it.
        </div>
      ) : (
        <>
          <div className="score-area">
            <div
              className={`score-ring verdict-ring-${p.verdict}`}
              style={{ "--score": `${pct(p.pGood)}%` } as React.CSSProperties}
            >
              <div>
                <strong>
                  {pct(p.pGood)}
                  <small>%</small>
                </strong>
                <span>Probability of good</span>
              </div>
            </div>
            <span className={`sample-badge verdict-${p.verdict}`}>
              {heading[p.verdict]} · rank {p.rank} of {p.of}
            </span>
          </div>
          <h3 className="character-heading">
            What moved the prediction <span>toward poor / good</span>
          </h3>
          <div className="metrics">
            {p.contributions.map((c) => (
              <div key={c.feature} className="metric">
                <div>
                  <span>
                    {c.label} <small>{Number(c.value.toFixed(2))}</small>
                  </span>
                  <strong className={c.contribution < 0 ? "push-down" : ""}>
                    {c.contribution > 0 ? "+" : ""}
                    {c.contribution.toFixed(2)}
                  </strong>
                </div>
                <div
                  className="bar diverging"
                  role="img"
                  aria-label={`${c.label} pushed ${Math.abs(c.contribution).toFixed(2)} toward ${c.contribution < 0 ? "poor" : "good"}`}
                >
                  <i
                    className={c.contribution < 0 ? "down" : "up"}
                    style={{
                      width: `${(Math.abs(c.contribution) / widest) * 50}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="connection">
            <span className="section-label">WHY THIS RESULT</span>
            <p>{p.summary}</p>
          </div>
          <div className="connection facts">
            <span className="section-label">CHECKED AGAINST THE DATASET</span>
            <dl>
              <div>
                <dt>Dataset label</dt>
                <dd>{labelText(p.label)} analog</dd>
              </div>
              {p.looPGood !== null && (
                <div>
                  <dt>Held-out test</dt>
                  <dd>
                    {pct(p.looPGood)}% ·{" "}
                    <b className={p.looCorrect ? "hit" : "miss"}>
                      {p.looCorrect ? "model was right" : "model was wrong"}
                    </b>
                  </dd>
                </div>
              )}
            </dl>
          </div>
          <div className="connection">
            <span className="section-label">MOST SIMILAR SITES</span>
            <ul className="nearest">
              {p.nearest.map((n) => (
                <li key={n.name}>
                  <span>{n.displayName ?? n.name}</span>
                  <em className={n.label === 1 ? "hit" : "miss"}>
                    labelled {labelText(n.label)}
                  </em>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <p className="accuracy-note">
        Predictions come from a model trained on {model.n} labelled sites.
        Tested by leave-one-out, it is right {pct(v.accuracy)} percent of the
        time (95 percent interval {pct(v.accuracyCi95[0])} to{" "}
        {pct(v.accuracyCi95[1])} percent; a coin flip is{" "}
        {pct(v.baselineAccuracy)} percent).
      </p>
      <details>
        <summary>Method & limitations</summary>
        <p>
          {model.kind}. Inputs: {model.features.map((f) => f.label).join(", ")}.
          Units are not documented in the dataset, so none are shown.
        </p>
        <p>
          The percentage is the probability that the dataset&apos;s labellers
          would call this site a good analog. It is not a probability of mission
          success, and it does not separate Moon from Mars.
        </p>
        <p>
          Held-out results: {v.confusion.true_good} good and{" "}
          {v.confusion.true_bad} bad sites predicted correctly,{" "}
          {v.confusion.missed_good} good sites missed, {v.confusion.false_good}{" "}
          bad sites wrongly passed. AUC {v.auc.toFixed(2)}.
        </p>
        {model.dataWarnings.map((w) => (
          <p key={w}>Data warning: {w}.</p>
        ))}
        <p>
          Earth cannot reproduce lunar or Martian gravity, pressure or
          radiation. Map markers are approximate place coordinates, not the
          points the dataset was sampled at.
        </p>
      </details>
      <div className="result-footer">
        {site.type} <span>•</span> {site.tag}
      </div>
    </aside>
  );
}
