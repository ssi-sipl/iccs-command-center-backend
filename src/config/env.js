import dotenv from "dotenv";

dotenv.config();

console.log("Loaded ENV variables:", {
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ? "****" : "NOT SET",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ? "****" : "NOT SET",
  MASTER_ADMIN_USERNAME: process.env.MASTER_ADMIN_USERNAME ? "****" : "NOT SET",
  MASTER_ADMIN_PASSWORD: process.env.MASTER_ADMIN_PASSWORD ? "****" : "NOT SET",
  SEND_DRONE_MQTT_TOPIC: process.env.SEND_DRONE_MQTT_TOPIC ? "****" : "NOT SET",
});

export const ENV = {
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  MASTER_ADMIN_USERNAME: process.env.MASTER_ADMIN_USERNAME,
  MASTER_ADMIN_PASSWORD: process.env.MASTER_ADMIN_PASSWORD,
  SEND_DRONE_MQTT_TOPIC: process.env.SEND_DRONE_MQTT_TOPIC,
  NODE_ENV: process.env.NODE_ENV || "development",
};
