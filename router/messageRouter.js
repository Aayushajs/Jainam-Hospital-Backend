import express from "express";
import {
  DeleteMessage,
  getAllMessages,
  sendMessage,
} from "../controller/messageController.js";
import { isAdminAuthenticated } from "../middlewares/auth.js";
const router = express.Router();

router.post("/send", sendMessage);
router.get("/getall", isAdminAuthenticated, getAllMessages);   // --> redis used
router.delete("/delete/:id", isAdminAuthenticated, DeleteMessage);

export default router;
