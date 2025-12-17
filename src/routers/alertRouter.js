// routes/alerts.js
import { Router } from "express";
import {
  handleNxAlert,
  sendDroneForAlert,
  neutraliseAlert,
  getActiveAlerts,
  getAlertsBySensor,
  getAllAlerts,
} from "../controllers/alertController.js";

const router = Router();

// Nx Witness POSTs here when it detects something
router.post("/from-nx", handleNxAlert);

router.get("/alerts", getAllAlerts);

// UI can call this to send drone for a specific alert
router.post("/:id/send-drone", sendDroneForAlert);

// UI can call this to neutralise a specific alert
router.post("/:id/neutralise", neutraliseAlert);

// List all ACTIVE alerts (for dashboard initial state)
router.get("/active", getActiveAlerts);

// History for a specific sensor
router.get("/by-sensor/:sensorDbId", getAlertsBySensor);

export default router;
