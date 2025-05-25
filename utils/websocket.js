import { Server } from "socket.io";
import VideoCall from "../models/videocall.schema.js";
let io;

export const initializeWebSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.FRONTEND_URL_ONE, 
        process.env.FRONTEND_URL_TWO,
        process.env.FRONTEND_URL_ONE1,
        process.env.FRONTEND_URL_TWO2
      ],
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
       allowedHeaders: ["Content-Type", "Authorization"]
    },
     transports: ['websocket', 'polling'] // Important for compatibility
  });

  // Active call timers storage
  const callTimers = new Map();

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Chat functionality
    socket.on("join_room", (roomId) => {
      socket.join(roomId);
      console.log(`User joined room: ${roomId}`);
    });

    socket.on("send_message", (data) => {
      io.to(data.room).emit("receive_message", data);
    });

    // Video call functionality
    socket.on("join_video_call", async ({ roomId, userId, userType }) => {
      try {
        socket.join(roomId);
        console.log(`${userType} ${userId} joined video call room: ${roomId}`);

        // Notify others in the room
        socket.to(roomId).emit("user_joined", { userId, userType });

        // Update call status if first participant
        const call = await VideoCall.findOne({ roomId });
        if (call && call.status === 'scheduled') {
          call.status = 'ongoing';
          await call.save();

          // Start timer if not already started
          if (!callTimers.has(roomId)) {
            const endTime = new Date(call.scheduledAt.getTime() + call.duration * 60000);
            const timeRemaining = endTime - new Date();
            
            if (timeRemaining > 0) {
              const timer = setTimeout(() => {
                endVideoCall(roomId);
                callTimers.delete(roomId);
              }, timeRemaining);
              
              callTimers.set(roomId, timer);
            }
          }
        }
      } catch (error) {
        console.error("Error joining video call:", error);
      }
    });

    // WebRTC signaling
    socket.on("offer", (data) => {
      socket.to(data.roomId).emit("offer", data);
    });

    socket.on("answer", (data) => {
      socket.to(data.roomId).emit("answer", data);
    });

    socket.on("ice-candidate", (data) => {
      socket.to(data.roomId).emit("ice-candidate", data);
    });

    // End call manually
    socket.on("end_call", ({ roomId }) => {
      endVideoCall(roomId);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      // Clean up any call timers if this was the last participant
    });
  });

  return io;
};

// Helper function to end video calls
async function endVideoCall(roomId) {
  try {
    const call = await VideoCall.findOneAndUpdate(
      { roomId },
      { status: 'completed', endedAt: new Date() },
      { new: true }
    );

    if (call) {
      io.to(roomId).emit("call_ended", { 
        roomId,
        endedAt: new Date(),
        duration: call.duration
      });
      
      // Clear timer if exists
      if (callTimers.has(roomId)) {
        clearTimeout(callTimers.get(roomId));
        callTimers.delete(roomId);
      }
    }
  } catch (error) {
    console.error("Error ending video call:", error);
  }
}

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
