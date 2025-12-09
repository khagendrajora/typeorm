import { Router } from "express";
import {
  createUser,
  deleteUser,
  getAll,
  getById,
  update,
} from "../controllers/usercontroller";

const router = Router();

router.post("/users", createUser);
router.get("/get", getAll);
router.get("/get/:id", getById);
router.put("/update/:id", update);
router.delete("/delete/:id", deleteUser);

export default router;
