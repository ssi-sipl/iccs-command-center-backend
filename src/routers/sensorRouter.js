import { Router } from "express";
import {
  getAllSensors,
  getSensorById,
  createSensor,
  updateSensor,
  deleteSensor,
  getSensorsByArea,
  sendDroneToSensor,
} from "../controllers/sensorController.js";

const router = Router();

router.route("/").get(getAllSensors).post(createSensor);

router.route("/area/:areaId").get(getSensorsByArea);

router.route("/:id").get(getSensorById).put(updateSensor).delete(deleteSensor);

router.post("/:sensorDbId/send-drone", sendDroneToSensor);

export default router;
