const mongoose = require("mongoose");

// Define Project Schema
const SessionSchema = new mongoose.Schema(
  {
    session: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      enum: ["github", "google", "email"],
    },
  },
  { timestamps: true }
);

SessionSchema.index({ email: 1 }, { unique: true });

// Create Model
const Sessions = mongoose.model("Session", SessionSchema);

module.exports = Sessions;
