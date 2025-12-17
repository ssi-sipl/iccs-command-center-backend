// controllers/rtspController.js
import { spawn } from "child_process";
import prisma from "../lib/prisma.js";
import process from "process";
import path from "path";
import { fileURLToPath } from "url";

// Convert import.meta.url to file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYER_COMMAND = path.resolve(__dirname, "../../rtsp_player");

// Very simple RTSP validator
function isRtspUrl(url) {
  return typeof url === "string" && url.startsWith("rtsp://");
}

/**
 * POST /api/rtsp/open-player
 *
 * Body: { sensorDbId: "..."} or { rtspUrl: "rtsp://..." }
 *
 * Spawns your rtsp_player binary for the chosen RTSP stream and returns the child pid.
 */
export async function openRtspInPlayer(req, res) {
  try {
    const { sensorDbId, rtspUrl: bodyRtspUrl } = req.body || {};
    let rtspUrl = bodyRtspUrl ?? null;

    // Resolve RTSP from DB if sensorDbId provided
    if (!rtspUrl && sensorDbId) {
      const sensor = await prisma.sensor.findUnique({
        where: { id: sensorDbId },
        select: { id: true, name: true, rtspUrl: true },
      });
      if (!sensor)
        return res
          .status(404)
          .json({ success: false, error: "Sensor not found" });
      if (!sensor.rtspUrl)
        return res
          .status(400)
          .json({ success: false, error: "Sensor has no RTSP URL" });
      rtspUrl = sensor.rtspUrl;
    }

    if (!rtspUrl)
      return res
        .status(400)
        .json({ success: false, error: "Provide rtspUrl or sensorDbId" });
    if (!isRtspUrl(rtspUrl))
      return res
        .status(400)
        .json({ success: false, error: "Invalid RTSP URL" });

    // Spawn the C++ RTSP player
    const child = spawn(PLAYER_COMMAND, [rtspUrl], {
      detached: true,
      stdio: "ignore", // don't block backend
    });

    child.unref();

    return res.status(200).json({
      success: true,
      message: "Launched RTSP player for stream",
      pid: child.pid,
      command: PLAYER_COMMAND,
    });
  } catch (err) {
    console.error("Error in openRtspInPlayer:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to launch RTSP player",
      details: String(err),
    });
  }
}

/**
 * POST /api/rtsp/stop
 * Body: { pid: <number> } - kills the process launched earlier
 */
export async function stopStream(req, res) {
  try {
    const { pid } = req.body || {};
    if (!pid || typeof pid !== "number") {
      return res
        .status(400)
        .json({ success: false, error: "Provide numeric pid in body" });
    }

    try {
      process.kill(pid, "SIGTERM");
      return res
        .status(200)
        .json({ success: true, message: `Sent SIGTERM to pid ${pid}` });
    } catch (e) {
      try {
        process.kill(pid, "SIGKILL");
        return res
          .status(200)
          .json({ success: true, message: `Sent SIGKILL to pid ${pid}` });
      } catch (ee) {
        return res.status(500).json({
          success: false,
          error: `Failed to kill pid ${pid}`,
          details: String(ee),
        });
      }
    }
  } catch (err) {
    console.error("Error in stopStream:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to stop stream",
      details: String(err),
    });
  }
}
