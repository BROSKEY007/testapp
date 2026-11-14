# Integration Instructions

This document is the implementation checklist for integrating `analog-engine` into the existing Next.js + Express application.

## 1. Architecture

```text
Next.js frontend
      |
      | HTTP / JSON
      v
Existing Express API
      |
      +---- /api/analog/* ----> analog-engine Express router
      |                              |
      |                              +-- CSV dataset loaded at startup
      |                              +-- trained JSON model loaded at startup
      |                              +-- predictions held in process memory
      |
      +---- application routes ----> Postgres (application-owned data only)
```

The engine is a module mounted inside the existing Express process. It does not require Postgres, a separate engine server, Python at runtime, or an external model service. Postgres remains available for the main application's own data, such as saved user submissions or prediction history.

## 2. Requirements

- Node.js 18 or newer.
- An existing Express 4 application.
- The `analog-engine/` directory, including `data/`, `config/` and `model/`.
- The committed trained model at `analog-engine/model/analog-model.json`.

## 3. Add the engine to Express

Copy the complete `analog-engine/` directory into the backend repository. Do not copy only `src/`: the router also needs the CSV, mapping configuration, challenge-site configuration, model and explanation files.

From the backend project root, install the dependency if it is not already available:

```bash
npm install csv-parse
```

The engine package itself declares Express, `csv-parse` and `cors`. In an existing Express application, Express should be a direct dependency of the host app. The router imports Express to create its router, and the host app mounts it.

Mount the router after creating the Express app:

```js
const express = require('express');
const cors = require('cors');
const { createAnalogRouter } = require('./analog-engine');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use('/api/analog', createAnalogRouter());

app.listen(process.env.PORT || 3001);
```

If the existing application already configures CORS and JSON parsing, keep that configuration and add only the router mount. The engine router does not configure CORS itself.

### File paths

By default, the router resolves these files relative to the engine module:

- `analog-engine/data/nasa_sites.csv`
- `analog-engine/config/columns.json`
- `analog-engine/model/analog-model.json`

You can override paths with `createAnalogRouter({ dataPath, mappingPath, modelPath })` or the `DATA_PATH`, `COLUMNS_PATH` and `MODEL_PATH` environment variables. Use absolute paths in production if your deployment layout is non-standard.

### Startup check

Start the backend and request:

```http
GET http://localhost:3001/api/analog/health
```

Expected fields include:

```json
{
  "status": "ok",
  "sites_loaded": 30,
  "model_loaded": true
}
```

Do not continue to frontend integration until `model_loaded` is `true` and the expected dataset row count is present.

## 4. Connect Next.js to the API

