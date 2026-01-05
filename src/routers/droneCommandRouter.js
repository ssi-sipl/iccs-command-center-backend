import express from "express";
import {
  dronePatrol,
  dropPayload,
  recallDrone,
  sendDrone,
} from "../controllers/droneCommandController.js";

const router = express.Router();

router.route("/").post(sendDrone);
router.route("/dropPayload").post(dropPayload);
router.route("/recallDrone").post(recallDrone);
router.route("/patrol").post(dronePatrol);

export default router;
