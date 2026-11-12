'use strict';

/**
 * Target profiles for lunar and Martian base/training analog sites.
 *
 * Each attribute defines:
 *   range    [lo, hi]  - values inside this band score 1.0 for that attribute
 *   softness number    - falloff distance (same unit as the attribute). Outside the
 *                        range the score decays as exp(-0.5 * (distance / softness)^2)
 *   weight   number    - relative importance of the attribute
 *
 * IMPORTANT: these numbers are Earth-attainable analog targets, not raw Moon or Mars
 * surface values (Earth has no place with -60C mean and 6 mbar pressure). They are
 * starting assumptions and should be tuned against your dataset and the challenge text.
 * Edit this file only. Nothing else in the engine hardcodes attribute values.
 */

const ATTRIBUTE_META = {
  elevation_m: { label: 'Elevation', unit: 'm' },
  slope_deg: { label: 'Slope', unit: 'deg' },
  temp_mean_c: { label: 'Mean temperature', unit: 'C' },
  temp_diurnal_range_c: { label: 'Day-night temperature swing', unit: 'C' },
  precip_mm_yr: { label: 'Annual precipitation', unit: 'mm/yr' },
  ndvi: { label: 'Vegetation index (NDVI)', unit: 'index' },
  albedo: { label: 'Surface albedo', unit: 'fraction' },
  soil_iron_pct: { label: 'Soil iron content', unit: '%' },
  rock_abundance_pct: { label: 'Rock abundance', unit: '%' },
  radar_backscatter_db: { label: 'Radar backscatter', unit: 'dB' }
};

const PROFILES = {
  moon: {
    label: 'Moon',
    description:
      'Airless, vegetation-free, dry, large thermal swings, dark basaltic regolith, moderate slopes, rocky terrain.',
    attributes: {
      albedo: { range: [0.05, 0.15], softness: 0.05, weight: 3 },
      ndvi: { range: [0, 0.05], softness: 0.05, weight: 3 },
      precip_mm_yr: { range: [0, 100], softness: 150, weight: 3 },
      temp_diurnal_range_c: { range: [25, 60], softness: 15, weight: 2 },
      slope_deg: { range: [0, 15], softness: 8, weight: 2 },
      rock_abundance_pct: { range: [5, 25], softness: 10, weight: 1.5 },
      soil_iron_pct: { range: [5, 18], softness: 5, weight: 1 },
      elevation_m: { range: [2000, 6000], softness: 1500, weight: 1 },
      radar_backscatter_db: { range: [-15, -8], softness: 4, weight: 1 },
      temp_mean_c: { range: [-20, 10], softness: 15, weight: 1 }
    }
  },
  mars: {
    label: 'Mars',
    description:
      'Cold, very dry, sparse vegetation, iron-rich oxidized soil, high thermal swings, moderate elevation and slopes.',
    attributes: {
      temp_mean_c: { range: [-40, 5], softness: 15, weight: 3 },
      precip_mm_yr: { range: [0, 100], softness: 150, weight: 3 },
      ndvi: { range: [0, 0.08], softness: 0.08, weight: 3 },
      temp_diurnal_range_c: { range: [20, 50], softness: 15, weight: 2 },
      albedo: { range: [0.12, 0.3], softness: 0.08, weight: 2 },
      soil_iron_pct: { range: [8, 20], softness: 5, weight: 2 },
      elevation_m: { range: [2000, 5500], softness: 1500, weight: 1.5 },
      slope_deg: { range: [0, 20], softness: 10, weight: 1.5 },
      rock_abundance_pct: { range: [5, 30], softness: 10, weight: 1 },
      radar_backscatter_db: { range: [-18, -6], softness: 5, weight: 1 }
    }
  }
};

/**
 * Operational readiness for training use (optional field infra_distance_km).
 * A site that is a great analog but 2000 km from any road is a poor training site.
 */
const READINESS = {
  attribute: 'infra_distance_km',
  scale_km: 200,
  training_blend: 0.2
};

module.exports = { PROFILES, ATTRIBUTE_META, READINESS };
