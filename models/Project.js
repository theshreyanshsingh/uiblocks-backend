const mongoose = require("mongoose");
const crypto = require("crypto");

// Define Project Schema
const ProjectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    originalInput: {
      type: String,
    },
    memory: {
      type: String,
    },
    csslibrary: {
      type: String,
      required: true,
      trim: true,
    },
    framework: {
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
    url: {
      type: String,
    },
    lastResponder: { type: String, enum: ["user", "ai"] },
    isResponseCompleted: { type: Boolean, default: false },
    enh_prompt: String,
    images: [String],
    isPinned: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    status: { type: String, default: "active", enum: ["active", "deleted"] },
  },
  { timestamps: true }
);

ProjectSchema.index({ generatedName: 1 }, { unique: true });

// Create Model
const Project = mongoose.model("Project", ProjectSchema);

module.exports = Project;
