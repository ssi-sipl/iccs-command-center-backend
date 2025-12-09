import prisma from "../lib/prisma.js";
import { getIo } from "../lib/socket.js";
import { publishJson } from "../lib/mqttClient.js";

/**
 * Nx Witness → POST /api/alerts/from-nx
 *
 * Expected body:
 * {
 *   sensorId: "SENSOR-001",      // required (your logical sensorId)
 *   type?: "ObjectDetected",     // optional, default "ObjectDetected"
 *   message?: "some message",    // optional, default auto-generated
 *   metadata?: { ... }           // optional raw payload from Nx
 * }
 *
 * Rule:
 *  - Only ONE ACTIVE alert per sensor at a time.
 *  - Multiple sensors can each have one ACTIVE alert.
 */
async function handleNxAlert(req, res) {
  try {
    const { sensorId, type, message, metadata } = req.body || {};

    if (!sensorId) {
      return res.status(400).json({
        success: false,
        error: "sensorId is required",
      });
    }

    // 1) Find the sensor by business sensorId (not Mongo _id)
    const sensor = await prisma.sensor.findUnique({
      where: { sensorId },
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        error: `Sensor with sensorId ${sensorId} not found`,
      });
    }

    // 2) Check if this sensor already has an ACTIVE alert
    const existingActive = await prisma.alert.findFirst({
      where: {
        sensorDbId: sensor.id,
        status: "ACTIVE", // matches your AlertStatus enum
      },
    });

    if (existingActive) {
      // Business rule: do NOT create a new one, just return existing
      return res.status(200).json({
        success: true,
        data: existingActive,
        skipped: true, // optional flag so you know a new alert was not created
      });
    }

    const area = await prisma.area.findUnique({
      where: { id: sensor.areaId },
    });

    // Attach area info to sensor for broadcasting
    sensor.areaName = area ? area.name : "Unknown Area";
    sensor.areaId = area ? area.areaId : "Unknown AreaId";

    // 3) Create a new ACTIVE alert for this sensor
    const alertType = type || "ObjectDetected";
    const alertMessage =
      message || `Object detected in front of sensor ${sensor.sensorId}`;

    const newAlert = await prisma.alert.create({
      data: {
        sensorDbId: sensor.id, // relation FK -> Sensor.id
        sensorId: sensor.sensorId, // business ID for debugging / UI
        type: alertType,
        message: alertMessage,
        status: "ACTIVE", // AlertStatus enum value
        metadata: metadata || undefined,
      },
    });

    // 4) Optionally broadcast via WebSocket / Socket.IO here
    //    e.g. io.emit("alert_active", newAlert)
    const payload = {
      ...newAlert,
      sensor: {
        id: sensor.id,
        sensorId: sensor.sensorId,
        name: sensor.name,
        latitude: sensor.latitude,
        longitude: sensor.longitude,
        area: {
          name: sensor.areaName,
          areaId: sensor.areaId,
        },
      },
    };

    // 🔥 broadcast to all connected clients
    try {
      const io = getIo();
      io.emit("alert_active", payload);
    } catch (e) {
      console.error(
        "Socket not initialized, cannot emit alert_active:",
        e.message
      );
    }

    return res.status(201).json({
      success: true,
      data: newAlert,
    });
  } catch (err) {
    console.error("Error in handleNxAlert:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * INTERNAL helper – change alert status with decision
 */
async function setAlertStatus(id, status, decision) {
  // Only ACTIVE alerts can be transitioned
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) return null;
  if (alert.status !== "ACTIVE") return null;

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      status,
      decidedAt: new Date(),
      decision,
    },
  });

  return updated;
}

/**
 * POST /api/alerts/:id/send-drone
 *
 * Body:
 * {
 *   droneId?: "DRONE-1"      // optional for now
 * }
 *
 * Effect:
 *  - If alert is ACTIVE → set status = SENT, decision = "send_drone:DRONE-1"
 */
