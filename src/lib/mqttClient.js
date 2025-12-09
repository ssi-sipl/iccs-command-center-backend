import mqtt from "mqtt";

const MQTT_URL = "mqtt://localhost:1883";

const MQTT_OPTIONS = {
  clientId: "drone-backend-" + Math.random().toString(16).slice(2),
  username: "dro",
  password: "gxuvimr",
  clean: true,
};

let client = null;

export function getMqttClient() {
  if (client) return client;

  client = mqtt.connect(MQTT_URL, MQTT_OPTIONS);

  client.on("connect", () => {
    console.log("[MQTT] Connected securely to broker");
  });

  client.on("error", (err) => {
    console.error("[MQTT] Error:", err.message);
  });

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnecting...");
  });

  client.on("close", () => {
    console.log("[MQTT] Connection closed");
  });

  return client;
}

export async function publishJson(
  topic,
  payload,
  options = { qos: 1, retain: false }
) {
  try {
    const c = getMqttClient();
    const message = JSON.stringify(payload);

    await new Promise((resolve, reject) => {
      c.publish(topic, message, options, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    return true;
  } catch (err) {
    console.error("[MQTT] Publish error:", err.message);
    return false;
  }
}
