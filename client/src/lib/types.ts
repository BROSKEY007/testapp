export type Body = "Mars" | "Moon";
export type Verdict = "good" | "borderline" | "bad";
export type Prediction = {
  rank: number;
  of: number;
  /** The dataset's own label: 1 = good analog, 0 = bad analog. */
  label: 0 | 1 | null;
  /** Model probability that the site is a good analog, 0 to 1. */
  pGood: number;
  score: number;
  verdict: Verdict;
  /** Probability when this site was held out of training. */
  looPGood: number | null;
  looCorrect: boolean | null;
  summary: string;
  features: Record<string, number>;
  contributions: {
    feature: string;
    label: string;
    value: number;
    /** Push on the log-odds. Positive = toward a good analog. */
    contribution: number;
  }[];
  nearest: {
    name: string;
    displayName?: string;
    label: 0 | 1 | null;
    distance: number;
  }[];
};
export type Location = {
  id: string;
  datasetName: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  coordsApproximate: boolean;
  type: string;
  tag: string;
  prediction: Prediction | null;
};
export type ModelInfo = {
  kind: string;
  n: number;
  classCounts: { good: number; bad: number };
  features: { key: string; label: string; coef: number }[];
  validation: {
    method: string;
    accuracy: number;
    accuracyCi95: [number, number];
    auc: number;
    baselineAccuracy: number;
    confusion: Record<string, number>;
  };
  dataWarnings: string[];
  trainedAt: string | null;
};
export type Catalog = { locations: Location[]; model: ModelInfo };
export type GlobeHandle = {
  fly: (close?: boolean) => void;
  move: (x: number, y: number, z: number) => void;
  setLocation: (location: unknown) => void;
  dispose: () => void;
};
