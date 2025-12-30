import prisma from "../lib/prisma.js";
import { publishJson } from "../lib/mqttClient.js";

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
        { status: 400 }
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

    res.status(200).json({
      success: true,
      message: "Drone command sent successfully",
      flightId: newFlight.id,
    });
  } catch (error) {
    console.error("Error at droneCommandController.js/sendDrone:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send drone",
    });
  }
};
