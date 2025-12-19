// routes/alerts.js
import { Router } from "express";
import {
  handleNxAlert,
  sendDroneForAlert,
  neutraliseAlert,
  getActiveAlerts,
  getAlertsBySensor,
  getAllAlerts,
  getAlertById,
  deleteAlert,
} from "../controllers/alertController.js";

const router = Router();

// ⚠️ IMPORTANT: Order matters! Specific routes must come BEFORE parameterized routes

// Nx Witness POSTs here when it detects something
router.post("/from-nx", handleNxAlert);

// Get all alerts (with filtering, pagination, sorting)
// Must be BEFORE /:id routes to avoid conflict
router.get("/alerts", getAllAlerts);

// Get all ACTIVE alerts (for dashboard initial state)
router.get("/active", getActiveAlerts);

// Get alert history for a specific sensor
router.get("/by-sensor/:sensorDbId", getAlertsBySensor);

// Get single alert by ID (view details)
router.get("/:id", getAlertById);

// Delete alert by ID
router.delete("/:id", deleteAlert);

// Send drone for a specific alert
router.post("/:id/send-drone", sendDroneForAlert);

// Neutralise a specific alert
router.post("/:id/neutralise", neutraliseAlert);

export default router;
