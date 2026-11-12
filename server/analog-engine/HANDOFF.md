# Hand-off for the backend engineer

`analog-engine` predicts whether an Earth location is a good or bad Moon and Mars analog site (NASA Space Apps entry). It is a self-contained Node.js module with an Express router. Everything loads into memory at startup, so there is no database and no external service. The prediction math runs in microseconds.

Full details are in `README.md`. This page covers only what you need to integrate it.

## 1. Mount it (5 minutes)

Needs Node 18 or newer. The only new dependency for an existing Express 4 app is `csv-parse`.

```bash
cp -r analog-engine ./analog-engine
npm install csv-parse            # express is already in your app
npm install --prefix analog-engine   # only if you also want to run its tests
```

```js
const { createAnalogRouter } = require('./analog-engine');
app.use('/api/analog', createAnalogRouter());
```

The router reads `data/nasa_sites.csv` and `model/analog-model.json` synchronously when it is created. If either file is missing the app fails at startup, which is intentional. Override paths with `createAnalogRouter({ dataPath, modelPath, mappingPath })` or the env vars in `.env.example`.

Smoke test: `GET /api/analog/health` should return `"model_loaded": true` and `"sites_loaded": 30`.

## 2. The three calls the frontend needs

**List known sites, ranked**

`GET /api/analog/predictions?limit=30&label=1`

`limit` is optional and `label` (0 or 1) filters by the dataset's own label. Each item:

```json
{ "rank": 1, "id": "10", "name": "Makhtesh Ramon", "label": 1,
  "p_good": 0.9529, "score": 95.3, "verdict": "good",
  "loo_p_good": 0.9503, "loo_correct": true,
  "summary": "...", "contributions": [ ... ] }
```

**Score any location**

`POST /api/analog/predict` with JSON, or `GET /api/analog/predict?solar_index=5.9&temp_swing=23&max_slope_deg=70&avg_slope_deg=5`

```json
{ "p_good": 0.9416, "score": 94.2, "predicted_label": 1,
  "verdict": "good", "confidence": "higher", "imputed": [],
  "summary": "Predicted good analog (94 percent probability of a good analog). ...",
  "contributions": [ { "feature": "solar_index", "label": "Avg solar index", "value": 5.9, "z": 1.422, "contribution": 1.445, "imputed": false } ],
  "nearest_known_sites": [ { "id": "10", "name": "Makhtesh Ramon", "label": 1, "distance": 0.148 } ],
  "model_accuracy": { "method": "leave-one-out", "accuracy": 0.7667, "auc": 0.8267, "n": 30 } }
```

Rules: send at least one of the four features. Missing ones are filled with the training average and listed in `imputed`. In that case `confidence` becomes `"reduced"`. No usable feature returns 400. `verdict` is `good` at 0.6 or above, `bad` at 0.4 or below, otherwise `borderline`. `contribution` is the push on the log-odds: positive means toward good.

**Methodology panel**

`GET /api/analog/model` returns the coefficients, validation numbers and `data_warnings`. Use it to show the accuracy statement below.

**Challenge sites (new, additive)**

`GET /api/analog/challenge-sites` returns the three sites named in the challenge with `display_name`, `region`, `lat`, `lon`, `terrain`, `p_good`, `score`, `verdict`, `rank`, `loo_correct`, `features` and `nearest_known_sites`. Scores are read from the same predictions as `/predictions`. `lat` and `lon` are approximate public coordinates for map display and are not in the dataset. Names, coordinates and notes live in `config/challenge-sites.json`. The static build has the same data in `dist-static/challenge-sites.json`. The existing response shapes are unchanged.

Other routes: `GET /sites`, `GET /sites/:id` (raw rows, 404 if unknown), `GET /data-report`, `POST /reload`. Errors are `{ "error": "message" }` with 400, 404 or 503 (model file missing).

## 3. What the UI must say about accuracy

Show this wherever a prediction appears, or link to a methodology section:

> Predictions come from a model trained on 30 labelled sites. Tested by leave-one-out, it is right 77 percent of the time (95 percent interval 60 to 90 percent; a coin flip is 50 percent).

Please also surface `loo_correct` per known site so judges can see where the model is unsure. Do not show training accuracy. Do not describe `p_good` as a probability of mission success: it is the probability that the dataset's labellers would call the site a good analog.

## 4. Production notes

- **No auth and no rate limiting are built in.** Put the router behind your own middleware if the API is public.
- **`POST /reload` is locked down.** With `NODE_ENV=production` it returns 403 unless `ADMIN_TOKEN` is set, and then it needs the header `x-admin-token`. In development it is open.
- **Stateless and safe to run as several instances.** Each loads its own copy of the CSV and model at start.
- **CORS is yours.** The router sets none. The standalone `npm start` server enables it, controlled by `CORS_ORIGINS`.
- **No Python needed at runtime.** The `scripts/analysis/*.py` files only document how the model was chosen.
- **Docker and Render:** `Dockerfile` and `render.yaml` are included. Commit `model/analog-model.json` so the deployed copy has it.

## 5. Changing the data

If the CSV changes: update `config/columns.json` only if column names changed, run `npm run train`, then restart or `POST /reload`. `npm run train` prints the new held-out accuracy and any data warnings. Some tests pin the current accuracy (76.7 percent) and the scikit-learn reference coefficients, so they will fail after a retrain until their expected numbers are updated on purpose.

## 6. No server option

`npm run export` builds `dist-static/` (a prebuilt copy is already in the zip): a demo page plus JSON files and a browser version of the model. It works on any static host, and scoring a new location runs in the browser. If your backend is not ready, the frontend can use this with no API at all.

## 7. Open items and honest limits

- **Atacama scores only 67 percent** (rank 8 of 30). It is labelled good and the model agrees, but with little margin. This reflects how little four numbers capture. Do not tune the model to push named sites up.
- **The three sites named in the challenge text are checked.** Atacama, Haughton Crater and Death Valley are all in the CSV and all labelled good. The model scores them 67 percent (rank 8), 66 percent (rank 9) and 90 percent (rank 2) and gets all three right under leave-one-out. Haughton's two closest known sites by features are labelled bad (Great Plains, Seattle), so its margin is thin. No rows were added or changed.
- **Possible data error:** Great Plains Farmland and Rhine River Valley have identical Solar Index and Temp Swing values. Verify against the source.
- **Units are not documented.** Do not print units next to the values in the UI until the dataset documentation confirms them.
- **Only 30 sites.** Treat every accuracy figure as a rough estimate.

## 8. Checks

`npm install && npm test` runs 28 tests, including an integration test that mounts the router in a bare Express app the way you will. All pass at hand-off.
