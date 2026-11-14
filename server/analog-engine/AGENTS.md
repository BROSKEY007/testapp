# Project context for AI coding assistants

Read this file first. It tells you what this project is, how it is laid out and what to avoid.

## Goal

NASA Space Apps challenge entry. Find places on Earth that resemble the Moon and Mars, to serve as sites for future base design and astronaut training. The deliverable is a scoring engine plus API that a teammate's Express.js backend and a frontend call for a live demo by 14 November 2026.

## Data

`data/nasa_sites.csv`: 30 labelled Earth sites (15 good analogs, 15 bad), converted from `NASA_analogs_v5_corrected.xlsx`. The model uses all 16 numeric parameters: solar, temperature swing, max and avg slope, precipitation, PET, aridity index, max and peak wind, max and mean TRI, max and mean TWI, albedo, insolation and NDVI. Not features: lat, lon, years_used (constant), label and the text columns. McMurdo has no NDVI and is mean-imputed. Units are not documented, so do not state any.

## Stack and layout

Node.js 18 or newer, Express 4, no database.

- `src/model.js`: the learned model. Ridge logistic regression on standardised features, leave-one-out validation, prediction with per-feature contributions. Plain JS, runs in Node and the browser.
- `scripts/train.js`: trains and writes `model/analog-model.json`. Run `npm run train` after any data or mapping change.
- `src/loader.js`: reads CSV and maps columns through `config/columns.json`.
- `src/router.js`: `createAnalogRouter()` Express router. Endpoints are listed in README.md.
- `src/server.js`: standalone server for demos.
- `scripts/export-static.js` and `public/demo.html`: server-free build in `dist-static/`.
- `src/challenge.js` and `config/challenge-sites.json`: the three sites named in the challenge text (Atacama, Haughton Crater, Death Valley), joined to model predictions and served at `/challenge-sites`. Names must match CSV rows. Coordinates are display only.
- `src/profiles.js` and `src/scoring.js`: optional Moon and Mars range-profile approach. It is not used by the learned model; the v5 dataset now has albedo, NDVI, precipitation and slope but still lacks several attributes those profiles need.
- `scripts/analysis/*.py`: Python analysis behind the model choice.
- `test/`: run `npm test`.

## Rules

1. Run `npm test` after any change to `src/model.js`, `src/loader.js`, `src/scoring.js` or `src/profiles.js`. Add a test for any new behavior.
2. Keep Moon and Mars range numbers in `src/profiles.js` only, and model feature definitions in `FEATURES` in `src/model.js` only. Do not hardcode them elsewhere.
3. The real dataset is `data/nasa_sites.csv`. Never add invented or synthetic rows to it, and never present made-up data as a finding.
4. Accuracy claims must come from leave-one-out validation (86.7 percent, interval 73 to 97; 90 percent when selection over 8 declared candidates is nested; the 4-parameter model scores 63 percent). Never quote training accuracy. Never tune the model until the leave-one-out number looks better without saying how many variants were tried.
5. Do not change the response shape of `/predictions`, `/predict` or `/model` without telling the user, because a teammate's code depends on it.
6. Be honest in write-ups. There are only 30 sites. Great Plains/Rhine (insolation), Congo/Rhine (Max_TWI) and Buenos Aires/Everglades (peak wind) share identical values, which may be copy errors. Several parameters are near-duplicates (max and peak wind, avg slope and mean TRI), so single coefficients are not independent effects. Negative weights such as avg slope are statistical patterns and not a geological rule. Earth cannot match lunar or Martian radiation, pressure or gravity. The prediction reflects agreement with the dataset's labels, not mission suitability.
7. Prefer small, tested changes. Explain what you changed and why in two or three sentences.

## Useful tasks to help with

- Check the suspect duplicated values in the CSV against the source, then run `npm run train` and `npm test` (some tests pin the current accuracy and will need their numbers updated, with the new values explained).
- Build a frontend: map of sites coloured by `p_good`, a predict form posting to `/predict`, a methodology panel from `/model`, and `loo_correct` shown per site.
- If more columns arrive, add them to `config/columns.json` and to `FEATURES` in `src/model.js`, retrain and compare leave-one-out results.
- Write the project description and limitations section for the submission.

## First message to paste into an assistant that cannot read the repo

> I am working on a NASA Space Apps entry. Below is the project context file and the code I need help with. Follow the rules in the context file. My task right now is: <describe the task>.
>
> <paste this file>
> <paste the relevant source files>
