// Display details for the 30 sites in server/analog-engine/data/nasa_sites.csv.
// `datasetName` must match the "Location name" column exactly.
// lat/lon are APPROXIMATE public coordinates of the named place, for the globe marker only.
// They are not the points the dataset's values were sampled at. Replace them with the
// real sample coordinates when the data team provides them.
// Five ids (atacama, haughton, iceland, mcmurdo, deathvalley) match cached close-up imagery.
const site = (id, datasetName, name, country, lat, lon, type, tag) => ({
  id, datasetName, name, country, lat, lon, type, tag, coordsApproximate: true,
});
export const sites = [
  site("atacama", "Atacama", "Atacama Desert", "Chile", -24.5, -69.25, "Desert", "Hyperarid desert"),
  site("mauna-kea", "Mauna Kea", "Mauna Kea", "Hawaii, United States", 19.82, -155.47, "Volcanic", "Shield volcano"),
  site("lanzarote", "Lanzarote,Spain", "Lanzarote", "Canary Islands, Spain", 29.03, -13.63, "Volcanic", "Volcanic island"),
  site("iceland", "Odadahraun,Iceland", "Ódáðahraun", "Iceland", 65.03, -16.75, "Volcanic", "Lava field"),
  site("mount-etna", "Mount Etna", "Mount Etna", "Sicily, Italy", 37.75, 14.99, "Volcanic", "Active volcano"),
  site("deathvalley", "Death Valley", "Death Valley", "California, United States", 36.24, -116.82, "Desert", "Arid basin"),
  site("san-rafael-swell", "San Rafael Swell", "San Rafael Swell", "Utah, United States", 38.8, -110.7, "Desert", "Desert uplift"),
  site("makgadikgadi-pan", "Makgadikgadi Pan", "Makgadikgadi Pan", "Botswana", -20.7, 25.4, "Desert", "Salt pan"),
  site("qaidam-basin", "Qaidam Basin", "Qaidam Basin", "Qinghai, China", 37.3, 94.5, "Desert", "High desert basin"),
  site("makhtesh-ramon", "Makhtesh Ramon", "Makhtesh Ramon", "Negev, Israel", 30.6, 34.85, "Desert", "Erosion crater"),
  site("lonar-crater", "Lonar Crater", "Lonar Crater", "Maharashtra, India", 19.98, 76.51, "Crater", "Impact crater"),
  site("haughton", "Haughton Crater", "Haughton Crater", "Devon Island, Canada", 75.38, -89.67, "Polar", "Impact crater"),
  site("pingualuit-crater", "PINGUALUIT Crater", "Pingualuit Crater", "Quebec, Canada", 61.28, -73.66, "Polar", "Impact crater"),
  site("mcmurdo", "McMurdo Dry Valleys", "McMurdo Dry Valleys", "Antarctica", -77.5, 162.0, "Polar", "Cold desert"),
  site("sarychev-peak", "Sarychev Peak", "Sarychev Peak", "Kuril Islands, Russia", 48.09, 153.2, "Volcanic", "Stratovolcano"),
  site("amazon", "Amazon", "Amazon", "Brazil", -3.5, -62.0, "Rainforest", "Tropical rainforest"),
  site("congo-basin", "Congo Basin Lowlands", "Congo Basin Lowlands", "Central Africa", -0.5, 22.0, "Rainforest", "Tropical lowland"),
  site("borneo", "Borneo Rainforest", "Borneo Rainforest", "Borneo", 0.9, 114.2, "Rainforest", "Tropical rainforest"),
  site("london", "London", "London", "United Kingdom", 51.51, -0.13, "Urban", "Temperate city"),
  site("dublin", "Dublin,Ireland", "Dublin", "Ireland", 53.35, -6.26, "Urban", "Temperate city"),
  site("seattle", "Seattle,USA", "Seattle", "Washington, United States", 47.61, -122.33, "Urban", "Temperate city"),
  site("auckland", "Auckland", "Auckland", "New Zealand", -36.85, 174.76, "Urban", "Temperate city"),
  site("mississippi", "Mississippi", "Mississippi", "United States", 32.7, -90.0, "Lowland", "Humid lowland"),
  site("pampas", "The Pampas Lowlands", "The Pampas Lowlands", "Argentina", -35.0, -62.0, "Lowland", "Grassland"),
  site("great-plains", "The Great Plains Farmland,USA", "Great Plains Farmland", "United States", 39.0, -98.5, "Lowland", "Farmland"),
  site("rhine-valley", "The Rhine River Valley,Germany", "Rhine River Valley", "Germany", 50.0, 7.8, "Lowland", "River valley"),
  site("west-siberian-plain", "The West Siberian Plain,Russia", "West Siberian Plain", "Russia", 61.0, 73.0, "Lowland", "Boreal plain"),
  site("everglades", "The Everglades,USA", "The Everglades", "Florida, United States", 25.3, -80.9, "Wetland", "Subtropical wetland"),
  site("dhaka", "Dhaka,Bangladesh", "Dhaka", "Bangladesh", 23.81, 90.41, "Urban", "Delta city"),
  site("singapore", "Singapore Coastal Basin", "Singapore Coastal Basin", "Singapore", 1.35, 103.82, "Urban", "Coastal city"),
];