Add the backend origin to the Next.js `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Restart the Next.js development server after changing environment variables.

Create a shared API base:

```js
const API = `${process.env.NEXT_PUBLIC_API_URL}/api/analog`;
```

### Ranked known sites

```js
const response = await fetch(`${API}/predictions?limit=30`);
if (!response.ok) throw new Error('Could not load site predictions');
const ranked = await response.json();
```

The response is an object with `total` and `results`.

### Challenge sites for the map

```js
const response = await fetch(`${API}/challenge-sites`);
if (!response.ok) throw new Error('Could not load challenge sites');
const challenge = await response.json();
```

The three configured challenge locations are Atacama, Haughton Crater and Death Valley. Use the returned coordinates for map markers rather than hardcoding separate copies in the frontend.

### Score a user-entered location

```js
const response = await fetch(`${API}/predict`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    solar_index: 5.9, temp_swing: 23, max_slope_deg: 70, avg_slope_deg: 5,
    precip_mm_yr: 190, pet_mm_yr: 1700, aridity_index: 0.11,
    max_wind_ms: 12.7, peak_wind_ms: 14.6,
    max_tri: 260, mean_tri: 7.5, max_twi: 24, mean_twi: 7.4,
    albedo: 0.35, insolation_kwh: 6.0, ndvi: 0.12
  })
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || 'Prediction failed');
}
const prediction = await response.json();
```

The model uses 16 parameters: `solar_index`, `temp_swing`, `max_slope_deg`, `avg_slope_deg`, `precip_mm_yr`, `pet_mm_yr`, `aridity_index`, `max_wind_ms`, `peak_wind_ms`, `max_tri`, `mean_tri`, `max_twi`, `mean_twi`, `albedo`, `insolation_kwh`, `ndvi`. Send as many as you have: the more that are supplied, the more reliable the score. At least one must be supplied. Any that are missing are imputed using the training means and listed in `imputed`; the response confidence is reduced in that case. The form should therefore offer all 16 fields (they are listed in `features` from `GET /model`).

### Accuracy and methodology panel

```js
const response = await fetch(`${API}/model`);
if (!response.ok) throw new Error('Could not load model information');
const model = await response.json();
```

Use the model response to populate the accuracy/methodology panel. Do not hardcode accuracy values in the UI; the values can change after retraining.

## 5. Frontend presentation requirements

Every prediction view must communicate the model's validation performance. For the current model, use this exact wording:

> Right 87 percent of the time by leave-one-out (95 percent interval 73 to 97).

The authoritative underlying values are in `/model`. Keep the wording synchronized with those values after retraining.

For known-site rows, display the `loo_correct` field so viewers can see whether the model correctly classified each site when that site was held out of training.

Never show training accuracy as evidence of predictive performance. Do not describe `p_good` as the probability of mission success. It represents the model's estimate that the dataset's labeling process would classify a site as a good analog.

Do not print units next to feature values unless the dataset documentation confirms them. The current source does not establish the units with sufficient certainty.

## 6. Postgres is optional

Do not import the 30 training sites into Postgres. The engine reads the CSV and trained model into memory when the Express router is created.

Use Postgres only for application-owned persistence, for example:
- user-submitted location inputs;
- prediction history;
- saved projects or user annotations.

Example table for optional prediction history:

```sql
CREATE TABLE predictions (
  id serial PRIMARY KEY,
  input jsonb NOT NULL,
  p_good real NOT NULL,
  verdict text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

If history is needed, add a route in the main Express app that calls the engine prediction logic/API and writes the resulting user-submitted record to Postgres. Keep that persistence concern outside the training dataset and model loader.

## 7. If the API is not ready: static fallback

The project includes a prebuilt `dist-static/` directory. Host its contents on Vercel, Netlify or another static host.

The Next.js frontend can fetch:

- `predictions.json` for the ranked known-site results;
- `challenge-sites.json` for map locations;
- `model.json` for model and validation metadata.

For scoring a new location in the browser, load `model.json` and `analog-model.js`, then call:

```js
const result = AnalogModel.predict(model, {
  solar_index: 5.9, temp_swing: 23, max_slope_deg: 70, avg_slope_deg: 5,
  precip_mm_yr: 190, pet_mm_yr: 1700, aridity_index: 0.11,
  max_wind_ms: 12.7, peak_wind_ms: 14.6,
  max_tri: 260, mean_tri: 7.5, max_twi: 24, mean_twi: 7.4,
  albedo: 0.35, insolation_kwh: 6.0, ndvi: 0.12
});
```

The static export is a fallback deployment, not a replacement for keeping the source CSV and model in the repository. Regenerate it whenever the data/model changes.

## 8. Deployment

### Express API on Render

1. Push the backend and `analog-engine/` directory to GitHub.
2. Create a Render Blueprint from the included `render.yaml`, or configure a Node web service.
3. Use `npm install` as the build command and `npm start` as the start command when deploying the engine as its own service. For an embedded engine, use the host application's build/start commands.
4. Ensure `model/analog-model.json`, the CSV, and config files are included in the deployed artifact.
5. Set `FRONTEND_URL` (or the host application's CORS allowlist) to the deployed Next.js origin.
6. Set `ADMIN_TOKEN` in production if the reload endpoint must be enabled.
7. Verify `/api/analog/health` after deployment.

Render free instances may sleep while idle. Warm the API a few minutes before a live presentation and allow for a cold-start delay.

### Next.js on Vercel

1. Deploy the Next.js frontend to Vercel.
2. Set `NEXT_PUBLIC_API_URL` to the public Express API origin.
3. Redeploy after changing environment variables.
4. Test all four frontend flows: ranked sites, challenge map, custom prediction and methodology panel.

### CORS alternative

To avoid browser cross-origin requests, configure a Next.js rewrite that forwards `/api/analog/:path*` to the Express origin. Then the browser can call a same-origin `/api/analog/...` path. Keep the backend origin in server-side configuration rather than exposing unnecessary cross-origin access.

## 9. Security checklist

- The router has no built-in authentication or rate limiting. Add the host application's auth, abuse protection and request limits where appropriate.
- In production, `POST /reload` is disabled unless `ADMIN_TOKEN` is configured. When configured, requests must include `x-admin-token`.
- Never expose `ADMIN_TOKEN` through a `NEXT_PUBLIC_` environment variable or frontend code.
- Restrict CORS to the real frontend origin(s).
- Do not commit secrets.
- Check dataset licensing before making the CSV or derived data public.

## 10. When data changes

Run these commands from the `analog-engine/` directory:

```bash
npm run train
npm test
npm run export
```

Then:
1. Review the new leave-one-out accuracy, interval and data warnings.
2. Update tests that intentionally pin the previous coefficients/accuracy only after verifying the new results.
3. Commit the regenerated `model/analog-model.json`.
4. Restart the backend or call the protected `/reload` endpoint.
5. Deploy the refreshed `dist-static/` output if using the static fallback.
6. Update the frontend's displayed accuracy wording if the validation result changed.

## 11. Final demo checklist

- [ ] `/api/analog/health` reports `model_loaded: true`.
- [ ] The expected number of sites is loaded (currently 30).
- [ ] `/predictions` populates the ranked table.
- [ ] `/challenge-sites` populates the map.
- [ ] `/predict` returns a result for a valid input.
- [ ] `/model` populates the accuracy panel.
- [ ] Known-site rows show `loo_correct`.
- [ ] Accuracy is described as leave-one-out validation, not training accuracy.
- [ ] `p_good` is not described as mission-success probability.
- [ ] Feature values are shown without unverified units.
- [ ] Static fallback is deployed and tested before the presentation.
