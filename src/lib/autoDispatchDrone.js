import prisma from "../lib/prisma.js";
import { publishJson } from "../lib/mqttClient.js";

const DRONE_COMMAND_TOPIC = "drone";

/**
 * Auto-dispatch drone for a sensor if enabled
 * @param {String} sensorId - business sensorId (e.g. SENSOR-001)
 * @param {Object} alert - newly created alert
 */
export async function autoDispatchDroneForSensor(sensorId, alert) {
  // 1️⃣ Fetch sensor + area
  const sensor = await prisma.sensor.findUnique({
    where: { sensorId },
    include: {
      area: true,
    },
  });

  if (!sensor) return { skipped: true, reason: "Sensor not found" };

  // 2️⃣ Check auto-send flag
  if (sensor.sendDrone !== "Yes") {
    return { skipped: true, reason: "Auto-send disabled" };
  }

  if (!sensor.areaId) {
    return { skipped: true, reason: "Sensor has no area" };
  }

  // 3️⃣ Fetch drone for this area (1-to-1 enforced)
  const drone = await prisma.droneOS.findUnique({
    where: {
      areaId: sensor.areaId, // UNIQUE because 1–1
    },
  });

  if (!drone) {
    return { skipped: true, reason: "No drone assigned to area" };
  }

  // 4️⃣ Prepare drone command
  const droneData = {
    droneId: drone.droneId,
    event: "send_drone",
    areaId: sensor.area.areaId,
    latitude: sensor.latitude.toString(),
    longitude: sensor.longitude.toString(),
    targetAltitude: drone.targetAltitude.toString(),
    usbAddress: drone.usbAddress,
  };

  // 5️⃣ Publish to MQTT
  await publishJson(DRONE_COMMAND_TOPIC, droneData);

  // 6️⃣ Update alert → SENT
  await prisma.alert.update({
    where: { id: alert.id },
    data: {
      status: "SENT",
      decidedAt: new Date(),
      decision: `auto_send_drone:${drone.id}`,
    },
  });

  // 7️⃣ Create flight history
  await prisma.DroneFlightHistory.create({
    data: {
      droneDbId: drone.id,
      sensorId: sensor.sensorId,
      alertId: alert.id,
    },
  });

  return {
    success: true,
    droneId: drone.droneId,
    areaId: sensor.area.areaId,
  };
}
