export { sites } from "./sites.js";
// Built by `npm run catalog` from the trained model. Lets the client run with no server.
export { default as bundledCatalog } from "./catalog.generated.js";
// Reference regions for the Moon and Mars comparison globes (illustrative pairing only).
export const regions = {
  Mars: { name: "Jezero Crater", lat: 18.45, lon: 77.45, texture: "mars.jpg", color: 0xe7a27b },
  Moon: { name: "Marius Hills", lat: 14.2, lon: -56.7, texture: "moon.jpg", color: 0xd5d9e1 },
};
