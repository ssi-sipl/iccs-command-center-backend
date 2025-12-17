// routes/rtspRoutes.js
import express from "express";
import { openRtspInPlayer, stopStream } from "../controllers/rtspController.js";

const router = express.Router();

// POST /api/rtsp/open
// Launch the GStreamer pipeline
router.post("/open", openRtspInPlayer);

// POST /api/rtsp/stop
// Kill the running pipeline using PID returned earlier
router.post("/stop", stopStream);

export default router;