async function sendDroneForAlert(req, res) {
  try {
    const { id } = req.params; // alertId
    const { droneId } = req.body || {}; // Mongo _id of DroneOS

    // ✅ 1. Validate droneId is provided
    if (!droneId) {
      return res.status(400).json({
        success: false,
        error: "droneId is required",
      });
    }

    // ✅ 2. Check whether the drone actually exists
    const drone = await prisma.droneOS.findUnique({
      where: { id: droneId },
    });

    if (!drone) {
      return res.status(404).json({
        success: false,
        error: "Drone not found",
      });
    }

    // ✅ 3. Ensure the alert exists AND is ACTIVE
    const alert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    if (alert.status !== "ACTIVE") {
      return res.status(409).json({
        success: false,
        error: "Only ACTIVE alerts can dispatch a drone",
      });
    }

    // ✅ 4. Mark alert as SENT (atomic update)
    const decision = `send_drone:${drone.id}`;

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        status: "SENT",
        decidedAt: new Date(),
        decision,
      },
    });

    // ✅ 5. ACTUAL DRONE TRIGGER POINT (you plug Mission Planner here)
    /*
      await triggerDroneMission({
        droneId: drone.id,
        sensorId: alert.sensorId,
        latitude: alert.sensor?.latitude,
        longitude: alert.sensor?.longitude,
      });
    */
    const mqttPayload = {
      alert: updated,
      drone: {
        id: drone.id,
        droneOSName: drone.droneOSName,
        droneType: drone.droneType,
        gpsFix: drone.gpsFix,
        minHDOP: drone.minHDOP,
        minSatCount: drone.minSatCount,
        maxWindSpeed: drone.maxWindSpeed,
        droneSpeed: drone.droneSpeed,
        targetAltitude: drone.targetAltitude,
        gpsLost: drone.gpsLost,
        telemetryLost: drone.telemetryLost,
        minBatteryLevel: drone.minBatteryLevel,
        usbAddress: drone.usbAddress,
        batteryFailSafe: drone.batteryFailSafe,
        gpsName: drone.gpsName,
        maxAltitude: drone.maxAltitude,
      },
    };

    try {
      await publishJson("drone/mission/start", mqttPayload);
    } catch (e) {
      // already logged inside publishJson
    }

    // ✅ 6. WebSocket broadcast (if using Socket.IO)
    // io.emit("alert_resolved", { id, status: "SENT", droneId: drone.id });

    try {
      const io = getIo();
      io.emit("alert_resolved", { id: updated.id, status: updated.status });
    } catch (e) {
      console.error(
        "Socket not initialized, cannot emit alert_resolved:",
        e.message
      );
    }

    return res.json({
      success: true,
      data: {
        alert: updated,
        drone: {
          id: drone.id,
          name: drone.droneOSName,
          type: drone.droneType,
        },
      },
    });
  } catch (err) {
    console.error("Error in sendDroneForAlert:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * POST /api/alerts/:id/neutralise
 *
 * Body: (optional)
 * {
 *   reason?: "false_positive" | "manual_clear" | ...
 * }
 *
 * Effect:
 *  - If alert is ACTIVE → set status = NEUTRALISED, decision = "neutralised[:reason]"
 */
async function neutraliseAlert(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const decision = reason ? `neutralised:${reason}` : "neutralised";

    const updated = await setAlertStatus(id, "NEUTRALISED", decision);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Alert not found or not ACTIVE",
      });
    }

    // TODO: broadcast via WebSocket: io.emit("alert_resolved", { id, status: "NEUTRALISED" });
    try {
      const io = getIo();
      io.emit("alert_resolved", { id: updated.id, status: updated.status });
    } catch (e) {
      console.error(
        "Socket not initialized, cannot emit alert_resolved:",
        e.message
      );
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("Error in neutraliseAlert:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * GET /api/alerts/active
 *
 * - Returns all ACTIVE alerts (across all sensors).
 * - You can use this on dashboard load to sync frontend state.
 */
async function getActiveAlerts(req, res) {
  try {
    const alerts = await prisma.alert.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: {
        sensor: true, // so UI can show sensor name, location, etc.
      },
    });

    return res.json({
      success: true,
      data: alerts,
    });
  } catch (err) {
    console.error("Error in getActiveAlerts:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * GET /api/alerts/by-sensor/:sensorId
 *
 * - Fetch alert history for a particular sensor.
 */
async function getAlertsBySensor(req, res) {
  try {
    const { sensorDbId } = req.params; // Mongo ObjectId of Sensor

    // ✅ 1. Validate input
    if (!sensorDbId) {
      return res.status(400).json({
        success: false,
        error: "sensorDbId param is required",
      });
    }

    // ✅ 2. (Optional but recommended) Verify sensor exists
    const sensor = await prisma.sensor.findUnique({
      where: { id: sensorDbId },
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        error: "Sensor not found",
      });
    }

    // ✅ 3. Fetch alerts using sensorDbId (CORRECT FK)
    const alerts = await prisma.alert.findMany({
      where: {
        sensorDbId: sensorDbId,
        // status: "ACTIVE", // uncomment if you ONLY want active alerts
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      data: alerts,
    });
  } catch (err) {
    console.error("Error in getAlertsBySensorDbId:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

export {
  handleNxAlert,
  sendDroneForAlert,
  neutraliseAlert,
  getActiveAlerts,
  getAlertsBySensor,
};
