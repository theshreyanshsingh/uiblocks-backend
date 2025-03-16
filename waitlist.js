const mongoose = require("mongoose");

// Define Schema
const WaitlistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // Ensure unique emails
      trim: true,
      lowercase: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Create Model
const Waitlist = mongoose.model("Waitlist", WaitlistSchema);

module.exports = Waitlist;
