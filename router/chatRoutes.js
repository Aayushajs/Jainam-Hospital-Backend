// routes/chatRoutes.js
import express from "express";
import { sendMessage, getMessages,deleteChatMessages } from "../controller/chatController.js";

const router = express.Router();

router.post("/send", sendMessage);
router.get("/messages/:roomId", getMessages);
router.delete("/delete/:roomId/:messageId", deleteChatMessages);

export default router;