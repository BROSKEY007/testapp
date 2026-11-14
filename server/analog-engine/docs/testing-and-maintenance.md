# Testing and Maintenance

## Install and test

From the `analog-engine/` directory:

```bash
npm install
npm test
```

The test suite uses Node's built-in test runner. It covers CSV header mapping, model coefficients, leave-one-out validation, predictions, missing-value imputation, scoring behavior, challenge data and API behavior.

## Train

```bash
npm run train
```

This reads the CSV and column mapping, validates that the required label and feature columns are present, trains the model and writes `model/analog-model.json`. It prints the current leave-one-out accuracy and data warnings.

## Export static files

```bash
npm run export
```

This writes the generated static demo and JSON assets into `dist-static/`.

## Full refresh sequence

When data or mapping changes:

```bash
npm run train
npm test
npm run export
```

Then restart the Express process or call the protected `POST /api/analog/reload` route. Deploy the updated model and static assets together.

## Pinned tests

Some tests intentionally pin the current model coefficients and validation accuracy. If retraining changes them, investigate the cause and verify the new results before updating expectations. The tests are regression safeguards, not values to blindly overwrite.

## Operational smoke tests

After local startup or deployment, verify:

```bash
curl http://localhost:3001/api/analog/health
curl http://localhost:3001/api/analog/model
curl 'http://localhost:3001/api/analog/predictions?limit=30'
curl http://localhost:3001/api/analog/challenge-sites
```

Test one POST prediction with all 16 feature fields. Confirm the frontend renders `loo_correct` and the leave-one-out accuracy from the model endpoint.
