import { buildCatalog } from "../services/catalog.service.js";
export const createLocationController = ({ siteModel, engine }) =>
  async function listLocations(_req, res) {
    // all() is called first: it decides which source actually answered.
    const rows = await siteModel.all();
    res.json({ ...buildCatalog(rows, engine), catalog: siteModel.source() });
  };
