import prisma from "../lib/prisma.js";

// @desc    Get all drone OS settings
// @route   GET /api/droneos
// @access  Public
// const getAllDroneOS = async (req, res) => {
//   try {
//     const { areaId, include } = req.query;

//     // Build where clause
//     const whereClause = {};
//     if (areaId) whereClause.areaId = areaId;

//     const droneOSSettings = await prisma.droneOS.findMany({
//       where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
//       include: {
//         area: include === "true",
//       },
//       orderBy: {
//         createdAt: "desc",
//       },
//     });

//     res.status(200).json({
//       success: true,
//       count: droneOSSettings.length,
//       data: droneOSSettings,
//     });
//   } catch (error) {
//     console.error("Error fetching drone OS settings:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch drone OS settings",
//     });
//   }
// };

const getAllDroneOS = async (req, res) => {
  try {
    const { areaId, include, search } = req.query;

    // pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // build where clause
    const whereClause = {
      ...(areaId ? { areaId } : {}),
      ...(search
        ? {
            OR: [
              {
                droneId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                droneOSName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                droneType: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                gpsName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                addedBy: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    // total count for pagination
    const totalCount = await prisma.droneOS.count({
      where: whereClause,
    });

    const droneOSSettings = await prisma.droneOS.findMany({
      where: whereClause,
      include: {
        area: include === "true",
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    res.status(200).json({
      success: true,
      data: droneOSSettings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching drone OS settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch drone OS settings",
    });
  }
};

const getDroneStats = async (req, res) => {
  try {
    const [total, assigned, unassigned] = await Promise.all([
      prisma.droneOS.count(),
      prisma.droneOS.count({
        where: { areaId: { not: null } },
      }),
      prisma.droneOS.count({
        where: { areaId: null },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        assigned,
        unassigned,
      },
    });
  } catch (error) {
    console.error("Error fetching drone stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch drone stats",
    });
  }
};

// @desc    Get single drone OS by ID
// @route   GET /api/droneos/:id
// @access  Public
const getDroneOSById = async (req, res) => {
  try {
    const { id } = req.params;
    const { include } = req.query;

    const droneOS = await prisma.droneOS.findUnique({
      where: { id },
      include: {
        area: include === "true",
      },
    });

    if (!droneOS) {
      return res.status(404).json({
        success: false,
        error: "Drone OS setting not found",
      });
    }

    res.status(200).json({
      success: true,
      data: droneOS,
    });
  } catch (error) {
    console.error("Error fetching drone OS:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch drone OS",
    });
  }
};

// @desc    Create new drone OS setting
// @route   POST /api/droneos
// @access  Public
const createDroneOS = async (req, res) => {
  try {
    const {
      droneId,
      droneOSName,
      droneType,
      videoLink,
      gpsFix,
      minHDOP,
      minSatCount,
      maxWindSpeed,
      droneSpeed,
      targetAltitude,
      gpsLost,
      telemetryLost,
      minBatteryLevel,
      usbAddress,
      batteryFailSafe,
      gpsName,
      maxAltitude,
      areaId,
      latitude,
      longitude,
      addedBy,
    } = req.body;

    // Validation - required fields
    if (
      !droneId ||
      !droneOSName ||
      !droneType ||
      !gpsFix ||
      minHDOP === undefined ||
      minSatCount === undefined ||
      maxWindSpeed === undefined ||
      droneSpeed === undefined ||
      targetAltitude === undefined ||
      !gpsLost ||
      !telemetryLost ||
      minBatteryLevel === undefined ||
      !usbAddress ||
      !batteryFailSafe ||
      !gpsName ||
      maxAltitude === undefined ||
      !latitude ||
      !longitude
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (addedBy && typeof addedBy !== "string") {
      return res.status(400).json({
        success: false,
        error: "addedBy must be a string",
      });
    }

    // Check if droneId already exists
    const existingDrone = await prisma.droneOS.findUnique({
      where: { droneId },
    });

    if (existingDrone) {
      return res.status(409).json({
        success: false,
        error: "Drone ID already exists",
      });
    }

    // Verify area exists if areaId is provided
    if (areaId) {
      const areaExists = await prisma.area.findUnique({
        where: { id: areaId },
      });

      if (!areaExists) {
        return res.status(404).json({
          success: false,
          error: "Area not found",
        });
      }
    }

    // Validate minHDOP range (0 to 1)
    if (minHDOP < 0 || minHDOP > 1) {
      return res.status(400).json({
        success: false,
        error: "Min HDOP must be between 0 and 1",
      });
    }

    // Validate minSatCount range (0 to 8)
    if (minSatCount < 0 || minSatCount > 8) {
      return res.status(400).json({
        success: false,
        error: "Min Sat Count must be between 0 and 8",
      });
    }

    // Validate positive values
    if (maxWindSpeed < 0) {
      return res.status(400).json({
        success: false,
        error: "Max Wind Speed must be a positive value",
      });
    }

    if (droneSpeed < 0) {
      return res.status(400).json({
        success: false,
        error: "Drone Speed must be a positive value",
      });
    }

    if (targetAltitude < 0) {
      return res.status(400).json({
        success: false,
        error: "Target Altitude must be a positive value",
      });
    }

    if (maxAltitude < 0) {
      return res.status(400).json({
        success: false,
        error: "Max Altitude must be a positive value",
      });
    }

    if (minBatteryLevel < 0 || minBatteryLevel > 100) {
      return res.status(400).json({
        success: false,
        error: "Min Battery Level must be between 0 and 100",
      });
    }

    // Create drone OS setting
    const droneOS = await prisma.droneOS.create({
      data: {
        droneId,
        droneOSName,
        droneType,
        videoLink: videoLink || null,
        gpsFix,
        minHDOP: parseFloat(minHDOP),
        minSatCount: parseInt(minSatCount),
        maxWindSpeed: parseFloat(maxWindSpeed),
        droneSpeed: parseFloat(droneSpeed),
        targetAltitude: parseFloat(targetAltitude),
        gpsLost,
        telemetryLost,
        minBatteryLevel: parseFloat(minBatteryLevel),
        usbAddress,
        batteryFailSafe,
        gpsName,
        maxAltitude: parseFloat(maxAltitude),
        areaId: areaId || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        addedBy: addedBy || "",
      },
      include: {
        area: true,
      },
    });

    res.status(201).json({
      success: true,
      data: droneOS,
      message: "Drone OS setting created successfully",
    });
  } catch (error) {
    console.error("Error creating drone OS:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create drone OS setting",
    });
  }
};

// @desc    Update drone OS by ID
// @route   PUT /api/droneos/:id
// @access  Public
const updateDroneOS = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      droneId,
      droneOSName,
      droneType,
      videoLink,
      gpsFix,
      minHDOP,
      minSatCount,
      maxWindSpeed,
      droneSpeed,
      targetAltitude,
      gpsLost,
      telemetryLost,
      minBatteryLevel,
      usbAddress,
      batteryFailSafe,
      gpsName,
      maxAltitude,
      areaId,
      latitude,
      longitude,
    } = req.body;

    // Check if drone OS exists
    const existingDroneOS = await prisma.droneOS.findUnique({
      where: { id },
    });

    if (!existingDroneOS) {
      return res.status(404).json({
        success: false,
        error: "Drone OS setting not found",
      });
    }

    // Check if new droneId conflicts with existing drone
    if (droneId && droneId !== existingDroneOS.droneId) {
      const droneIdConflict = await prisma.droneOS.findUnique({
        where: { droneId },
      });

      if (droneIdConflict) {
        return res.status(409).json({
          success: false,
          error: "Drone ID already exists",
        });
      }
    }

    // Verify area exists if areaId is provided
    if (areaId) {
      const areaExists = await prisma.area.findUnique({
        where: { id: areaId },
      });

      if (!areaExists) {
        return res.status(404).json({
          success: false,
          error: "Area not found",
        });
      }
    }

    // Validate minHDOP if provided
    if (minHDOP !== undefined && (minHDOP < 0 || minHDOP > 1)) {
      return res.status(400).json({
        success: false,
        error: "Min HDOP must be between 0 and 1",
      });
    }

    // Validate minSatCount if provided
    if (minSatCount !== undefined && (minSatCount < 0 || minSatCount > 8)) {
      return res.status(400).json({
        success: false,
        error: "Min Sat Count must be between 0 and 8",
      });
    }

    // Validate positive values if provided
    if (maxWindSpeed !== undefined && maxWindSpeed < 0) {
      return res.status(400).json({
        success: false,
        error: "Max Wind Speed must be a positive value",
      });
    }

    if (droneSpeed !== undefined && droneSpeed < 0) {
      return res.status(400).json({
        success: false,
        error: "Drone Speed must be a positive value",
      });
    }

    if (targetAltitude !== undefined && targetAltitude < 0) {
      return res.status(400).json({
        success: false,
        error: "Target Altitude must be a positive value",
      });
    }

    if (maxAltitude !== undefined && maxAltitude < 0) {
      return res.status(400).json({
        success: false,
        error: "Max Altitude must be a positive value",
      });
    }

    if (
      minBatteryLevel !== undefined &&
      (minBatteryLevel < 0 || minBatteryLevel > 100)
    ) {
      return res.status(400).json({
        success: false,
        error: "Min Battery Level must be between 0 and 100",
      });
    }

    // Build update data object
    const updateData = {};
    if (droneId) updateData.droneId = droneId;
    if (droneOSName) updateData.droneOSName = droneOSName;
    if (droneType) updateData.droneType = droneType;
    if (videoLink !== undefined) updateData.videoLink = videoLink || null;
    if (gpsFix) updateData.gpsFix = gpsFix;
    if (minHDOP !== undefined) updateData.minHDOP = parseFloat(minHDOP);
    if (minSatCount !== undefined)
      updateData.minSatCount = parseInt(minSatCount);
    if (maxWindSpeed !== undefined)
      updateData.maxWindSpeed = parseFloat(maxWindSpeed);
    if (droneSpeed !== undefined)
      updateData.droneSpeed = parseFloat(droneSpeed);
    if (targetAltitude !== undefined)
      updateData.targetAltitude = parseFloat(targetAltitude);
    if (gpsLost) updateData.gpsLost = gpsLost;
    if (telemetryLost) updateData.telemetryLost = telemetryLost;
    if (minBatteryLevel !== undefined)
      updateData.minBatteryLevel = parseFloat(minBatteryLevel);
    if (usbAddress) updateData.usbAddress = usbAddress;
    if (batteryFailSafe) updateData.batteryFailSafe = batteryFailSafe;
    if (gpsName) updateData.gpsName = gpsName;
    if (maxAltitude !== undefined)
      updateData.maxAltitude = parseFloat(maxAltitude);
    if (areaId !== undefined) updateData.areaId = areaId || null;
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude);

    // Update drone OS
    const updatedDroneOS = await prisma.droneOS.update({
      where: { id },
      data: updateData,
      include: {
        area: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedDroneOS,
      message: "Drone OS setting updated successfully",
    });
  } catch (error) {
    console.error("Error updating drone OS:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update drone OS setting",
    });
  }
};

// @desc    Delete drone OS by ID
// @route   DELETE /api/droneos/:id
// @access  Public
const deleteDroneOS = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if drone OS exists
    const existingDroneOS = await prisma.droneOS.findUnique({
      where: { id },
    });

    if (!existingDroneOS) {
      return res.status(404).json({
        success: false,
        error: "Drone OS setting not found",
      });
    }

    // Delete drone OS
    await prisma.droneOS.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Drone OS setting deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting drone OS:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete drone OS setting",
    });
  }
};

// @desc    Get drones by area ID
// @route   GET /api/droneos/area/:areaId
// @access  Public
const getDronesByArea = async (req, res) => {
  try {
    const { areaId } = req.params;
    const { include } = req.query;

    // Verify area exists
    const areaExists = await prisma.area.findUnique({
      where: { id: areaId },
    });

    if (!areaExists) {
      return res.status(404).json({
        success: false,
        error: "Area not found",
      });
    }

    const drones = await prisma.droneOS.findMany({
      where: { areaId },
      include: {
        area: include === "true",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      count: drones.length,
      data: drones,
    });
  } catch (error) {
    console.error("Error fetching drones by area:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch drones",
    });
  }
};

export {
  getAllDroneOS,
  getDroneOSById,
  createDroneOS,
  updateDroneOS,
  deleteDroneOS,
  getDronesByArea,
  getDroneStats,
};
