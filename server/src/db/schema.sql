-- TERRA site catalog. Safe to run repeatedly.
-- Holds display details only. Feature values, labels and predictions come from
-- the analog engine (server/analog-engine), which reads its own CSV and model.
CREATE TABLE IF NOT EXISTS sites (
  id                 text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,64}$'),
  -- Must match the "Location name" column in analog-engine/data/nasa_sites.csv.
  dataset_name       text NOT NULL UNIQUE,
  name               text NOT NULL,
  country            text NOT NULL,
  lat                double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon                double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  -- true = approximate place coordinates for the map, not the dataset's sample point.
  coords_approximate boolean NOT NULL DEFAULT true,
  type               text NOT NULL,
  tag                text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
