const mongoose = require("mongoose");

// Define User Schema
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    plan: {
      type: String,
      default: "free",
      enum: ["free", "premium", "enterprise"], 
    },
    numberOfProjects: {
      type: Number,
      default: 0,
    },
    session: {
      type: String,
      default: null,
    },
    projects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Create Model
const User = mongoose.model("User", UserSchema);

module.exports = User;