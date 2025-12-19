import prisma from "../lib/prisma.js";

// @desc    Get all drone flight history
// @route   GET /api/flight-history
// @access  Public
const getAllFlightHistory = async (req, res) => {
  try {
    const {
      status,
      droneId,
      sensorId,
      alertId,
      limit = 100,
      skip = 0,
      sortBy = "dispatchedAt",
      sortOrder = "desc",
    } = req.query;

    // Build where clause
    const whereClause = {};
    if (status) whereClause.status = status;
    if (droneId) whereClause.droneId = droneId;
    if (sensorId) whereClause.sensorId = sensorId;
    if (alertId) whereClause.alertId = alertId;

    const limitNum = parseInt(limit, 10) || 100;
    const skipNum = parseInt(skip, 10) || 0;

    const validSortFields = ["dispatchedAt", "completedAt", "createdAt"];
    const validSortOrders = ["asc", "desc"];

    const sortField = validSortFields.includes(sortBy)
      ? sortBy
      : "dispatchedAt";
    const sortDirection = validSortOrders.includes(sortOrder)
      ? sortOrder
      : "desc";

    const flightHistory = await prisma.droneFlightHistory.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      orderBy: { [sortField]: sortDirection },
      skip: skipNum,
      take: limitNum,
      include: {
        drone: true,
        alert: true,
        sensor: true,
        area: true,
      },
    });

    const totalCount = await prisma.droneFlightHistory.count({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    });

    res.status(200).json({
      success: true,
      count: flightHistory.length,
      data: flightHistory,
      pagination: {
        total: totalCount,
        limit: limitNum,
        skip: skipNum,
        hasMore: skipNum + limitNum < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching flight history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight history",
    });
  }
};

// @desc    Get single flight history by ID
// @route   GET /api/flight-history/:id
// @access  Public
const getFlightHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const flightHistory = await prisma.droneFlightHistory.findUnique({
      where: { id },
      include: {
        drone: true,
        alert: true,
        sensor: true,
        area: true,
      },
    });

    if (!flightHistory) {
      return res.status(404).json({
        success: false,
        error: "Flight history not found",
      });
    }

    res.status(200).json({
      success: true,
      data: flightHistory,
    });
  } catch (error) {
    console.error("Error fetching flight history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight history",
    });
  }
};

// @desc    Get flight history by drone ID (business droneId)
// @route   GET /api/flight-history/drone/:droneId
// @access  Public
const getFlightHistoryByDrone = async (req, res) => {
  try {
    const { droneId } = req.params;
    const { limit = 100, skip = 0 } = req.query;

    const limitNum = parseInt(limit, 10) || 100;
    const skipNum = parseInt(skip, 10) || 0;

    const flightHistory = await prisma.droneFlightHistory.findMany({
      where: { droneId },
      orderBy: { dispatchedAt: "desc" },
      skip: skipNum,
      take: limitNum,
      include: {
        drone: true,
        alert: true,
        sensor: true,
        area: true,
      },
    });

    const totalCount = await prisma.droneFlightHistory.count({
      where: { droneId },
    });

    res.status(200).json({
      success: true,
      count: flightHistory.length,
      data: flightHistory,
      pagination: {
        total: totalCount,
        limit: limitNum,
        skip: skipNum,
        hasMore: skipNum + limitNum < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching flight history by drone:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight history",
    });
  }
};

// @desc    Get flight history by sensor ID (business sensorId)
// @route   GET /api/flight-history/sensor/:sensorId
// @access  Public
const getFlightHistoryBySensor = async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { limit = 100, skip = 0 } = req.query;

    const limitNum = parseInt(limit, 10) || 100;
    const skipNum = parseInt(skip, 10) || 0;

    const flightHistory = await prisma.droneFlightHistory.findMany({
      where: { sensorId },
      orderBy: { dispatchedAt: "desc" },
      skip: skipNum,
      take: limitNum,
      include: {
        drone: true,
        alert: true,
        sensor: true,
        area: true,
      },
    });

    const totalCount = await prisma.droneFlightHistory.count({
      where: { sensorId },
    });

    res.status(200).json({
      success: true,
      count: flightHistory.length,
      data: flightHistory,
      pagination: {
        total: totalCount,
        limit: limitNum,
        skip: skipNum,
        hasMore: skipNum + limitNum < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching flight history by sensor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight history",
    });
  }
};

// @desc    Get flight history by alert ID (business alertId)
// @route   GET /api/flight-history/alert/:alertId
// @access  Public
const getFlightHistoryByAlert = async (req, res) => {
  try {
    const { alertId } = req.params;

    const flightHistory = await prisma.droneFlightHistory.findMany({
      where: { alertId },
      orderBy: { dispatchedAt: "desc" },
      include: {
        drone: true,
        alert: true,
        sensor: true,
        area: true,
      },
    });

    res.status(200).json({
      success: true,
      count: flightHistory.length,
      data: flightHistory,
    });
  } catch (error) {
    console.error("Error fetching flight history by alert:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight history",
    });
  }
};

