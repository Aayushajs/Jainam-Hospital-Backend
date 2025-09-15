// controllers/chatController.js
import { getIO } from "../utils/websocket.js";
import {redis} from "../config/redis.js"


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

export const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    const redisKey = `messages:room:${roomId}`;

    const cachedData = await redis.get(redisKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        cached: true,
        roomId,
        messages: JSON.parse(cachedData),
      });
    }

    const messages = chatMessages[roomId] || [];
    await redis.setEx(redisKey, 300, JSON.stringify(messages));

    res.status(200).json({
      success: true,
      cached: false,
      roomId,
      messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ success: false, message: "Failed to get messages" });
  }
};


// export const getMessages = (req, res) => {
//   const { roomId } = req.params;
//   res.status(200).json({
//     success: true,
//     roomId,
//     messages: chatMessages[roomId] || [],
//   });
// };




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
