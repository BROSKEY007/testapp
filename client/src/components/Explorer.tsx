"use client";
import { useEffect, useRef, useState } from "react";
import { regions } from "@terra/shared";
import Globe from "./Globe";
import LocationSidebar from "./LocationSidebar";
import ResultsPanel from "./ResultsPanel";
import { getCatalog, apiConnected, bundled } from "@/services/catalog";
import { hasCloseUp } from "@/lib/imagery";
import type { Location, Body, Catalog, GlobeHandle } from "@/lib/types";
export default function Explorer() {
  const [catalog, setCatalog] = useState<Catalog>(bundled),
    [site, setSite] = useState<Location>(bundled.locations[0]),
    [body, setBody] = useState<Body>("Mars"),
    [compare, setCompare] = useState(false),
    [flight, setFlight] = useState(0),
    [stale, setStale] = useState(false);
  const earth = useRef<GlobeHandle | null>(null),
    planet = useRef<GlobeHandle | null>(null);
  useEffect(() => {
    // With an API configured, load site details from PostgreSQL and live predictions.
    const controller = new AbortController();
    getCatalog(controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setCatalog(next);
        setSite(
          (current) =>
            next.locations.find((s) => s.id === current.id) ?? next.locations[0],
        );
      })
      .catch(() => {
        // Keep the catalog built with the client, and say so in the footer.
        if (!controller.signal.aborted) setStale(true);
      });
    return () => controller.abort();
  }, []);
  const select = (next: Location) => {
    setSite(next);
    setFlight((n) => n + 1);
  };
  const closeUp = hasCloseUp(site.id);
  const fly = (close: boolean) => {
    earth.current?.fly(close);
    planet.current?.fly(close);
  };
  return (
    <>
      <header className="header">
        <a className="brand" href="/" aria-label="TERRA home">
          <img src="/favicon.svg" alt="" />
          <span>
            TERRA<small>EARTH TO OTHER WORLDS</small>
          </span>
        </a>
        <div className="header-description">
          A familiar world.<span> A new perspective.</span>
        </div>
        <span className="prototype">
          <i />
          SPACE APPS CONCEPT
        </span>
      </header>
      <main className="workspace">
        <LocationSidebar
          locations={catalog.locations}
          selected={site}
          onSelect={select}
        />
        <section className="stage" aria-label="Planetary explorer">
          <div className="stage-heading">
            <div className="section-label">THE MISSION STARTS HERE</div>
            <h1>{site.name}</h1>
            <p>
              {Math.abs(site.lat).toFixed(2)}° {site.lat < 0 ? "S" : "N"}{" "}
              <span> / </span>
              {Math.abs(site.lon).toFixed(2)}° {site.lon < 0 ? "W" : "E"}{" "}
              <span> / </span>
              {site.tag}
              {site.coordsApproximate && <em> · approximate location</em>}
            </p>
          </div>
          <div className="view-controls">
            <button onClick={() => fly(false)}>◎ Orbit</button>
            <button
              onClick={() => fly(true)}
              disabled={!closeUp}
              title={closeUp ? undefined : "No close-up imagery for this site"}
            >
              ⌖ Close-up
            </button>
            {compare && (
              <button onClick={() => setCompare(false)}>Earth only ×</button>
            )}
          </div>
          <div className={`globes ${compare ? "comparing" : ""}`}>
            <Globe
              body="Earth"
              location={site}
              flight={flight}
              closeUp={closeUp}
              onReady={(h) => (earth.current = h)}
            />
            {compare && (
              <Globe
                body={body}
                location={regions[body]}
                flight={flight}
              closeUp={closeUp}
                onReady={(h) => (planet.current = h)}
              />
            )}
          </div>
          <div className="stage-bottom">
            <p className="interaction-hint">
              Drag to rotate <span>·</span> Scroll to zoom <span>·</span> Select
              a place to fly there
            </p>
            <div className="compare-controls">
              <span>COMPARE WITH</span>
              <button
                className={
                  compare && body === "Moon"
                    ? "active moon-button"
                    : "moon-button"
                }
                aria-pressed={compare && body === "Moon"}
                onClick={() => {
                  setBody("Moon");
                  setCompare(true);
                }}
              >
                <span>◐</span> Moon <b>↗</b>
              </button>
              <button
                className={
                  compare && body === "Mars"
                    ? "active mars-button"
                    : "mars-button"
                }
                aria-pressed={compare && body === "Mars"}
                onClick={() => {
                  setBody("Mars");
                  setCompare(true);
                }}
              >
                <span>●</span> Mars <b>↗</b>
              </button>
            </div>
            {compare && (
              <p className="reference-note">
                Reference region: {regions[body].name} · Illustrative pairing ·
                Globes not to scale
              </p>
            )}
          </div>
        </section>
        <ResultsPanel site={site} model={catalog.model} />
      </main>
      <footer className="footer">
        <span>
          <i />
          {stale
            ? "Server unreachable · showing predictions built with this page"
            : `Model trained on ${catalog.model.n} sites · ${Math.round(catalog.model.validation.accuracy * 100)}% held-out accuracy · ${apiConnected() ? "live from server" : "bundled"}`}
        </span>
        <details>
          <summary>Imagery & project notes</summary>
          <p>
            Earth: Esri World Imagery, Esri, Maxar, Earthstar Geographics and
            GIS User Community. Global Earth maps: Three.js examples. Moon: JAXA
            Kaguya TC via NASA Trek and NASA SVS. Mars: NASA / JPL / USGS and
            Jezero CTX mosaic via NASA Trek. Images are draped on spheres,
            without terrain elevation; detail varies by coverage. Close-up
            imagery exists for five sites only. Markers represent approximate
            regions. No base-location recommendation is implied.
          </p>
          <a href="https://trek.nasa.gov/" target="_blank" rel="noreferrer">
            NASA Trek ↗
          </a>
          <a
            href="https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/?tab=details"
            target="_blank"
            rel="noreferrer"
          >
            Challenge brief ↗
          </a>
        </details>
        <span>EXPLORE · COMPARE · DISCOVER</span>
      </footer>
    </>
  );
}
