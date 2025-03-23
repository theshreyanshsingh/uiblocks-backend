const mongoose = require("mongoose");
const crypto = require("crypto");

// Define Project Schema
const ProjectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    generatedName: {
      type: String,
      default: () => crypto.randomBytes(8).toString("hex"), 
      unique: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Create Model
const Project = mongoose.model("Project", ProjectSchema);

module.exports = Project;