require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const Waitlist = require("./waitlist");
const morgan = require("morgan");

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("dev"));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// 📌 API Route: Join Waitlist
app.post("/api/waitlist", async (req, res) => {
  try {
    const { email } = req.body;

    // Email Validation
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, reason: "Invalid email format." });
    }

    // Check if Email Already Exists
    const existingUser = await Waitlist.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, reason: "Email already registered." });
    }

    // Save to Database
    await Waitlist.create({ email });

    // Success Response
    res.json({ success: true, message: "Successfully joined the waitlist!" });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      success: false,
      reason: "Server error. Please try again later.",
    });
  }
});

// Start Server
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
