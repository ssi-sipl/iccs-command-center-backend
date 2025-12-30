import express from "express";
import { sendDrone } from "../controllers/droneCommandController.js";

const router = express.Router();

router.route("/").post(sendDrone);

export default router;
