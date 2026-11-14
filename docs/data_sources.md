# Data Sources

Verify each source, license and access method before use. Record the download date and version.

## Candidate Earth data
| Layer | Source | Access | Status |
|---|---|---|---|
| Climate (precipitation, temperature) | NASA POWER (MERRA-2) | API | to verify |
| Vegetation index | NASA GIBS, MODIS NDVI | tiles or download | to verify |
| Land surface temperature | MODIS LST | LP DAAC or archive | to verify |
| Elevation, slope, roughness | Terrain tiles or other global DEM | download | to verify |
| Land mask | Natural Earth | download | to verify |

## Candidate Moon and Mars references
| Need | Source | Status |
|---|---|---|
| Lunar south pole terrain | NASA PGDA LOLA products | to verify |
| Lunar and Mars browsing | NASA Moon Trek and Mars Trek | to verify |
| Mars site context | published rover landing site literature | to verify |
| Analog site lists | NASA planetary analogs pages and USGS | to verify |

## Rules
- Raw data goes in `data/raw/` and is never edited.
- Every number used as a target needs a source URL in `data/targets.csv`.
- Check license terms. Some imagery is non-commercial only.
- Note any gap (polar regions, missing tiles) in limitations.md.

## Log
| Date | Layer | Version or date range | File | Notes |
|---|---|---|---|---|
