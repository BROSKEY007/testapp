# Architecture

## Overview

`analog-engine` is a CommonJS Node.js module that exposes an Express router. Mounting that router inside the existing Express application keeps the engine in the same backend process.

```text
Next.js UI
   |
   | fetch /api/analog/*
   v
Express application
   |-- existing application routes
   |-- analog-engine router
   |      |-- CSV loader
   |      |-- trained JSON model
   |      |-- in-memory site records and predictions
   |      `-- prediction / ranking handlers
   `-- application-owned Postgres access (optional)
```

## Runtime behavior

When `createAnalogRouter()` is called, it synchronously loads the CSV, column mapping, model JSON and explanations. It then calculates predictions for the known sites and stores the resulting state in memory.

The model and site data are not queried from Postgres. A process restart reloads them from files. `POST /reload` can refresh them without a restart, subject to its admin protection.

## Responsibilities

| Component | Responsibility |
|---|---|
| Next.js | User interface, forms, tables, maps and methodology display |
| Existing Express app | HTTP server, app middleware, CORS, authentication and API composition |
| `analog-engine` | CSV loading, prediction, ranking, challenge-site responses |
| CSV | Source records and labels used for training |
| `model/analog-model.json` | Trained model parameters and validation results |
| Postgres | Optional app data only, such as saved user inputs/history |

## Why Postgres is not required

The current dataset contains 30 sites and is loaded into process memory. The trained model is a local JSON artifact. The prediction calculation is performed in the Node process, so a database adds no value to the engine's inference path.

If multiple Express instances are deployed, each instance loads its own copy of the same files at startup. Keep the dataset and model artifact synchronized across deployments.

## Repository layout

```text
analog-engine/
  config/             CSV column mapping and challenge-site metadata
  data/               labelled training CSV
  model/              trained model JSON
  src/                router, loader, model, scoring and helpers
  test/               automated tests
  scripts/            training, static export and analysis utilities
  public/              demo HTML source
  dist-static/         generated no-server deployment
  docs/                integration and technical documentation
  instructions.md      end-to-end integration checklist
```
