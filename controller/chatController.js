// controllers/chatController.js
import { getIO } from "../utils/websocket.js";

const chatMessages = {};

export const sendMessage = (req, res) => {
  const { roomId, sender, message } = req.body;
  
  if (!chatMessages[roomId]) {
    chatMessages[roomId] = [];
  }
   
  const newMessage = { 
    _id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    sender, 
    message, 
    timestamp: new Date() 
  };
  
  chatMessages[roomId].push(newMessage);
  
  getIO().to(roomId).emit("new_message", newMessage);
  
  res.status(200).json({ success: true, message: newMessage });
};

export const getMessages = (req, res) => {
  const { roomId } = req.params;
  res.status(200).json({
    success: true,
    roomId,
    messages: chatMessages[roomId] || [],
  });
};

// Delete specific chat messages
export const deleteChatMessages = (req, res) => {
  const { roomId, messageId } = req.params;

  if (!chatMessages[roomId]) {
    return res.status(404).json({ success: false, message: "Room not found" });
  }
  const messageIndex = chatMessages[roomId].findIndex(
    (msg) => msg._id === messageId || msg.timestamp === messageId
  );

  if (messageIndex === -1) {
    return res
      .status(404)
      .json({ success: false, message: "Message not found" });
  }

  const deletedMessage = chatMessages[roomId].splice(messageIndex, 1)[0];

  getIO().to(roomId).emit("message_deleted", {
    messageId,
  });

  res.status(200).json({
    success: true,
    message: "Message deleted successfully",
    deletedMessage,
  });
};
