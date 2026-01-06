import express from "express";
import {
  createUser,
  deleteUser,
  deactivateUser,
  getAllUsers,
} from "../controllers/adminUserController.js";
import { requireMasterAuth } from "../middleware/masterAuth.js";

const router = express.Router();

/**
 * MASTER ONLY ROUTES
 */

router.get("/", requireMasterAuth, getAllUsers);
router.post("/create", requireMasterAuth, createUser);
router.delete("/:userId", requireMasterAuth, deleteUser);
router.patch("/:userId/deactivate", requireMasterAuth, deactivateUser);

export default router;
