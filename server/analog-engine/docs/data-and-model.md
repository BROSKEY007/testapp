# Data and Model Notes

## Training data

The current labelled dataset is `data/nasa_sites.csv` and contains 30 sites: 15 labelled good and 15 labelled bad. `config/columns.json` maps source CSV headers to canonical engine feature names.

The primary learned classifier uses four inputs:

- `solar_index`
- `temp_swing`
- `max_slope_deg`
- `avg_slope_deg`

Minimum slope is constant in the current dataset and is not used as a model feature.

## Model

The classifier is logistic regression over standardized features with a ridge penalty. The trained artifact is `model/analog-model.json`. The model implementation is JavaScript and is used by both the API and browser static build.

The API's `p_good` is the model's estimate that the dataset labeling process would classify a location as a good analog. It does not estimate mission success or guarantee suitability for a real lunar or Martian mission.

## Validation

The current model's leave-one-out validation accuracy is 76.7 percent (23 of 30 correct), with a 95 percent bootstrap interval of approximately 60 to 90 percent and AUC approximately 0.83.

Leave-one-out validation withholds one site at a time, refits the model (including standardization) on the other 29 sites, then predicts the held-out site. This is the accuracy to communicate. Do not substitute training accuracy.

The sample is small and the interval is wide. The score should be presented as a rough estimate rather than a guarantee. The repository README discusses a nested model-selection estimate of about 70 percent; include that caveat when making a detailed methodological claim about model selection.

## Known data caveats

- Great Plains Farmland and Rhine River Valley have identical Solar Index and Temp Swing values in the current CSV. Verify this against the source data.
- The negative coefficient for average slope angle is a statistical relationship in this small dataset, not an established geological rule.
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
