import prisma from "../lib/prisma.js";

/**
 * @desc    Get all drone flight history
 * @route   GET /api/flight-history
 * @access  Public
 */
const getAllFlightHistory = async (req, res) => {
  try {
    const {
      droneDbId,
      sensorId,
      alertId,
      limit = 100,
      skip = 0,
      sortBy = "dispatchedAt",
      sortOrder = "desc",
    } = req.query;

    const whereClause = {};
    if (droneDbId) whereClause.droneDbId = droneDbId;
    if (sensorId) whereClause.sensorId = sensorId;
    if (alertId) whereClause.alertId = alertId;

    const flightHistory = await prisma.droneFlightHistory.findMany({
      where: Object.keys(whereClause).length ? whereClause : undefined,
      orderBy: { [sortBy]: sortOrder },
      skip: Number(skip),
      take: Number(limit),
      include: {
        drone: true,
      },
    });

    const total = await prisma.droneFlightHistory.count({
      where: Object.keys(whereClause).length ? whereClause : undefined,
    });

    res.status(200).json({
      success: true,
      count: flightHistory.length,
      data: flightHistory,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
        hasMore: Number(skip) + Number(limit) < total,
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

/**
 * @desc    Get single flight history by ID
 * @route   GET /api/flight-history/:id
 */
const getFlightHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const flight = await prisma.droneFlightHistory.findUnique({
      where: { id },
      include: { drone: true },
    });

    if (!flight) {
      return res.status(404).json({
        success: false,
        error: "Flight history not found",
      });
    }

    res.status(200).json({ success: true, data: flight });
  } catch (error) {
    console.error("Error fetching flight history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight history",
    });
  }
};

/**
 * @desc    Get flight history by Drone DB ID
 * @route   GET /api/flight-history/drone/:droneDbId
 */
const getFlightHistoryByDrone = async (req, res) => {
  try {
    const { droneDbId } = req.params;

    const flights = await prisma.droneFlightHistory.findMany({
      where: { droneDbId },
      orderBy: { dispatchedAt: "desc" },
      include: { drone: true },
    });

    res.status(200).json({
      success: true,
      count: flights.length,
      data: flights,
    });
  } catch (error) {
    console.error("Error fetching flight history by drone:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight history",
    });
  }
};

/**
 * @desc    Get flight history by Sensor ID
 * @route   GET /api/flight-history/sensor/:sensorId
 */
const getFlightHistoryBySensor = async (req, res) => {
  try {
    const { sensorId } = req.params;

    const flights = await prisma.droneFlightHistory.findMany({
      where: { sensorId },
      orderBy: { dispatchedAt: "desc" },
      include: { drone: true },
    });

    res.status(200).json({
      success: true,
      count: flights.length,
      data: flights,
    });
  } catch (error) {
    console.error("Error fetching flight history by sensor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight history",
    });
  }
};

/**
 * @desc    Get flight history by Alert ID
 * @route   GET /api/flight-history/alert/:alertId
 */
const getFlightHistoryByAlert = async (req, res) => {
  try {
    const { alertId } = req.params;

    const flights = await prisma.droneFlightHistory.findMany({
      where: { alertId },
      orderBy: { dispatchedAt: "desc" },
      include: { drone: true },
    });

    res.status(200).json({
      success: true,
      count: flights.length,
      data: flights,
    });
  } catch (error) {
    console.error("Error fetching flight history by alert:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch flight history",
    });
  }
};

/**
 * @desc    Delete flight history
 * @route   DELETE /api/flight-history/:id
 */
const deleteFlightHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.droneFlightHistory.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Flight history not found",
      });
    }

    await prisma.droneFlightHistory.delete({ where: { id } });

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

export {
  getAllFlightHistory,
  getFlightHistoryById,
  getFlightHistoryByDrone,
  getFlightHistoryBySensor,
  getFlightHistoryByAlert,
  deleteFlightHistory,
};
