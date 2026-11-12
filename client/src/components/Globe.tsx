"use client";
import { useEffect, useRef, useState } from "react";
import type { GlobeHandle } from "@/lib/types";
type Point = { name: string; lat: number; lon: number; id?: string };
export default function Globe({
  body,
  location,
  flight,
  closeUp = true,
  onReady,
}: {
  body: "Earth" | "Moon" | "Mars";
  location: Point;
  flight: number;
  /** false = stay in orbit when a site is selected (no close-up imagery). */
  closeUp?: boolean;
  onReady: (handle: GlobeHandle | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    handle = useRef<GlobeHandle | null>(null),
    latest = useRef({ location, flight, closeUp, onReady });
  latest.current = { location, flight, closeUp, onReady };
  const [error, setError] = useState(false);
  useEffect(() => {
    let canceled = false;
    setError(false);
    import("@/lib/globe/renderer.js")
      .then(({ createGlobe }) => {
        if (canceled || !container.current) return;
        try {
          const api = createGlobe(
            container.current,
            `${body.toLowerCase()}.jpg`,
            latest.current.location,
            body === "Earth" ? 0xb5eed2 : body === "Mars" ? 0xe7a27b : 0xd5d9e1,
            (x: number, y: number, z: number, origin: GlobeHandle) =>
              origin.move(x, y, z),
          );
          handle.current = api;
          latest.current.onReady(api);
          if (latest.current.flight > 0) api.fly(latest.current.closeUp);
        } catch {
          setError(true);
        }
      })
      .catch(() => setError(true));
    return () => {
      canceled = true;
      handle.current?.dispose();
      handle.current = null;
      latest.current.onReady(null);
    };
  }, [body]);
  useEffect(() => {
    handle.current?.setLocation(location);
    if (flight > 0) handle.current?.fly(closeUp);
  }, [location, flight, closeUp]);
  return (
    <div className="globe-wrap">
      <div
        ref={container}
        className="globe-canvas"
        tabIndex={0}
        role="group"
        aria-label={`${body} interactive globe. Drag or use arrow keys to rotate. Plus and minus zoom.`}
      />
      {error && (
        <div className="globe-error">
          Your browser could not start the 3D view. Try enabling hardware
          acceleration. Location results are still available.
        </div>
      )}
      <div className="globe-name">
        <span className={`planet-dot ${body.toLowerCase()}`} />
        {body}
        <small>{location.name}</small>
      </div>
      <div className="zoom-controls">
        <button
          aria-label={`Zoom in on ${body}`}
          onClick={() => handle.current?.move(0, 0, -0.4)}
        >
          +
        </button>
        <button
          aria-label={`Zoom out on ${body}`}
          onClick={() => handle.current?.move(0, 0, 0.4)}
        >
          −
        </button>
      </div>
    </div>
  );
}
