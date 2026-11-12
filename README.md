# TERRA · Earth to other worlds

A planetary analog explorer on the **PERN stack** (PostgreSQL, Express, React, Node.js). It shows 30 labelled Earth sites on a 3D globe and, for each one, what a trained model predicts: the probability that the site is a good Moon or Mars analog, which inputs pushed the prediction, how the model did when that site was held out, and the most similar known sites.

## What the numbers are

- **Model:** logistic regression on four standardised inputs (average solar index, maximum temperature swing, maximum slope, average slope angle), trained on the 30 sites in `server/analog-engine/data/nasa_sites.csv`. It lives in `server/analog-engine/` and was written by the team's ML engineer.
- **Accuracy:** 76.7% under leave-one-out testing (23 of 30), 95% interval 60 to 90%, AUC 0.83, against a 50% coin flip. Quote the range, not a single number.
- **What the percentage means:** the probability that the dataset's labellers would call a site a good analog. It is not a probability of mission success, and it does not separate Moon from Mars.
- **Open questions before judging** (see `server/analog-engine/README.md`): the source and units of the four input columns, the source of the good/bad labels, and a suspected duplicated row (Great Plains and Rhine Valley share two values).
- **Map coordinates** in `shared/src/sites.js` are approximate place coordinates for the globe marker. They are not the points the dataset was sampled at. Replace them when the real sample coordinates are known.

## Folder structure

```text
terra/
├── client/                   React front end (Next.js, static export)
│   ├── public/assets/        Cached orbital imagery and credits
│   └── src/
│       ├── app/              Layout, page, styles
│       ├── components/       Explorer, Globe, LocationSidebar, ResultsPanel
│       ├── lib/              Globe renderer, types, imagery list
│       └── services/         catalog.ts: loads sites and predictions
├── server/                   Express API (Node.js)
│   ├── analog-engine/        The ML engine, unmodified (dataset, model, router, docs, tests)
│   ├── scripts/              generate-catalog.js
│   ├── src/
│   │   ├── config/env.js     Environment variables, validated in one place
│   │   ├── db/               pool.js, schema.sql, migrate.js, seed.js
│   │   ├── models/           SQL queries (site.model.js)
│   │   ├── controllers/      Request handlers
│   │   ├── routes/           URL to controller mapping
│   │   ├── services/         engine.service.js, catalog.service.js
│   │   ├── middleware/       Rate limit and error handling
│   │   ├── app.js            Express app (security headers, CORS, static files)
│   │   └── server.js         Start-up and graceful shutdown
│   └── test/                 API tests (node --test)
├── shared/                   sites.js (display details) and catalog.generated.js
├── scripts/                  Imagery download helpers
├── Dockerfile
└── docker-compose.yml
```

How the parts connect:

- **PostgreSQL** holds display details for each site (name, country, coordinates, type) in the `sites` table. It is optional: if it is absent or unreachable, the server answers from `shared/src/sites.js` instead and says so.
- **The engine** holds the dataset values, labels and the trained model, read from its own files at start-up.
- **`GET /api/v1/locations`** joins the two by dataset name. A site with no dataset row gets `prediction: null`; a score is never invented.
- **`shared/src/catalog.generated.js`** is the same join written to a file, so the client also works with no server. A test fails if it goes out of date.

## Run locally

Requires Node.js 22.17+ and PostgreSQL 14+ (or Docker for the database).

```sh
npm ci
docker compose up -d db                 # or point DATABASE_URL at Neon (see below)
cp server/.env.example server/.env      # set DATABASE_URL
npm run db:migrate                      # creates the sites table
npm run db:seed                         # inserts display details for the 30 sites
npm run dev:server                      # API on http://localhost:4175
```

In a second terminal:

```sh
cp client/.env.example client/.env.local   # set NEXT_PUBLIC_API_BASE_URL=http://localhost:4175
npm run dev                                # client on http://localhost:4174
```

`npm run check` runs the TypeScript check, the server tests and the engine's own tests.

Without `DATABASE_URL` the server still runs, using `shared/src/sites.js` for display details. Without `NEXT_PUBLIC_API_BASE_URL` the client runs with no server, from the bundled catalog.

## Using Neon (hosted PostgreSQL)

Neon works with no code change. In the Neon console, create a project, then copy the
connection string from **Connect** and put it in `DATABASE_URL`:

```
postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require
```

Then run `npm run db:migrate && npm run db:seed` once, from your machine or as part of
the host's start command.

Four things worth knowing:

- **Take the pooled string.** Its host contains `-pooler`. Neon limits direct
  connections, and the pooled endpoint is the one built for an app that keeps a pool open.
- **`?sslmode=require` is enough.** The connection string already carries it, and the
  server leaves it alone and verifies Neon's certificate. Leave `DATABASE_SSL` at
  `false`: it is only for a database that needs TLS but has no `sslmode=` in its URL.
  Writing `?sslmode=verify-full` instead means the same thing today and silences a
  deprecation warning from the driver.
