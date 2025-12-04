import express, { json, urlencoded } from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import areaRoutes from "./routers/areaRouter.js";
import sensorRoutes from "./routers/sensorRouter.js";
import droneosRoutes from "./routers/droneosRouter.js";

const app = express();

// Middleware
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));

// Routes
app.use("/api/areas", areaRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/droneos", droneosRoutes);

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
