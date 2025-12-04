import express from "express";
import {
  getAllAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea,
} from "../controllers/areaController.js";

const router = express.Router();

router.route("/").get(getAllAreas).post(createArea);

router.route("/:id").get(getAreaById).put(updateArea).delete(deleteArea);

export default router;
