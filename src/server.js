import cookieParser from "cookie-parser";
import express, { json, urlencoded } from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import path from "path";
import { getMqttClient } from "./lib/mqttClient.js";
import { initSocket } from "./lib/socket.js";
dotenv.config();

import areaRoutes from "./routers/areaRouter.js";
import sensorRoutes from "./routers/sensorRouter.js";
import droneosRoutes from "./routers/droneosRouter.js";
import alarmRoutes from "./routers/alarmRouter.js";
import alertRoutes from "./routers/alertRouter.js";
import mapRoutes from "./routers/mapRoutes.js";
import rtspRoutes from "./routers/rtspRouter.js";
import flightHistoryRoutes from "./routers/flightHistoryRouter.js";
import { initDroneMqttListener } from "./lib/droneMqttListener.js";
import droneCommandRoutes from "./routers/droneCommandRouter.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import adminUserRoutes from "./routers/adminUserRoutes.js";
import authRoutes from "./routers/authRoutes.js";

const app = express();

// Middleware
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/areas", requireAuth, areaRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/droneos", droneosRoutes);
app.use("/api/alarms", alarmRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/maps", mapRoutes);
app.use("/api/rtsp", rtspRoutes);
app.use("/api/flight-history", flightHistoryRoutes);
app.use("/api/drone-command", droneCommandRoutes);

app.use("/maps", express.static(path.join(process.cwd(), "public", "maps")));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: "Something went wrong!",
  });
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

initDroneMqttListener();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  getMqttClient();
});

export default app;
