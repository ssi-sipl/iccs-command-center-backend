// droneMqttListener.js
import { getMqttClient } from "./mqttClient.js";
import { getIo } from "./socket.js";
import prisma from "./prisma.js";

const DRONE_TOPIC = "drones/+/telemetry";
let initialized = false;

const toFloat = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) ? n : null;
};

export function initDroneMqttListener() {
  if (initialized) return;
  initialized = true;

  const client = getMqttClient();

  client.on("connect", () => {
    console.log("[MQTT] Subscribing to", DRONE_TOPIC);
    client.subscribe(DRONE_TOPIC, { qos: 1 });
  });

  client.on("message", async (topic, message) => {
    try {
      if (!topic.startsWith("drones/")) return;

      const payload = JSON.parse(message.toString());
      console.log("[MQTT] Payload:", payload);

      // Normalize fields (VERY IMPORTANT)
      const droneId = payload.droneid || payload.droneId;
      const lat = toFloat(payload.currentLatitude ?? payload.lat);
      const lng = toFloat(payload.currentLongitude ?? payload.lng);
      const alt = toFloat(payload.currentAltitude ?? payload.alt);

      if (!droneId || lat === null || lng === null) {
        console.warn("[MQTT] Invalid telemetry payload");
        return;
      }

      // Validate drone
      const drone = await prisma.droneOS.findUnique({
        where: { droneId },
        select: { id: true, droneId: true },
      });

      if (!drone) {
        console.warn(`[MQTT] Unknown droneId: ${droneId}`);
        return;
      }

      // Build unified telemetry object
      const telemetry = {
        droneDbId: drone.id,
        droneId,
        lat,
        lng,
        alt,
        speed: toFloat(payload.droneSpeed),
        battery: toFloat(payload.batteryVoltage),
        mode: payload.droneMode ?? null,
        gpsFix: toInt(payload.GPSFix),
        satellites: toInt(payload.satelliteCount),
        windSpeed: toFloat(payload.windSpeed),
        targetDistance: toFloat(payload.targetDistance),
        event: payload.event ?? null,
        status: payload.status ?? null,
        command: payload.command ?? null,
        ts: Date.now(),
      };

      // 🔥 Emit to frontend
      const io = getIo();
      io.emit("drone_telemetry", telemetry);

      // 🧠 Optional: persist latest state (recommended)
      if (payload.command === "altitudeData") {
        await prisma.droneOS.update({
          where: { id: drone.id },
          data: {
            lastLatitude: lat,
            lastLongitude: lng,
            lastAltitude: alt,
            battery: toFloat(payload.batteryVoltage),
            droneMode: payload.droneMode ?? null,
          },
        });
      }

      console.log("[MQTT] Telemetry processed:", droneId);
    } catch (err) {
      console.error("[MQTT] Message error:", err.message);
    }
  });
}
