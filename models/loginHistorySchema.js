import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: ["Admin", "Doctor"],
    required: true,
  },
  action: {
    type: String,
    enum: ["login", "logout"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Indexes to support common queries (filter by userId, role and recent records)
loginHistorySchema.index({ userId: 1 });
loginHistorySchema.index({ role: 1 });
loginHistorySchema.index({ timestamp: -1 });

export default mongoose.model("LoginHistory", loginHistorySchema);
