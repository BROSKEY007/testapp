// Sites with cached close-up imagery in public/assets/surface/ (see manifest.json there).
// Other sites are shown from orbit: zooming in would only magnify the global texture.
const CLOSE_UP = new Set(["atacama", "haughton", "iceland", "mcmurdo", "deathvalley"]);
export const hasCloseUp = (siteId: string) => CLOSE_UP.has(siteId);
