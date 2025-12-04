import { Router } from "express";
import {
  getAllDroneOS,
  getDroneOSById,
  createDroneOS,
  updateDroneOS,
  deleteDroneOS,
} from "../controllers/droneosController.js";

const router = Router();

router.route("/").get(getAllDroneOS).post(createDroneOS);

router
  .route("/:id")
  .get(getDroneOSById)
  .put(updateDroneOS)
  .delete(deleteDroneOS);

export default router;
