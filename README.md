# nasa-model#

## Purpose
Your NASA competition project: predicting Moon and Mars compatibility from Earth analog signals. This is also your serious ML portfolio piece, so honesty about limits matters as much as accuracy.

## Tracker tasks
Problem statement and metric, data collection and cleaning, baseline, improved model, validation and uncertainty, limitations, final report and demo, rounds 1 to 5.

## Folder structure
```
nasa-model/
  docs/
    problem_statement.md
    metric.md
    limitations.md
    rounds/        one file per round submission
  data/
    raw/           never edited
    clean/
  notebooks/
  src/
  models/
  reports/
  README.md
```

## Daily input
- 1 progress entry in `docs/log.md`: what you did, result, next step
- Data work, a model run or a validation check (one of these per day)
- Commit message format: `stage: what changed and metric result`

Minimum on a bad day: one log entry.

## Order
1. Lock the problem statement and evaluation metric first
2. Collect and clean datasets (Earth analog signals and Moon/Mars comparison data)
3. Baseline model
4. Time-series and signal features, then improved model
5. Validation and uncertainty estimates
6. Limitations write-up
7. Final report and demo

## Done when
- A clear method with honest validation and stated limits
- Every round submitted early with a matching file in `docs/rounds/`

## Rules
- Raw data is never edited
- Never oversell results
- Baseline first, always
- Finish each round deliverable days before the deadline
