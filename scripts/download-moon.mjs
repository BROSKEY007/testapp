import { readFile, writeFile, stat } from "node:fs/promises";
const root = new URL("../client/public/assets/surface/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", root), "utf8"),
);
const z = 10,
  span = 180 / 2 ** z,
  lat = 14.2,
  lon = -56.7,
  row = Math.floor((90 - lat) / span),
  col = Math.floor((lon + 180) / span);
const info = {
  credit: "JAXA / SELENE Kaguya Terrain Camera · NASA Trek",
  source: "https://trek.nasa.gov/moon/",
  patches: [],
};
for (let y = row - 2; y <= row + 2; y++)
  for (let x = col - 2; x <= col + 2; x++) {
    const file = `kaguya-${z}-${y}-${x}.png`,
      bbox = [
        -180 + x * span,
        90 - (y + 1) * span,
        -180 + (x + 1) * span,
        90 - y * span,
      ];
    if (!(await stat(new URL(file, root)).catch(() => null))) {
      let bytes;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const r = await fetch(
            `https://trek.nasa.gov/tiles/Moon/EQ/Kaguya_TCortho_Mosaic_Global_4096ppd/1.0.0/default/default028mm/${z}/${y}/${x}.png`,
            { signal: AbortSignal.timeout(30000) },
          );
          if (!r.ok) throw Error(`CTX tile ${y}/${x}: ${r.status}`);
          bytes = Buffer.from(await r.arrayBuffer());
          if (bytes.subarray(-8, -4).toString() !== "IEND")
            throw Error("Invalid imagery response");
          break;
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
      await writeFile(new URL(file, root), bytes);
    }
    info.patches.push({ file, bbox });
  }
manifest.moon = info;
await writeFile(
  new URL("manifest.json", root),
  JSON.stringify(manifest, null, 2),
);
console.log("Saved Kaguya lunar close-up tiles.");
