# API Reference

## Base URL

When mounted as shown in the integration guide:

```text
/api/analog
```

All responses are JSON. Errors use an object with an `error` field.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Runtime and load status |
| GET | `/model` | Model coefficients, validation and warnings |
| GET | `/predictions` | Ranked known-site predictions |
| GET | `/challenge-sites` | Three challenge locations with scores |
| POST | `/predict` | Predict a submitted location |
| GET | `/predict` | Predict from query parameters |
| GET | `/sites` | Raw site list with pagination |
| GET | `/sites/:id` | One raw site |
| GET | `/data-report` | CSV column mapping report |
| GET | `/profiles` | Moon/Mars scoring profiles and attribute metadata |
| GET | `/rank` | Rank sites against a selected profile |
| GET | `/compare` | Compare one known site against Moon and Mars profiles |
| POST | `/score` | Score one or multiple sites against a profile |
| POST | `/reload` | Reload CSV/model state (admin protected) |

## Health

`GET /health`

Check `status`, `sites_loaded`, `model_loaded`, `loaded_at` and `data_source`. The current dataset should report 30 loaded sites and a loaded model.

## Ranked known sites

`GET /predictions?limit=30&label=1`

- `limit`: optional integer, clamped from 1 to 500; default 200.
- `label`: optional `0` or `1`, filters by the dataset's original label.

Response shape:

```json
{
  "total": 30,
  "results": [
    {
      "rank": 1,
      "id": "10",
      "name": "Example site",
      "p_good": 0.95,
      "loo_p_good": 0.94,
      "loo_correct": true
    }
  ]
}
```

Each result contains prediction details, original label and leave-one-out fields. Use `loo_correct` to show the held-out correctness of each known site.

## Predict a new location

`POST /predict`

Request body:

```json
{
  "solar_index": 5.9,
  "temp_swing": 23,
  "max_slope_deg": 70,
  "avg_slope_deg": 5,
  "precip_mm_yr": 190,
  "pet_mm_yr": 1700,
  "aridity_index": 0.11,
  "max_wind_ms": 12.7,
  "peak_wind_ms": 14.6,
  "max_tri": 260,
  "mean_tri": 7.5,
  "max_twi": 24,
  "mean_twi": 7.4,
  "albedo": 0.35,
  "insolation_kwh": 6.0,
  "ndvi": 0.12
}
```

The model has 16 features: `solar_index`, `temp_swing`, `max_slope_deg`, `avg_slope_deg`, `precip_mm_yr`, `pet_mm_yr`, `aridity_index`, `max_wind_ms`, `peak_wind_ms`, `max_tri`, `mean_tri`, `max_twi`, `mean_twi`, `albedo`, `insolation_kwh`, `ndvi`. At least one must be provided as a usable numeric value, and the more that are provided the better the score. Missing features are imputed using the training mean and listed in `imputed`. The response's confidence is reduced when imputation occurs.

The response includes `p_good`, `score`, `predicted_label`, `verdict`, `confidence`, `imputed`, `summary`, feature `contributions`, `nearest_known_sites` and `model_accuracy`.

`verdict` thresholds:
- `good`: `p_good` is at least 0.60;
- `bad`: `p_good` is at most 0.40;
- `borderline`: between those thresholds.

`p_good` is a model estimate of whether a site would be labelled good by the dataset's labeling scheme. It is not a probability of mission success.

## Methodology data

`GET /model`

Use the returned `validation` object to render the accuracy statement and related methodology. Current reference result:
- leave-one-out accuracy: 0.8667 (86.7 percent, 26 of 30);
- 95 percent bootstrap interval: 73 to 97 percent;
- AUC: 0.9422;
- sample size: 30.

These are the current model's values, not permanent constants. Read the endpoint at runtime.

## Challenge sites

`GET /challenge-sites`

Returns the three locations configured in `config/challenge-sites.json`: Atacama, Haughton Crater and Death Valley. Each includes coordinates and prediction/held-out details for map and detail-card use.

## Other routes

- `GET /sites?limit=50&offset=0`: raw rows with pagination.
- `GET /sites/:id`: one site; returns 404 when not found.
- `GET /data-report`: mapped and unmapped CSV fields.
- `GET /profiles`: profile definitions and attribute metadata.
- `GET /rank?target=mars&purpose=base&limit=10&minCoverage=0.5&breakdown=false`: profile ranking. `target` is `moon` or `mars`; `purpose` is `base` or `training`.
- `GET /compare?id=12&purpose=base`: one site's Moon and Mars profile scores.
- `POST /score`: body accepts `{ "target": "moon", "site": {...} }` or `{ "target": "mars", "sites": [...] }`. Maximum 1,000 sites per request.

## Reload

`POST /reload`

- In development, reload is available without a token unless `ADMIN_TOKEN` is set.
- If `ADMIN_TOKEN` is set, send it as `x-admin-token`.
- In production with no `ADMIN_TOKEN`, reload returns 403.

Do not expose the token to the browser.

## Error handling

Common statuses include:
- `400`: invalid/missing input or query parameter;
- `404`: site ID not found;
- `413`: too many sites in a batch score request;
- `503`: model is not available/trained;
- `401`/`403`: reload authorization failure.
