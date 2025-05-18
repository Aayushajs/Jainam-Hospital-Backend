import mongoose from "mongoose";

const videoCallSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    doctorId: {
      type: String,
      ref: "User",
      required: true,
    },
    patientId: {
      type: String,
      ref: "User",
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    duration: {
      // in minutes
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed"],
      default: "scheduled",
    },
    endedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("VideoCall", videoCallSchema);
