# Deployment Guide

## Embedded Express deployment

When the engine is mounted into an existing Express application, deploy it as part of that application. Include the complete `analog-engine/` directory and ensure runtime file paths resolve correctly.

Required runtime assets:
- `analog-engine/data/nasa_sites.csv`
- `analog-engine/config/columns.json`
- `analog-engine/config/challenge-sites.json`
- `analog-engine/model/analog-model.json`
- relevant source files under `analog-engine/src/`

Set the host application's `PORT` and CORS allowlist. Use `FRONTEND_URL` only if the host app's middleware reads it.

## Standalone Render deployment

The project includes `render.yaml` and `Dockerfile`. For a standalone deployment, configure the service to install dependencies and run `npm start`. The included service exposes the API using the standalone server.

Commit the trained model JSON. Without it, prediction endpoints return a 503 response even if the CSV loads.

Render free services can sleep while idle. Warm the service before a scheduled demo and test the cold-start behavior.

## Next.js deployment

Deploy the frontend to Vercel and set:

```dotenv
NEXT_PUBLIC_API_URL=https://your-express-service.example
```

The value is a public API origin, not a secret. Redeploy after changing it.

## Same-origin rewrite option

A Next.js rewrite can forward `/api/analog/:path*` requests to the Express API. This avoids browser CORS configuration for that route. The rewrite must point to the actual deployed Express origin.

## Static deployment fallback

Generate static assets:

```bash
npm install
npm run train
npm run export
```

Deploy `dist-static/` to Vercel, Netlify or GitHub Pages. The generated directory includes a demo HTML page, model JSON, browser model code, predictions, challenge sites, source sites and data report.

The browser-side model can score a new location without the Express API. Use the static fallback if the API is unavailable or not ready for the demo.

## Production security

The engine does not provide authentication or rate limiting. Add these at the application/API gateway layer.

`POST /reload` is disabled in production unless `ADMIN_TOKEN` is configured. If configured, requests must supply `x-admin-token`. Never expose this token in frontend code or a `NEXT_PUBLIC_` variable.

Restrict CORS to trusted frontend origins and review the dataset's licensing before publishing it.
