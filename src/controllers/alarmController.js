import prisma from "../lib/prisma.js";

// @desc    Get all alarms
// @route   GET /api/alarms
// @access  Public
const getAllAlarms = async (req, res) => {
  try {
    const { status, areaId, include } = req.query;

    // Build where clause
    const whereClause = {};
    if (status) whereClause.status = status;
    if (areaId) whereClause.areaId = areaId;

    const alarms = await prisma.alarm.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        area: include === "true",
        sensors: include === "true",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      count: alarms.length,
      data: alarms,
    });
  } catch (error) {
    console.error("Error fetching alarms:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch alarms",
    });
  }
};

// @desc    Get single alarm by ID
// @route   GET /api/alarms/:id
// @access  Public
const getAlarmById = async (req, res) => {
  try {
    const { id } = req.params;
    const { include } = req.query;

    const alarm = await prisma.alarm.findUnique({
      where: { id },
      include: {
        area: include === "true",
        sensors: include === "true",
      },
    });

    if (!alarm) {
      return res.status(404).json({
        success: false,
        error: "Alarm not found",
      });
    }

    res.status(200).json({
      success: true,
      data: alarm,
    });
  } catch (error) {
    console.error("Error fetching alarm:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch alarm",
    });
  }
};

// @desc    Create new alarm
// @route   POST /api/alarms
// @access  Public
const createAlarm = async (req, res) => {
  try {
    const { alarmId, name, status, areaId } = req.body;

    // Validation
    if (!alarmId || !name) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: alarmId, name",
      });
    }

    // Check if alarmId already exists
    const existingAlarm = await prisma.alarm.findUnique({
      where: { alarmId },
    });

    if (existingAlarm) {
      return res.status(409).json({
        success: false,
        error: "Alarm ID already exists",
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

    // Create alarm
    const alarm = await prisma.alarm.create({
      data: {
        alarmId,
        name,
        status: status || "Active",
        areaId: areaId || null,
      },
      include: {
        area: true,
      },
    });

    res.status(201).json({
      success: true,
      data: alarm,
      message: "Alarm created successfully",
    });
  } catch (error) {
    console.error("Error creating alarm:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create alarm",
    });
  }
};

// @desc    Update alarm by ID
// @route   PUT /api/alarms/:id
// @access  Public
const updateAlarm = async (req, res) => {
  try {
    const { id } = req.params;
    const { alarmId, name, status, areaId } = req.body;

    // Check if alarm exists
    const existingAlarm = await prisma.alarm.findUnique({
      where: { id },
    });

    if (!existingAlarm) {
      return res.status(404).json({
        success: false,
        error: "Alarm not found",
      });
    }

    // Check if new alarmId conflicts with existing alarm
    if (alarmId && alarmId !== existingAlarm.alarmId) {
      const alarmIdConflict = await prisma.alarm.findUnique({
        where: { alarmId },
      });

      if (alarmIdConflict) {
        return res.status(409).json({
          success: false,
          error: "Alarm ID already exists",
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

    // Build update data object
    const updateData = {};
    if (alarmId) updateData.alarmId = alarmId;
    if (name) updateData.name = name;
    if (status) updateData.status = status;
    if (areaId !== undefined) updateData.areaId = areaId;

    // Update alarm
    const updatedAlarm = await prisma.alarm.update({
      where: { id },
      data: updateData,
      include: {
        area: true,
        sensors: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedAlarm,
      message: "Alarm updated successfully",
    });
  } catch (error) {
    console.error("Error updating alarm:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update alarm",
    });
  }
};

// @desc    Delete alarm by ID
// @route   DELETE /api/alarms/:id
// @access  Public
const deleteAlarm = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if alarm exists
    const existingAlarm = await prisma.alarm.findUnique({
      where: { id },
      include: {
        sensors: true,
      },
    });

    if (!existingAlarm) {
      return res.status(404).json({
        success: false,
        error: "Alarm not found",
      });
    }

    // Delete alarm (sensors' alarmId will be set to null due to SetNull in schema)
    await prisma.alarm.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Alarm deleted successfully",
      affectedSensors: existingAlarm.sensors.length,
    });
  } catch (error) {
    console.error("Error deleting alarm:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete alarm",
    });
  }
};

// @desc    Get alarms by area ID
// @route   GET /api/alarms/area/:areaId
// @access  Public
const getAlarmsByArea = async (req, res) => {
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

    const alarms = await prisma.alarm.findMany({
      where: { areaId },
      include: {
        area: include === "true",
        sensors: include === "true",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      count: alarms.length,
      data: alarms,
    });
  } catch (error) {
    console.error("Error fetching alarms by area:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch alarms",
    });
  }
};

// @desc    Get sensors associated with an alarm
// @route   GET /api/alarms/:id/sensors
// @access  Public
const getAlarmSensors = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if alarm exists
    const alarm = await prisma.alarm.findUnique({
      where: { id },
      include: {
        sensors: {
          include: {
            area: true,
          },
        },
      },
    });

    if (!alarm) {
      return res.status(404).json({
        success: false,
        error: "Alarm not found",
      });
    }

    res.status(200).json({
      success: true,
      count: alarm.sensors.length,
      data: alarm.sensors,
    });
  } catch (error) {
    console.error("Error fetching alarm sensors:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch alarm sensors",
    });
  }
};

export {
  getAllAlarms,
  getAlarmById,
  createAlarm,
  updateAlarm,
  deleteAlarm,
  getAlarmsByArea,
  getAlarmSensors,
};
