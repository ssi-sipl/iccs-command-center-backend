import express from "express";
import {
  getAllFlightHistory,
  getFlightHistoryById,
  getFlightHistoryByDrone,
  getFlightHistoryBySensor,
  getFlightHistoryByAlert,
  updateFlightHistory,
  deleteFlightHistory,
  getFlightStatistics,
} from "../controllers/flightHistoryController.js";

const router = express.Router();

// Stats route - must come before /:id to avoid conflicts
router.get("/stats", getFlightStatistics);

// Main routes
router.get("/", getAllFlightHistory);
router.get("/:id", getFlightHistoryById);
router.put("/:id", updateFlightHistory);
router.delete("/:id", deleteFlightHistory);

// Filter routes
router.get("/drone/:droneId", getFlightHistoryByDrone);
router.get("/sensor/:sensorId", getFlightHistoryBySensor);
router.get("/alert/:alertId", getFlightHistoryByAlert);

export default router;
