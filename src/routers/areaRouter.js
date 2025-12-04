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

// now i want to optimzationally integerate apis in the area -          the base url is this http://localhost:5000/api/area and this is the area router as seen in my backend - import express from "express";

// import {

//   getAllAreas,

//   getAreaById,

//   createArea,

//   updateArea,

//   deleteArea,

// } from "../controllers/areaController.js";

// const router = express.Router();

// router.route("/").get(getAllAreas).post(createArea);

// router.route("/:id").get(getAreaById).put(updateArea).delete(deleteArea);

// export default router;               how to integerate these apis in my ui
