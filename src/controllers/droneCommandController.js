import prisma from "../lib/prisma.js";
import { publishJson } from "../lib/mqttClient.js";
import { getIo } from "../lib/socket.js";

const DRONE_COMMAND_TOPIC = "drone";

// send drone
export const sendDrone = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is missing",
      });
    }

    const { droneDbId, alertId, sensorId, targetLatitude, targetLongitude } =
      req.body;
    // sensorId and alertId are optional
    // droneDbId - droneId, areaId, targetAltitude
    // targetLatitude
    // targetLongitude
    // usbAdress

    if (!droneDbId) {
      return res.status(400).json({
        success: false,
        error: "droneId is required",
      });
    }
    if (targetLatitude === undefined || targetLongitude === undefined) {
      return res.json(
        {
          status: false,
          message:
            'Invalid input: "targetLatitude", "targetLongitude", and "targetAltitude" are required.',
        },
        { status: 400 },
      );
    }

    const drone = await prisma.droneOS.findUnique({
      where: { id: droneDbId },
      include: { area: true },
    });

    if (!drone) {
      return res.status(404).json({
        success: false,
        error: "Drone not found",
      });
    }
    let alert = null;
    if (alertId) {
      alert = await prisma.alert.findUnique({
        where: { id: alertId },
        include: { sensor: true },
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
      // Neutralize the alert
      const decision = `send_drone:${drone.id}`;

      const updated = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: "SENT",
          decidedAt: new Date(),
          decision,
        },
      });
      const io = getIo();
      io.emit("alert_resolved", {
        id: updated.id,
        status: updated.status,
      });
    }

    const droneData = {
      droneId: drone.droneId,
      event: "send_drone",
      areaId: drone.area.areaId,
      latitude: targetLatitude.toString(),
      longitude: targetLongitude.toString(),
      targetAltitude: drone.targetAltitude.toString(),
      usbAddress: drone.usbAddress.toString(),
    };

    console.log("Publishing to MQTT:", droneData);

    await publishJson(DRONE_COMMAND_TOPIC, droneData);

    const newFlight = await prisma.DroneFlightHistory.create({
      data: {
        droneDbId,
        sensorId: sensorId || null,
        alertId: alertId || null,
      },
    });

    if (!newFlight) {
      return res.status(500).json({
        success: false,
        error: "Failed to create flight history record",
      });
    }

    // 🔴 EMIT MISSION STARTED (for map polyline)
    const io = getIo();

    io.emit("mission_started", {
      droneId: drone.droneId, // IMPORTANT: frontend uses droneId, not DB id
      sensorId: sensorId || null,
      targetLat: Number(targetLatitude),
      targetLng: Number(targetLongitude),
    });

    console.log("[SOCKET] mission_started:", {
      droneId: drone.droneId,
      sensorId,
      targetLatitude,
      targetLongitude,
    });

    res.status(200).json({
      success: true,
      message: "Drone command sent successfully",
      flightId: newFlight,
    });
  } catch (error) {
    console.error("Error at droneCommandController.js/sendDrone:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send drone",
    });
  }
};

export const dropPayload = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is missing",
      });
    }

    const { droneDbId } = req.body;
    // sensorId and alertId are optional
    // droneDbId - droneId, areaId, targetAltitude
    // targetLatitude
    // targetLongitude
    // usbAdress

    if (!droneDbId) {
      return res.status(400).json({
        success: false,
        error: "droneId is required",
      });
    }

    const drone = await prisma.droneOS.findUnique({
      where: { id: droneDbId },
      include: { area: true },
    });

    if (!drone) {
      return res.status(404).json({
        success: false,
        error: "Drone not found",
      });
    }

    const droneData = {
      droneId: drone.droneId,
      event: "drop_payload",
      areaId: drone.area.areaId,
    };

    console.log("Publishing to MQTT:", droneData);

    await publishJson(DRONE_COMMAND_TOPIC, droneData);

    res.status(200).json({
      success: true,
      message: "Drone command sent successfully",
    });
  } catch (error) {
    console.error("Error at droneCommandController.js/sendDrone:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send drone",
    });
  }
};

export const recallDrone = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is missing",
      });
    }

    const { droneDbId } = req.body;
    // sensorId and alertId are optional
    // droneDbId - droneId, areaId, targetAltitude
    // targetLatitude
    // targetLongitude
    // usbAdress

    if (!droneDbId) {
      return res.status(400).json({
        success: false,
        error: "droneId is required",
      });
    }

    const drone = await prisma.droneOS.findUnique({
      where: { id: droneDbId },
      include: { area: true },
    });

    if (!drone) {
      return res.status(404).json({
        success: false,
        error: "Drone not found",
      });
    }

    const droneData = {
      droneId: drone.droneId,
      event: "recall_drone",
      areaId: drone.area.areaId,
    };

    console.log("Publishing to MQTT:", droneData);

    await publishJson(DRONE_COMMAND_TOPIC, droneData);

    res.status(200).json({
      success: true,
      message: "Drone command sent successfully",
    });
  } catch (error) {
    console.error("Error at droneCommandController.js/sendDrone:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send drone",
    });
  }
};

export const dronePatrol = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is missing",
      });
    }

    const { droneDbId } = req.body;
    // sensorId and alertId are optional
    // droneDbId - droneId, areaId, targetAltitude
    // targetLatitude
    // targetLongitude
    // usbAdress

    if (!droneDbId) {
      return res.status(400).json({
        success: false,
        error: "droneId is required",
      });
    }

    const drone = await prisma.droneOS.findUnique({
      where: { id: droneDbId },
      include: { area: true },
    });

    if (!drone) {
      return res.status(404).json({
        success: false,
        error: "Drone not found",
      });
    }

    const droneData = {
      droneId: drone.droneId,
      event: "patrol",
      areaId: drone.area.areaId,
    };

    console.log("Publishing to MQTT:", droneData);

    await publishJson(DRONE_COMMAND_TOPIC, droneData);

    res.status(200).json({
      success: true,
      message: "Drone command sent successfully",
    });
  } catch (error) {
    console.error("Error at droneCommandController.js/sendDrone:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send drone",
    });
  }
};