// @desc    Update flight history (for updating status, completion, etc.)
// @route   PUT /api/flight-history/:id
// @access  Public
const updateFlightHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      completedAt,
      flightDuration,
      batteryUsed,
      maxAltitude,
      distanceCovered,
      notes,
      metadata,
    } = req.body;

    // Check if flight history exists
    const existingFlightHistory = await prisma.droneFlightHistory.findUnique({
      where: { id },
    });

    if (!existingFlightHistory) {
      return res.status(404).json({
        success: false,
        error: "Flight history not found",
      });
    }

    // Build update data object
    const updateData = {};
    if (status) updateData.status = status;
    if (completedAt !== undefined)
      updateData.completedAt = completedAt ? new Date(completedAt) : null;
    if (flightDuration !== undefined)
      updateData.flightDuration = parseInt(flightDuration);
    if (batteryUsed !== undefined)
      updateData.batteryUsed = parseFloat(batteryUsed);
    if (maxAltitude !== undefined)
      updateData.maxAltitude = parseFloat(maxAltitude);
    if (distanceCovered !== undefined)
      updateData.distanceCovered = parseFloat(distanceCovered);
    if (notes !== undefined) updateData.notes = notes;
    if (metadata !== undefined) updateData.metadata = metadata;

    // Update flight history
    const updatedFlightHistory = await prisma.droneFlightHistory.update({
      where: { id },
      data: updateData,
      include: {
        drone: true,
        alert: true,
        sensor: true,
        area: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedFlightHistory,
      message: "Flight history updated successfully",
    });
  } catch (error) {
    console.error("Error updating flight history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update flight history",
    });
  }
};

// @desc    Delete flight history by ID
// @route   DELETE /api/flight-history/:id
// @access  Public
const deleteFlightHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if flight history exists
    const existingFlightHistory = await prisma.droneFlightHistory.findUnique({
      where: { id },
    });

    if (!existingFlightHistory) {
      return res.status(404).json({
        success: false,
        error: "Flight history not found",
      });
    }

    // Delete flight history
    await prisma.droneFlightHistory.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Flight history deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting flight history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete flight history",
    });
  }
};

// @desc    Get flight statistics
// @route   GET /api/flight-history/stats
// @access  Public
const getFlightStatistics = async (req, res) => {
  try {
    const { droneId, sensorId, startDate, endDate } = req.query;

    // Build where clause
    const whereClause = {};
    if (droneId) whereClause.droneId = droneId;
    if (sensorId) whereClause.sensorId = sensorId;

    if (startDate || endDate) {
      whereClause.dispatchedAt = {};
      if (startDate) whereClause.dispatchedAt.gte = new Date(startDate);
      if (endDate) whereClause.dispatchedAt.lte = new Date(endDate);
    }

    const totalFlights = await prisma.droneFlightHistory.count({
      where: whereClause,
    });

    const completedFlights = await prisma.droneFlightHistory.count({
      where: { ...whereClause, status: "Completed" },
    });

    const inFlightFlights = await prisma.droneFlightHistory.count({
      where: { ...whereClause, status: "In Flight" },
    });

    const abortedFlights = await prisma.droneFlightHistory.count({
      where: { ...whereClause, status: "Aborted" },
    });

    // Get average flight duration for completed flights
    const flightsWithDuration = await prisma.droneFlightHistory.findMany({
      where: {
        ...whereClause,
        status: "Completed",
        flightDuration: { not: null },
      },
      select: {
        flightDuration: true,
        batteryUsed: true,
        distanceCovered: true,
      },
    });

    const avgDuration =
      flightsWithDuration.length > 0
        ? flightsWithDuration.reduce(
            (sum, f) => sum + (f.flightDuration || 0),
            0
          ) / flightsWithDuration.length
        : 0;

    const avgBattery =
      flightsWithDuration.length > 0
        ? flightsWithDuration.reduce(
            (sum, f) => sum + (f.batteryUsed || 0),
            0
          ) / flightsWithDuration.length
        : 0;

    const avgDistance =
      flightsWithDuration.length > 0
        ? flightsWithDuration.reduce(
            (sum, f) => sum + (f.distanceCovered || 0),
            0
          ) / flightsWithDuration.length
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalFlights,
        completedFlights,
        inFlightFlights,
        abortedFlights,
        averages: {
          flightDuration: Math.round(avgDuration),
          batteryUsed: Math.round(avgBattery * 100) / 100,
          distanceCovered: Math.round(avgDistance * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching flight statistics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight statistics",
    });
  }
};

export {
  getAllFlightHistory,
  getFlightHistoryById,
  getFlightHistoryByDrone,
  getFlightHistoryBySensor,
  getFlightHistoryByAlert,
  updateFlightHistory,
  deleteFlightHistory,
  getFlightStatistics,
};
