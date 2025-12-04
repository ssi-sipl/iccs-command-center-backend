import { Router } from "express";
import {
  getAllSensors,
  getSensorById,
  createSensor,
  updateSensor,
  deleteSensor,
  getSensorsByArea,
} from "../controllers/sensorController.js";

const router = Router();

router.route("/").get(getAllSensors).post(createSensor);

router.route("/area/:areaId").get(getSensorsByArea);

router.route("/:id").get(getSensorById).put(updateSensor).delete(deleteSensor);

export default router;
