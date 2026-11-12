import { Router } from "express";
import { createLocationController } from "../controllers/location.controller.js";
export function createV1Router(deps) {
  const router = Router();
  router.get("/locations", createLocationController(deps));
  return router;
}
