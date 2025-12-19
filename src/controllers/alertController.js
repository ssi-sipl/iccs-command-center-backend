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
        status: "ACTIVE",
      },
    });

    if (existingActive) {
      return res.status(200).json({
        success: true,
        data: existingActive,
        skipped: true,
      });
    }

    const area = await prisma.area.findUnique({
      where: { id: sensor.areaId },
    });

    sensor.areaName = area ? area.name : "Unknown Area";
    sensor.areaId = area ? area.areaId : "Unknown AreaId";

    // 3) Create a new ACTIVE alert for this sensor
    const alertType = type || "ObjectDetected";
    const alertMessage =
      message || `Object detected in front of sensor ${sensor.sensorId}`;

    const newAlert = await prisma.alert.create({
      data: {
        sensorDbId: sensor.id,
        sensorId: sensor.sensorId,
        type: alertType,
        message: alertMessage,
        status: "ACTIVE",
        metadata: metadata || undefined,
      },
    });

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
 * GET /api/alerts/:id
 *
 * - Get a single alert by ID with full details
 */
async function getAlertById(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Alert ID is required",
      });
    }

    const alert = await prisma.alert.findUnique({
      where: { id },
      include: {
        sensor: {
          include: {
            area: true,
          },
        },
      },
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    return res.json({
      success: true,
      data: alert,
    });
  } catch (err) {
    console.error("Error in getAlertById:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * DELETE /api/alerts/:id
 *
 * - Delete an alert by ID
 * - Can delete alerts in any status
 */
async function deleteAlert(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Alert ID is required",
      });
    }

    // Check if alert exists
    const alert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    // Delete the alert
    await prisma.alert.delete({
      where: { id },
    });

    // Broadcast deletion via WebSocket
    try {
      const io = getIo();
      io.emit("alert_deleted", { id });
    } catch (e) {
      console.error(
        "Socket not initialized, cannot emit alert_deleted:",
        e.message
      );
    }

    return res.json({
      success: true,
      message: "Alert deleted successfully",
      data: { id },
    });
  } catch (err) {
    console.error("Error in deleteAlert:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * POST /api/alerts/:id/send-drone
 *
 * Body:
 * {
 *   droneId: "DRONE-1"      // required
 * }
 *
 * Effect:
 *  - If alert is ACTIVE → set status = SENT, decision = "send_drone:DRONE-1"
 */
async function sendDroneForAlert(req, res) {
  try {
    const { id } = req.params;
    const { droneId } = req.body || {};

    if (!droneId) {
      return res.status(400).json({
        success: false,
        error: "droneId is required",
      });
    }

    const drone = await prisma.droneOS.findUnique({
      where: { id: droneId },
    });

    if (!drone) {
      return res.status(404).json({
        success: false,
        error: "Drone not found",
      });
    }

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

    const decision = `send_drone:${drone.id}`;

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        status: "SENT",
        decidedAt: new Date(),
        decision,
      },
    });

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
      await publishJson("drone", mqttPayload);
    } catch (e) {
      // already logged inside publishJson
    }

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
        sensor: {
          include: {
            area: true,
          },
        },
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
 * GET /api/alerts/by-sensor/:sensorDbId
 *
 * - Fetch alert history for a particular sensor.
 */
async function getAlertsBySensor(req, res) {
  try {
    const { sensorDbId } = req.params;

    if (!sensorDbId) {
      return res.status(400).json({
        success: false,
        error: "sensorDbId param is required",
      });
    }

    const sensor = await prisma.sensor.findUnique({
      where: { id: sensorDbId },
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        error: "Sensor not found",
      });
    }

    const alerts = await prisma.alert.findMany({
      where: {
        sensorDbId: sensorDbId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        sensor: {
          include: {
            area: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: alerts,
    });
  } catch (err) {
    console.error("Error in getAlertsBySensor:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * GET /api/alerts
 *
 * - Returns all alerts with optional filtering by status
 * - Includes sensor information for each alert
 * - Supports pagination and sorting
 *
 * Query params:
 *  - status?: "ACTIVE" | "SENT" | "NEUTRALISED"  // Filter by alert status
 *  - limit?: number                               // Number of results (default: 100)
 *  - skip?: number                                // Skip results for pagination (default: 0)
 *  - sortBy?: "createdAt" | "decidedAt"          // Sort field (default: createdAt)
 *  - sortOrder?: "asc" | "desc"                  // Sort order (default: desc)
 */
async function getAllAlerts(req, res) {
  try {
    const {
      status,
      limit = 100,
      skip = 0,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const whereClause = {};

    if (status && ["ACTIVE", "SENT", "NEUTRALISED"].includes(status)) {
      whereClause.status = status;
    }

    const limitNum = parseInt(limit, 10) || 100;
    const skipNum = parseInt(skip, 10) || 0;

    const validSortFields = ["createdAt", "decidedAt"];
    const validSortOrders = ["asc", "desc"];

    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = validSortOrders.includes(sortOrder)
      ? sortOrder
      : "desc";

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      orderBy: { [sortField]: sortDirection },
      skip: skipNum,
      take: limitNum,
      include: {
        sensor: {
          include: {
            area: true,
          },
        },
      },
    });

    const totalCount = await prisma.alert.count({
      where: whereClause,
    });

    return res.json({
      success: true,
      data: alerts,
      pagination: {
        total: totalCount,
        limit: limitNum,
        skip: skipNum,
        hasMore: skipNum + limitNum < totalCount,
      },
    });
  } catch (err) {
    console.error("Error in getAllAlerts:", err);
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
  getAllAlerts,
  getAlertById,
  deleteAlert,
};
