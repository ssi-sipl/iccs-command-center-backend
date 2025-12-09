import prisma from "../lib/prisma.js";

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

    if (!tileRoot || typeof tileRoot !== "string") {
      return res.status(400).json({
        success: false,
        error: "tileRoot is required and must be a string",
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
        tileRoot: tileRoot.trim(), // e.g. "/maps/manekshaw"
        minZoom: minZoomNum,
        maxZoom: maxZoomNum,
        north: northNum,
        south: southNum,
        east: eastNum,
        west: westNum,
      },
    });

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
