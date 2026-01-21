import { Router } from "express";
import {
  getAllDroneOS,
  getDroneOSById,
  createDroneOS,
  updateDroneOS,
  deleteDroneOS,
  getDronesByArea,
  getDroneStats,
} from "../controllers/droneosController.js";

const router = Router();

router.get("/stats", getDroneStats);

router.route("/").get(getAllDroneOS).post(createDroneOS);

router
  .route("/:id")
  .get(getDroneOSById)
  .put(updateDroneOS)
  .delete(deleteDroneOS);

router.get("/area/:areaId", getDronesByArea);

export default router;
