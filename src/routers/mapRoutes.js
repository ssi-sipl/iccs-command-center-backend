// routes/mapRoutes.js
import { Router } from "express";
const router = Router();

import {
  getMaps,
  getActiveMap,
  createMap,
  setActiveMap,
  deleteMap,
} from "../controllers/mapController.js";

// GET all maps
router.get("/", getMaps);

// GET active map
router.get("/active", getActiveMap);

// CREATE map
router.post("/", createMap);

// SET active map
router.post("/:id/active", setActiveMap);

// DELETE map
router.delete("/:id", deleteMap);

export default router;
