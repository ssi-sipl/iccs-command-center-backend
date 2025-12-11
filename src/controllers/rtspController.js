// controllers/rtspController.js
import { spawn } from "child_process";
import prisma from "../lib/prisma.js";
import process from "process";

/* Environment overrides:
   - GST_COMMAND: path to gst-launch binary (default: "gst-launch-1.0")
   - GST_WRAPPER: optional wrapper command, e.g. "xvfb-run -a" (useful on headless servers)
*/
const GST_COMMAND = process.env.GST_COMMAND || "gst-launch-1.0";
const GST_WRAPPER = process.env.GST_WRAPPER || ""; // e.g. "xvfb-run -a"

// Very simple RTSP validator
function isRtspUrl(url) {
  return typeof url === "string" && url.startsWith("rtsp://");
}

/**
 * POST /api/rtsp/open-gst
 *
 * Body: { sensorDbId: "..."} or { rtspUrl: "rtsp://..." }
 *
 * Spawns a gst-launch pipeline for the chosen RTSP stream and returns the child pid.
 */
export async function openRtspInGst(req, res) {
  try {
    const { sensorDbId, rtspUrl: bodyRtspUrl } = req.body || {};
    let rtspUrl = bodyRtspUrl ?? null;

    // If client only gives sensorDbId, resolve RTSP from DB
    if (!rtspUrl && sensorDbId) {
      const sensor = await prisma.sensor.findUnique({
        where: { id: sensorDbId },
        select: { id: true, name: true, rtspUrl: true },
      });

      if (!sensor) {
        return res
          .status(404)
          .json({ success: false, error: "Sensor not found" });
      }
      if (!sensor.rtspUrl) {
        return res.status(400).json({
          success: false,
          error: "This sensor has no RTSP URL configured",
        });
      }
      rtspUrl = sensor.rtspUrl;
    }

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

    // Build the gst-launch argument list.
    // Note: using explicit element tokens and '!' tokens as separate args works with spawn.
    // This pipeline uses software decode (avdec_h264) and 200ms latency (good quality).
    const pipelineArgs = [
      // pipeline pieces:
      "rtspsrc",
      `location=${rtspUrl}`,
      "latency=200",
      "protocols=tcp",
      "!",
      "rtph264depay",
      "!",
      "h264parse",
      "!",
      "avdec_h264",
      "!",
      "videoconvert",
      "!",
      "autovideosink",
      "sync=true",
    ];

    // If the user set GST_WRAPPER (e.g., "xvfb-run -a"), split and run wrapper + gst command
    // Example: GST_WRAPPER="xvfb-run -a"
    let child;
    if (GST_WRAPPER) {
      // spawn wrapper as shell command with gst-launch and args
      // e.g. ["xvfb-run","-a","gst-launch-1.0", ...]
      const wrapperParts = GST_WRAPPER.trim().split(/\s+/);
      const finalArgs = [
        ...wrapperParts.slice(0),
        GST_COMMAND,
        ...pipelineArgs,
      ];
      // spawn via the first wrapper token
      child = spawn(finalArgs[0], finalArgs.slice(1), {
        detached: true,
        stdio: "ignore",
      });
    } else {
      // spawn gst-launch directly
      child = spawn(GST_COMMAND, pipelineArgs, {
        detached: true,
        stdio: "ignore", // don't block server stdout/stderr
      });
    }

    child.unref();

    return res.status(200).json({
      success: true,
      message: "Launched GStreamer pipeline for RTSP stream",
      pid: child.pid,
      gst_command: GST_WRAPPER ? `${GST_WRAPPER} ${GST_COMMAND}` : GST_COMMAND,
    });
  } catch (err) {
    console.error("Error in openRtspInGst:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to launch GStreamer pipeline",
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
      // maybe not running; try SIGKILL
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
