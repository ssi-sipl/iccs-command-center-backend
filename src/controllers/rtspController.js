// controllers/rtspController.js
import { spawn } from "child_process";
import prisma from "../lib/prisma.js";

const VLC_COMMAND = process.env.VLC_COMMAND || "vlc";

// Very simple RTSP validator
function isRtspUrl(url) {
  return typeof url === "string" && url.startsWith("rtsp://");
}

/**
 * POST /api/rtsp/open
 *
 * Body can be:
 *  - { sensorDbId: "<Sensor.id from Prisma>" }
 *  - or { rtspUrl: "rtsp://..." }
 *
 * If sensorDbId is provided, we look up the sensor in Prisma,
 * grab its `rtspUrl` field and open that in VLC.
 */
export async function openRtspInVlc(req, res) {
  try {
    const { sensorDbId, rtspUrl: bodyRtspUrl } = req.body || {};

    let rtspUrl = bodyRtspUrl ?? null;

    // 🔎 If client only gives sensorDbId, resolve RTSP from DB
    if (!rtspUrl && sensorDbId) {
      const sensor = await prisma.sensor.findUnique({
        where: { id: sensorDbId },
        select: { id: true, name: true, rtspUrl: true },
      });

      if (!sensor) {
        return res.status(404).json({
          success: false,
          error: "Sensor not found",
        });
      }

      if (!sensor.rtspUrl) {
        return res.status(400).json({
          success: false,
          error: "This sensor has no RTSP URL configured",
        });
      }

      rtspUrl = sensor.rtspUrl;
    }

    // If still no RTSP URL, error out
    if (!rtspUrl) {
      return res.status(400).json({
        success: false,
        error: "Provide either rtspUrl or sensorDbId",
      });
    }

    if (!isRtspUrl(rtspUrl)) {
      return res.status(400).json({
        success: false,
        error: "Invalid RTSP URL (must start with rtsp://)",
      });
    }

    // VLC arguments – tuned for reasonably low latency
    const args = [
      // low network cache (ms) – tune if needed
      "--network-caching=150",
      "--no-video-title-show",
      // "--fullscreen", // uncomment if you want fullscreen by default
      rtspUrl,
    ];

    // 🚀 Spawn VLC on the same machine where this server is running
    const child = spawn(VLC_COMMAND, args, {
      detached: true,
      stdio: "ignore", // don't hold STDIO open
    });

    // Let VLC run independently
    child.unref();

    return res.status(200).json({
      success: true,
      message: "Launched VLC for RTSP stream",
      pid: child.pid,
    });
  } catch (err) {
    console.error("Error in openRtspInVlc:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to launch VLC",
    });
  }
}
