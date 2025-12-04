import { Router } from "express";
import {
  getAllAlarms,
  getAlarmById,
  createAlarm,
  updateAlarm,
  deleteAlarm,
  getAlarmsByArea,
  getAlarmSensors,
} from "../controllers/alarmController.js";

const router = Router();

router.route("/").get(getAllAlarms).post(createAlarm);

router.route("/area/:areaId").get(getAlarmsByArea);

router.route("/:id").get(getAlarmById).put(updateAlarm).delete(deleteAlarm);

router.route("/:id/sensors").get(getAlarmSensors);

export default router;
