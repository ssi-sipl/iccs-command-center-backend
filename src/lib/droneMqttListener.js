import { getMqttClient } from "./mqttClient.js";
import { getIo } from "./socket.js";
import prisma from "./prisma.js"; // adjust path if needed

const DRONE_TOPIC = "drones/+/telemetry";
// example: drones/DRONE-001/telemetry

let initialized = false;

export function initDroneMqttListener() {
  if (initialized) return;
  initialized = true;

  const client = getMqttClient();

  client.on("connect", () => {
    console.log("[MQTT] Subscribing to", DRONE_TOPIC);

    client.subscribe(DRONE_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        console.error("[MQTT] Subscribe error:", err.message);
      } else {
        console.log("[MQTT] Subscribed to drone telemetry");
      }
    });
  });

  client.on("message", async (topic, message) => {
    try {
      if (!topic.startsWith("drones/")) return;

      const payload = JSON.parse(message.toString());
      const { droneId, lat, lng, alt } = payload;

      console.log(
        "[MQTT] Message received on topic:",
        topic,
        "Payload:",
        payload
      );

      if (!droneId || typeof lat !== "number" || typeof lng !== "number") {
        console.warn("[MQTT] Invalid drone payload:", payload);
        return;
      }

      // Validate drone from DB (optional but recommended)
      const drone = await prisma.droneOS.findUnique({
        where: { droneId },
        select: { id: true, droneId: true },
      });

      if (!drone) {
        console.warn(`[MQTT] Unknown droneId: ${droneId}`);
        return;
      }

      const data = {
        id: drone.id, // DB id
        droneId: drone.droneId,
        lat,
        lng,
        alt: alt ?? null,
        ts: Date.now(),
      };

      console.log("[MQTT] Drone Coordinates received:", data);

      const io = getIo();
      io.emit("drone_position", data);

      // Optional: log
      // console.log("[MQTT] Drone update:", data);
    } catch (err) {
      console.error("[MQTT] Message handling error:", err.message);
    }
  });
}
