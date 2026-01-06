import prisma from "../lib/prisma.js";
import fs from "fs";
import path from "path";
import axios from "axios";

const ESRI_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// 🔒 Active download control registry
const activeMapDownloads = new Map();
/*
  mapId => {
    cancelled: boolean
  }
*/

function lonToX(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function latToY(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

function deleteMapDirectory(mapId) {
  const dirPath = path.join(process.cwd(), "public", "maps", mapId);

  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, {
      recursive: true,
      force: true, // 👈 very important (no throw if partially locked)
    });
  }
}

async function startMapTileDownload(mapId) {
  try {
    const map = await prisma.offlineMap.findUnique({ where: { id: mapId } });
    if (!map) return;

    const cancelToken = { cancelled: false };
    activeMapDownloads.set(mapId, cancelToken);

    console.log(`[MAP] ⬇️ Download started for map ${mapId}`);

    const baseDir = path.join(process.cwd(), "public", "maps", mapId);

    fs.mkdirSync(baseDir, { recursive: true });

    await prisma.offlineMap.update({
      where: { id: mapId },
      data: { downloadStatus: "DOWNLOADING", downloadProgress: 0 },
    });

    let totalTiles = 0;
    let downloaded = 0;

    // Pre-calc tile count
    for (let z = map.minZoom; z <= map.maxZoom; z++) {
      const x1 = lonToX(map.west, z);
      const x2 = lonToX(map.east, z);
      const y1 = latToY(map.north, z);
      const y2 = latToY(map.south, z);
      totalTiles += (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1);
    }

    for (let z = map.minZoom; z <= map.maxZoom; z++) {
      const xStart = lonToX(map.west, z);
      const xEnd = lonToX(map.east, z);
      const yStart = latToY(map.north, z);
      const yEnd = latToY(map.south, z);

      for (let x = Math.min(xStart, xEnd); x <= Math.max(xStart, xEnd); x++) {
        for (let y = Math.min(yStart, yEnd); y <= Math.max(yStart, yEnd); y++) {
          if (cancelToken.cancelled) {
            console.warn(
              `[MAP] 🛑 Download cancelled mid-way for map ${mapId}`
            );
            throw new Error("DOWNLOAD_CANCELLED");
          }

          const tileDir = path.join(baseDir, `${z}`, `${x}`);
          const tilePath = path.join(tileDir, `${y}.jpg`);

          if (fs.existsSync(tilePath)) {
            downloaded++;
            continue;
          }

          fs.mkdirSync(tileDir, { recursive: true });

          const url = ESRI_TILE_URL.replace("{z}", z)
            .replace("{x}", x)
            .replace("{y}", y);

          try {
            const res = await axios.get(url, {
              responseType: "arraybuffer",
              timeout: 15000,
            });

            fs.writeFileSync(tilePath, res.data);
            downloaded++;
          } catch (err) {
            console.error("Tile failed:", z, x, y);
          }

          // Update progress every 25 tiles
          if (downloaded % 25 === 0) {
            const progress = Math.min(
              99,
              Math.floor((downloaded / totalTiles) * 100)
            );

            await prisma.offlineMap.update({
              where: { id: mapId },
              data: { downloadProgress: progress },
            });
          }

          // Rate limiting (VERY important)
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }

    await prisma.offlineMap.update({
      where: { id: mapId },
      data: {
        downloadStatus: "READY",
        downloadProgress: 100,
      },
    });
  } catch (err) {
    if (String(err.message).includes("DOWNLOAD_CANCELLED")) {
      console.warn(`[MAP] ⛔ Download aborted for map ${mapId}`);
    } else {
      console.error("Map download failed:", err);

      await prisma.offlineMap.update({
        where: { id: mapId },
        data: {
          downloadStatus: "FAILED",
          downloadError: String(err),
        },
      });
    }
  } finally {
    // 🧹 STEP 4 — CLEANUP
    activeMapDownloads.delete(mapId);
  }
}

/**
 * GET /api/maps
 * List all offline maps
 */
async function getMaps(req, res) {
  try {
    const maps = await prisma.offlineMap.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      data: maps,
      count: maps.length,
    });
  } catch (err) {
    console.error("Error in getMaps:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * GET /api/maps/active
 * Get the currently active map (if any)
 */
async function getActiveMap(req, res) {
  try {
    const map = await prisma.offlineMap.findFirst({
      where: { isActive: true },
    });

    return res.json({
      success: true,
      data: map || null,
    });
  } catch (err) {
    console.error("Error in getActiveMap:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * POST /api/maps
 * Body:
 * {
 *   name: string,
 *   description?: string,
 *   tileRoot: string,      // e.g. "/maps/manekshaw"
 *   minZoom: number,
 *   maxZoom: number,
 *   north: number,
 *   south: number,
 *   east: number,
 *   west: number
 * }
 */
async function createMap(req, res) {
  try {
    const {
      name,
      description,
      tileRoot,
      minZoom,
      maxZoom,
      north,
      south,
      east,
      west,
    } = req.body || {};

    // Basic validation
    if (!name || typeof name !== "string") {
      return res.status(400).json({
        success: false,
        error: "name is required and must be a string",
      });
    }

    const minZoomNum = Number(minZoom);
    const maxZoomNum = Number(maxZoom);
    const northNum = Number(north);
    const southNum = Number(south);
    const eastNum = Number(east);
    const westNum = Number(west);

    if (
      [minZoomNum, maxZoomNum, northNum, southNum, eastNum, westNum].some((v) =>
        Number.isNaN(v)
      )
    ) {
      return res.status(400).json({
        success: false,
        error:
          "minZoom, maxZoom, north, south, east, west must all be valid numbers",
      });
    }

    if (minZoomNum < 0 || maxZoomNum < minZoomNum) {
      return res.status(400).json({
        success: false,
        error: "Zoom range is invalid (check minZoom/maxZoom)",
      });
    }

    if (northNum <= southNum) {
      return res.status(400).json({
        success: false,
        error: "north must be greater than south",
      });
    }

    if (eastNum <= westNum) {
      return res.status(400).json({
        success: false,
        error: "east must be greater than west",
      });
    }

    const created = await prisma.offlineMap.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,

        // IMPORTANT: tileRoot is now mapId-based
        tileRoot: `/maps`, // base root only

        minZoom: minZoomNum,
        maxZoom: maxZoomNum,
        north: northNum,
        south: southNum,
        east: eastNum,
        west: westNum,

        downloadStatus: "PENDING",
        downloadProgress: 0,
      },
    });

    // 🔥 start download asynchronously (do NOT await)
    startMapTileDownload(created.id);

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err) {
    console.error("Error in createMap:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * POST /api/maps/:id/active
 * Set the given map as active, unset all others
 */
async function setActiveMap(req, res) {
  try {
    const { id } = req.params;

    const map = await prisma.offlineMap.findUnique({
      where: { id },
    });

    if (!map) {
      return res.status(404).json({
        success: false,
        error: "Map not found",
      });
    }

    const [_, updated] = await prisma.$transaction([
      prisma.offlineMap.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      prisma.offlineMap.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("Error in setActiveMap:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * DELETE /api/maps/:id
 * Only delete if not active
 */
async function deleteMap(req, res) {
  try {
    const { id } = req.params;

    const map = await prisma.offlineMap.findUnique({
      where: { id },
    });

    // 🔴 STEP 5 — CANCEL ACTIVE DOWNLOAD (IF ANY)
    const activeDownload = activeMapDownloads.get(id);
    if (activeDownload) {
      console.warn(`[MAP] 🛑 Cancelling download due to map deletion (${id})`);
      activeDownload.cancelled = true;
    }

    if (!map) {
      return res.status(404).json({
        success: false,
        error: "Map not found",
      });
    }

    if (map.isActive) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete active map. Set another map as active first.",
      });
    }

    try {
      deleteMapDirectory(id);
    } catch (fsErr) {
      console.error("Failed to delete map directory:", fsErr);
      return res.status(500).json({
        success: false,
        error: "Failed to delete map files from disk",
      });
    }

    await prisma.offlineMap.delete({
      where: { id },
    });

    return res.json({
      success: true,
      data: null,
    });
  } catch (err) {
    console.error("Error in deleteMap:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

export { getMaps, getActiveMap, createMap, setActiveMap, deleteMap };
