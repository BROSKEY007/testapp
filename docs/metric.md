# Evaluation Metric and Method

Lock this file before building anything. Change it only with a dated note at the bottom.

## Approach
1. **Baseline: similarity scoring.** For each factor compare an Earth cell to the target value and convert the difference to a 0 to 1 similarity. Combine factors with a weighted geometric mean so one failed factor vetoes a cell.
2. **Improvement: learned model (only if the baseline is validated).** Train a model on known analog sites versus negative controls. The label set is small, so use it carefully (see risks).
3. **Always report the baseline next to any improved model.**

## Factors (candidate list, confirm with sources)
| Factor | Why it matters | Possible source |
|---|---|---|
| Precipitation | Aridity | NASA POWER |
| Vegetation (NDVI) | Barren surface | NASA GIBS MODIS |
| Annual temperature range | Thermal stress | NASA POWER |
| Day/night temperature swing | Thermal cycling | MODIS land surface temperature |
| Slope | Mobility and landing | Terrain tiles or DEM |
| Roughness | Rover and hardware stress | Terrain tiles or DEM |

Each factor needs a cited target value or range from Moon/Mars literature or NASA products. No uncited numbers.

## Validation set
- **Positives:** well-known analog sites (for example Atacama Desert, Mauna Kea, Devon Island, Meteor Crater, McMurdo Dry Valleys). List with source in `data/known_analogs.csv`.
- **Negatives:** clearly unlike sites (rainforests, humid cropland). List with reason.

## Metrics
| Metric | What it tells us | Target |
|---|---|---|
| ROC-AUC (positives vs negatives) | Does the score separate analogs from non-analogs | report, aim above 0.9 |
| Recall at top K | Share of known analogs found in the top K ranked cells | report K = 20, 50, 100 |
| Leave-one-factor-out change | Which factor matters most | report table |
| Weight sensitivity | Do rankings survive weight changes | rank correlation above 0.8 |
| Spatial cross-validation (learned model only) | Honest generalization | hold out whole regions |

## Risks to guard against
- **Tiny label set:** a model can memorize it. Use leave-one-region-out validation, never random splits.
- **Spatial leakage:** neighbouring cells are near copies. Split by region, not by cell.
- **Circular validation:** do not tune weights on the same sites you evaluate on.
- **Perfect scores:** an AUC of 1.00 on easy negatives means the test is too easy. Add harder negatives such as semi-arid or sparsely vegetated land.

## Change log
- (date) initial version
