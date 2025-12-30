import express from "express";
import {
  getAllFlightHistory,
  getFlightHistoryById,
  getFlightHistoryByDrone,
  getFlightHistoryBySensor,
  getFlightHistoryByAlert,
  deleteFlightHistory,
} from "../controllers/flightHistoryController.js";

const router = express.Router();

/**
 * IMPORTANT:
 * Specific routes MUST come before `/:id`
 * Otherwise Express will treat "drone" as an ID
 */

// ---- Filtered routes ----
router.get("/drone/:droneDbId", getFlightHistoryByDrone);
router.get("/sensor/:sensorId", getFlightHistoryBySensor);
router.get("/alert/:alertId", getFlightHistoryByAlert);

// ---- Main routes ----
router.get("/", getAllFlightHistory);
router.get("/:id", getFlightHistoryById);

// ---- Destructive (should be protected in prod) ----
router.delete("/:id", deleteFlightHistory);

export default router;
