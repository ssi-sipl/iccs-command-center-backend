import prisma from "../lib/prisma.js";

// @desc    Get all areas
// @route   GET /api/areas
// @access  Public
const getAllAreas = async (req, res) => {
  try {
    const { status, include } = req.query;

    const areas = await prisma.area.findMany({
      where: status ? { status } : undefined,
      include: {
        sensors: include === "true",
        alarms: include === "true",
        drones: include === "true",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      count: areas.length,
      data: areas,
    });
  } catch (error) {
    console.error("Error at areaController/getAllAreas:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch areas",
    });
  }
};

// @desc    Get single area by ID
// @route   GET /api/areas/:id
// @access  Public
const getAreaById = async (req, res) => {
  try {
    const { id } = req.params;
    const { include } = req.query;

    const area = await prisma.area.findUnique({
      where: { id },
      include: {
        sensors: include === "true",
        alarms: include === "true",
        drones: include === "true",
      },
    });

    if (!area) {
      return res.status(404).json({
        success: false,
        error: "Area not found",
      });
    }

    res.status(200).json({
      success: true,
      data: area,
    });
  } catch (error) {
    console.error("Error at areaController/getAreaById:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch area",
    });
  }
};

// @desc    Create new area
// @route   POST /api/areas
// @access  Public
const createArea = async (req, res) => {
  try {
    const { areaId, name, latitude, longitude, status, addedBy } = req.body;

    // Validation
    if (!areaId || !name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: areaId, name, latitude, longitude",
      });
    }

    if (addedBy && typeof addedBy !== "string") {
      return res.status(400).json({
        success: false,
        error: "addedBy must be a string",
      });
    }

    // Validate latitude range (-90 to 90)
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        error: "Latitude must be between -90 and 90",
      });
    }

    // Validate longitude range (-180 to 180)
    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error: "Longitude must be between -180 and 180",
      });
    }

    // Check if areaId already exists
    const existingArea = await prisma.area.findUnique({
      where: { areaId },
    });

    if (existingArea) {
      return res.status(409).json({
        success: false,
        error: "Area ID already exists",
      });
    }

    // Create area
    const area = await prisma.area.create({
      data: {
        areaId,
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status: status || "Active",
        addedBy: addedBy || "",
      },
    });

    res.status(201).json({
      success: true,
      data: area,
      message: "Area created successfully",
    });
  } catch (error) {
    console.error("Error at areaController/createArea:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create area",
    });
  }
};

// @desc    Update area by ID
// @route   PUT /api/areas/:id
// @access  Public
const updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { areaId, name, latitude, longitude, status } = req.body;

    // Check if area exists
    const existingArea = await prisma.area.findUnique({
      where: { id },
    });

    if (!existingArea) {
      return res.status(404).json({
        success: false,
        error: "Area not found",
      });
    }

    // Validate latitude if provided
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({
        success: false,
        error: "Latitude must be between -90 and 90",
      });
    }

    // Validate longitude if provided
    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({
        success: false,
        error: "Longitude must be between -180 and 180",
      });
    }

    // Check if new areaId conflicts with existing area
    if (areaId && areaId !== existingArea.areaId) {
      const areaIdConflict = await prisma.area.findUnique({
        where: { areaId },
      });

      if (areaIdConflict) {
        return res.status(409).json({
          success: false,
          error: "Area ID already exists",
        });
      }
    }

    // Build update data object
    const updateData = {};
    if (areaId) updateData.areaId = areaId;
    if (name) updateData.name = name;
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude);
    if (status) updateData.status = status;

    // Update area
    const updatedArea = await prisma.area.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      data: updatedArea,
      message: "Area updated successfully",
    });
  } catch (error) {
    console.error("Error at areaController/updateArea:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update area",
    });
  }
};

// @desc    Delete area by ID
// @route   DELETE /api/areas/:id
// @access  Public
const deleteArea = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if area exists
    const existingArea = await prisma.area.findUnique({
      where: { id },
      include: {
        sensors: true,
        alarms: true,
        drones: true,
      },
    });

    if (!existingArea) {
      return res.status(404).json({
        success: false,
        error: "Area not found",
      });
    }

    // Delete area (cascade will delete related sensors and alarms, drones will be set to null)
    await prisma.area.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Area deleted successfully",
      deletedRelations: {
        sensors: existingArea.sensors.length,
        alarms: existingArea.alarms.length,
        drones: existingArea.drones.length,
      },
    });
  } catch (error) {
    console.error("Error at areaController/deleteArea:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete area",
    });
  }
};

export { getAllAreas, getAreaById, createArea, updateArea, deleteArea };
