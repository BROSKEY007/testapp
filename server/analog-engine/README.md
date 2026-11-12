# analog-engine

A self-contained Node.js/Express analog-site prediction module. It loads the labelled CSV and trained JSON model into memory; Postgres is not required for inference.

## Start here

- **[`instructions.md`](instructions.md)** — complete integration walkthrough for the existing Express backend and Next.js frontend.
- **[`docs/architecture.md`](docs/architecture.md)** — components and runtime behavior.
- **[`docs/api-reference.md`](docs/api-reference.md)** — routes, parameters and response semantics.
- **[`docs/data-and-model.md`](docs/data-and-model.md)** — dataset, model, validation and caveats.
- **[`docs/deployment.md`](docs/deployment.md)** — Render, Vercel and static fallback.
- **[`docs/testing-and-maintenance.md`](docs/testing-and-maintenance.md)** — tests, retraining and refresh workflow.

## Quick commands

```bash
npm install
npm test
npm run train
npm run export
npm start
```

See `instructions.md` for the recommended integration sequence and the required demo presentation rules.
