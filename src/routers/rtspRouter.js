// routes/rtspRoutes.js
import express from "express";
import { openRtspInVlc } from "../controllers/rtspController.js";

const router = express.Router();

// POST /api/rtsp/open
router.post("/open", openRtspInVlc);

export default router;
