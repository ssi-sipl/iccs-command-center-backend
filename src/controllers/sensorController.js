import prisma from "../lib/prisma.js";

// @desc    Get all sensors
// @route   GET /api/sensors
// @access  Public
const getAllSensors = async (req, res) => {
  try {
    const { status, areaId, sensorType, include } = req.query;

    // Build where clause
    const whereClause = {};
    if (status) whereClause.status = status;
    if (areaId) whereClause.areaId = areaId;
    if (sensorType) whereClause.sensorType = sensorType;

    const sensors = await prisma.sensor.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        area: include === "true",
        alarm: include === "true",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      count: sensors.length,
      data: sensors,
    });
  } catch (error) {
    console.error("Error fetching sensors:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sensors",
    });
  }
};

// @desc    Get single sensor by ID
// @route   GET /api/sensors/:id
// @access  Public
const getSensorById = async (req, res) => {
  try {
    const { id } = req.params;
    const { include } = req.query;

    const sensor = await prisma.sensor.findUnique({
      where: { id },
      include: {
        area: include === "true",
        alarm: include === "true",
      },
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        error: "Sensor not found",
      });
    }

    res.status(200).json({
      success: true,
      data: sensor,
    });
  } catch (error) {
    console.error("Error fetching sensor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sensor",
    });
  }
};

// @desc    Create new sensor
// @route   POST /api/sensors
// @access  Public
const createSensor = async (req, res) => {
  try {
    const {
      sensorId,
      name,
      sensorType,
      latitude,
      longitude,
      ipAddress,
      battery,
      status,
      sendDrone,
      activeShuruMode,
      areaId,
      alarmId,
    } = req.body;

    // Validation
    if (
      !sensorId ||
      !name ||
      !sensorType ||
      latitude === undefined ||
      longitude === undefined ||
      !status ||
      !activeShuruMode
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: sensorId, name, sensorType, latitude, longitude, status, activeShuruMode",
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

    // Check if sensorId already exists
    const existingSensor = await prisma.sensor.findUnique({
      where: { sensorId },
    });

    if (existingSensor) {
      return res.status(409).json({
        success: false,
        error: "Sensor ID already exists",
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

    // Verify alarm exists if alarmId is provided
    if (alarmId) {
      const alarmExists = await prisma.alarm.findUnique({
        where: { id: alarmId },
      });

      if (!alarmExists) {
        return res.status(404).json({
          success: false,
          error: "Alarm not found",
        });
      }
    }

    // Create sensor
    const sensor = await prisma.sensor.create({
      data: {
        sensorId,
        name,
        sensorType,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        ipAddress: ipAddress || null,
        battery: battery || null,
        status,
        sendDrone: sendDrone || "No",
        activeShuruMode,
        areaId: areaId || null,
        alarmId: alarmId || null,
      },
      include: {
        area: true,
        alarm: true,
      },
    });

    res.status(201).json({
      success: true,
      data: sensor,
      message: "Sensor created successfully",
    });
  } catch (error) {
    console.error("Error creating sensor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create sensor",
    });
  }
};

// @desc    Update sensor by ID
// @route   PUT /api/sensors/:id
// @access  Public
const updateSensor = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sensorId,
      name,
      sensorType,
      latitude,
      longitude,
      ipAddress,
      battery,
      status,
      sendDrone,
      activeShuruMode,
      areaId,
      alarmId,
    } = req.body;

    // Check if sensor exists
    const existingSensor = await prisma.sensor.findUnique({
      where: { id },
    });

    if (!existingSensor) {
      return res.status(404).json({
        success: false,
        error: "Sensor not found",
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

    // Check if new sensorId conflicts with existing sensor
    if (sensorId && sensorId !== existingSensor.sensorId) {
      const sensorIdConflict = await prisma.sensor.findUnique({
        where: { sensorId },
      });

      if (sensorIdConflict) {
        return res.status(409).json({
          success: false,
          error: "Sensor ID already exists",
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

    // Verify alarm exists if alarmId is provided
    if (alarmId) {
      const alarmExists = await prisma.alarm.findUnique({
        where: { id: alarmId },
      });

      if (!alarmExists) {
        return res.status(404).json({
          success: false,
          error: "Alarm not found",
        });
      }
    }

    // Build update data object
    const updateData = {};
    if (sensorId) updateData.sensorId = sensorId;
    if (name) updateData.name = name;
    if (sensorType) updateData.sensorType = sensorType;
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude);
    if (ipAddress !== undefined) updateData.ipAddress = ipAddress;
    if (battery !== undefined) updateData.battery = battery;
    if (status) updateData.status = status;
    if (sendDrone) updateData.sendDrone = sendDrone;
    if (activeShuruMode) updateData.activeShuruMode = activeShuruMode;
    if (areaId !== undefined) updateData.areaId = areaId;
    if (alarmId !== undefined) updateData.alarmId = alarmId;

    // Update sensor
    const updatedSensor = await prisma.sensor.update({
      where: { id },
      data: updateData,
      include: {
        area: true,
        alarm: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedSensor,
      message: "Sensor updated successfully",
    });
  } catch (error) {
    console.error("Error updating sensor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update sensor",
    });
  }
};

// @desc    Delete sensor by ID
// @route   DELETE /api/sensors/:id
// @access  Public
const deleteSensor = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if sensor exists
    const existingSensor = await prisma.sensor.findUnique({
      where: { id },
    });

    if (!existingSensor) {
      return res.status(404).json({
        success: false,
        error: "Sensor not found",
      });
    }

    // Delete sensor
    await prisma.sensor.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Sensor deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting sensor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete sensor",
    });
  }
};

// @desc    Get sensors by area ID
// @route   GET /api/sensors/area/:areaId
// @access  Public
const getSensorsByArea = async (req, res) => {
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

    const sensors = await prisma.sensor.findMany({
      where: { areaId },
      include: {
        area: include === "true",
        alarm: include === "true",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      count: sensors.length,
      data: sensors,
    });
  } catch (error) {
    console.error("Error fetching sensors by area:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sensors",
    });
  }
};

export {
  getAllSensors,
  getSensorById,
  createSensor,
  updateSensor,
  deleteSensor,
  getSensorsByArea,
};
