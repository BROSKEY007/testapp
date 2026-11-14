# Data and Model Notes

## Training data

The current labelled dataset is `data/nasa_sites.csv` (converted from `NASA_analogs_v5_corrected.xlsx`) and contains 30 sites: 15 labelled good and 15 labelled bad. `config/columns.json` maps source CSV headers to canonical engine feature names.

The classifier uses all 16 numeric environmental parameters in the dataset:

- `solar_index` (avg_solar_kwh_m2_day)
- `temp_swing` (max_temp_swing_c)
- `max_slope_deg`, `avg_slope_deg`
- `precip_mm_yr` (mean_annual_precip_mm), `pet_mm_yr` (mean_annual_pet_mm), `aridity_index`
- `max_wind_ms` (max_wind_speed_ms), `peak_wind_ms` (peak_wind_2021_2025_ms)
- `max_tri`, `mean_tri`, `max_twi`, `mean_twi`
- `albedo` (Mean_surface_albedo), `insolation_kwh` (Mean_insolation)
- `ndvi`

Not used as features: `lat` and `lon` (identity and map display), `years_used` (constant 5), `label` and `label_name` (the target), and the text columns (`country`, `aridity_class`, `data_check`, `geology_process_tag`).

McMurdo Dry Valleys has no NDVI (no MODIS coverage over Antarctica). It is kept in the training set and its missing value is replaced by the training-fold mean (z = 0), so no site is dropped.

## Model

The classifier is logistic regression over 16 standardized features with a ridge penalty (C = 1, the default, chosen before looking at results and not tuned). The trained artifact is `model/analog-model.json`. The model implementation is JavaScript and is used by both the API and browser static build.

The API's `p_good` is the model's estimate that the dataset labeling process would classify a location as a good analog. It does not estimate mission success or guarantee suitability for a real lunar or Martian mission.

## Validation

The current model's leave-one-out validation accuracy is 86.7 percent (26 of 30 correct), with a 95 percent bootstrap interval of approximately 73 to 97 percent and AUC approximately 0.94. The earlier 4-parameter model scores 63.3 percent (AUC 0.65) on this same corrected dataset.

Leave-one-out validation withholds one site at a time, refits the model (including standardization) on the other 29 sites, then predicts the held-out site. This is the accuracy to communicate. Do not substitute training accuracy.

The sample is small and the interval is wide. The score should be presented as a rough estimate rather than a guarantee. `scripts/analysis/honest.py` also runs nested leave-one-out over 8 declared candidates (2 feature sets, 4 model types); it gives 90 percent. The shipped model is the fixed logistic regression above, not the winner of a search, so quote 86.7 percent. In `scripts/analysis/explore.py` (25 variants) a depth-2 decision tree reaches 93 percent, but it was not adopted: picking the best of many variants on 30 sites overstates accuracy, and the logistic model is smoother and explains each prediction.

## Known data caveats

- Only 30 sites with 16 parameters. A ridge penalty limits overfitting but accuracy estimates remain wide (about 73 to 97 percent).
- NDVI and annual precipitation separate the classes most strongly (low values mean a good analog: NDVI AUC 0.98, precipitation 0.89). The model leans on them, which is plausible for dry, bare-surface analogs but means it partly learns the labellers' notion of "desert-like".
- Several parameters are almost duplicates: max and peak wind (r = 0.99), avg slope and mean TRI (r = 0.96). The ridge penalty shares weight between them, so individual coefficients should not be read as independent effects. The negative coefficients on avg slope, mean TRI and peak wind are statistical patterns in this small dataset, not geological rules.
- Possible copy errors (identical values at different sites): Great Plains Farmland and Rhine River Valley share Mean_insolation (3.9775); Congo Basin Lowlands and Rhine River Valley share Max_TWI; Buenos Aires and Everglades share peak wind. These are reported in `data_warnings`. The Great Plains and Rhine solar index and temperature swing duplication in the earlier file is fixed in v5.
- Per the `data_check` column: island sites (Mauna Kea, Lanzarote, Sarychev Peak) have albedo, aridity and average slope that partly reflect the sea; polar sites (Odadahraun, Haughton, Pingualuit, McMurdo) have an unreliable aridity index; Mount Etna's avg slope (2.0) looks manually entered.
- The source documentation does not establish all feature units. Do not display units next to values until they are verified.
- Earth analogs cannot reproduce lunar or Martian radiation, pressure or gravity conditions.

## Updating data and retraining

1. Back up the current CSV and model.
2. Update `data/nasa_sites.csv`.
3. Update `config/columns.json` if source headers changed.
4. Run `npm run train`.
5. Review the new coefficients, validation numbers and warnings.
6. Run `npm test`.
7. Update pinned test expectations intentionally if the verified model has changed.
8. Run `npm run export`.
9. Commit the updated model and static output as required.
10. Restart the API or perform an authorized reload.

Do not change expected accuracy values in tests simply to make a failing test pass. First verify that the changed dataset and model are intentional and correct.