- **A free Neon project sleeps after about five minutes idle.** The first request then
  waits a few seconds while it wakes. The connection timeout is 20 seconds to allow for
  that. Open the site once before presenting so the database is already awake.
- **Never commit the URL.** It contains the password. Keep it in `server/.env`
  (git-ignored) locally and in the host's dashboard in production.

If Neon is asleep, over quota or unreachable, `/api/v1/locations` still answers from the
bundled site list and reports `"catalog": "bundled (database unreachable)"`.
`/api/v1/health` reports the database as `unreachable` so you can tell the difference.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Database state and model summary (503 if the database is unreachable) |
| GET | `/api/v1/locations` | The 30 sites with predictions, ranked, plus model accuracy |
| GET | `/api/analog/predictions` | Engine: all known sites ranked |
| POST | `/api/analog/predict` | Engine: score any location from its four input values |
| GET | `/api/analog/model` | Engine: coefficients, validation numbers, data warnings |
| GET | `/api/analog/challenge-sites` | Engine: the three sites named in the challenge text |

The full engine API is in `server/analog-engine/docs/api-reference.md`. All `/api` routes share one limit of 60 requests per minute per IP. Request bodies are limited to 16 kB.

## When the dataset or model changes

```sh
# 1. Replace server/analog-engine/data/nasa_sites.csv (or the whole analog-engine folder)
npm run train        # retrains, prints held-out accuracy, regenerates the bundled catalog
# 2. Add or rename entries in shared/src/sites.js so every dataset row has display details
npm run db:seed      # refresh PostgreSQL
npm run check
```

Then rebuild and redeploy. Some tests pin the current accuracy (76.7%) and one documented prediction, so they fail after a retrain until you update the expected numbers on purpose.

Restart the server after retraining. `POST /api/analog/reload` refreshes the engine's own routes only, not `/api/v1/locations`.

## Deploy

### Option A: one Node service plus PostgreSQL (full PERN)

The Express server serves the built client and both APIs from one origin. Works on Render, Railway, Fly.io or any VPS.

1. Create a PostgreSQL database (the host's own, or Neon) and copy its connection string.
2. Create a Node web service from this repository with:
   - Build command: `npm ci && npm run build`
   - Start command: `npm run db:migrate && npm run db:seed && npm start`
3. Set these environment variables on the service:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_API_BASE_URL` | `/` (must be set at build time) |
| `DATABASE_URL` | the connection string from step 1 (Neon: the pooled one) |
| `DATABASE_SSL` | `true` only if the URL has no `?sslmode=` and TLS is required |
| `TRUST_PROXY` | `1` |
| `CORS_ORIGINS` | your public URL, e.g. `https://terra.example.com` |

4. Open `/api/v1/health`. It should return `"database":"ok"` and `"sites":30`.

`PORT` is provided by most hosts. `HOST` defaults to `0.0.0.0` in production.

With Docker instead: `docker compose up --build`, then open http://localhost:8080.

### Option B: static client only (no server, no database)

Same predictions, read from the bundled catalog. Nothing can go down during a demo.

- Build command: `npm run build`
- Output directory: `client/out`
- Leave `NEXT_PUBLIC_API_BASE_URL` unset.

Works on Vercel, Netlify, Cloudflare Pages and GitHub Pages.

### Option C: client and server on different hosts

Deploy the client as in option B, but set `NEXT_PUBLIC_API_BASE_URL` to the server's public HTTPS origin. Deploy the server as in option A and put the client's origin in `CORS_ORIGINS`.

## Imagery and interpretation

- Close-up imagery exists for five sites (Atacama, Haughton, Ódáðahraun, McMurdo, Death Valley). The others are shown from orbit. To add one, see `client/public/assets/surface/manifest.json` and `client/src/lib/imagery.ts`.
- Earth close-ups: Esri World Imagery (Esri, Maxar, Earthstar Geographics and the GIS User Community). Check Esri's terms before redistributing these cached images, or replace them with NASA imagery.
- Earth global texture, clouds and normal maps: Three.js example assets.
- Moon: NASA SVS CGI Moon Kit and JAXA SELENE Kaguya Terrain Camera mosaic, via NASA Trek.
- Mars global: NASA / JPL-Caltech Viking imagery processed by USGS. Jezero close-up: NASA / JPL / MSSS CTX imagery via NASA Trek.
- The Moon and Mars globes are a visual comparison only. Jezero and Marius Hills are illustrative reference regions, and globes are not to scale.
- Earth cannot reproduce lunar or Martian gravity, pressure or radiation.

## Use of AI

The original application was generated with ChatGPT. The PERN restructure, database layer, production hardening and the integration of the analog engine were done with Claude. The engine's own documentation mentions Codex for optional explanation text. Declare what applies in the Space Apps "Use of AI" field.

## Licence

MIT for the source code (see `LICENSE`). Imagery remains under its providers' terms.
