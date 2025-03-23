require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const Waitlist = require("./waitlist");
const morgan = require("morgan");
const userRoutes = require("./routes/userRoutes");
const { MONGO_URI, PORT } = require("./config");
const Beta = require("./models/BetaAccess");
const Otps = require("./models/Otps");
const { sendEmail } = require("./helpers/SendEmail");

// Initialize Express App
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("dev"));

// Routes
app.use("/api", userRoutes);

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
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

// Verify beta Access
app.post("/api/verify-beta", async (req, res) => {
  try {
    const { email, name, otp } = req.body;

    // Email Validation
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, reason: "Invalid email format." });
    }

    // Check if Email Already Exists
    const existingUser = await Beta.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, reason: "Email already registered." });
    }

    const checkOtp = await Otps.findOne({ email, otp });
    if (checkOtp) {
      // Save to Database
      await Beta.create({ email, name });

      await sendEmail({
        from: "uiblocks.xyz",
        to: email,
        subject: "Welcome to UIblocks, ${name} – Let’s Build Something Great!",
        bodyText: `Hi ${name},
      
      We’re delighted to have you with us! UIblocks is here for developers and designers like you—making it fast and painless to create beautiful, responsive interfaces apps losing the reins.
      
      We're build to help you end your frustrations, bring your ideas and dreams to reality.

      You’re joining over 100 passionate creators who are shaping the future of digital experiences. We’re eager to hear your ideas and see what you’ll craft as we grow this together.
      
      Next Steps: Check your inbox soon for your access details and a quick guide to get started. We’re excited for what’s ahead!
      
      Thanks for being here,
      The UIblocks Team`,
        bodyHtml: `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            background-color: #141414;
            color: #ffffff;
            font-family: 'Helvetica', 'Arial', sans-serif;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 620px;
            margin: 30px auto;
            padding: 35px;
            background-color: #141414;
            border-radius: 12px;
            border: 1px solid #2a2a2a;
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
          }
          .header {
            font-size: 28px;
            color: #ffffff;
            margin: 0 0 25px;
            font-weight: 300;
            letter-spacing: 0.5px;
          }
          p {
            font-size: 16px;
            line-height: 1.7;
            color: #ffffff;
            margin: 0 0 20px;
          }
          .highlight {
            color: #ffffff;
            font-weight: bold;
            background: rgba(255, 255, 255, 0.1);
            padding: 3px 10px;
            border-radius: 5px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          }
          .team {
            font-style: italic;
            color: #e0e0e0;
            font-size: 15px;
          }
          .divider {
            width: 50px;
            height: 2px;
            background-color: #ffffff;
            opacity: 0.2;
            margin: 25px auto;
          }
          .footer {
            font-size: 13px;
            color: #bbbbbb;
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #2a2a2a;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Hi ${name},</div>
          <p>We’re delighted to have you with us! <strong>UIblocks</strong> is here for developers and designers like you—making it fast and painless to create beautiful, responsive apps without losing the reins.</p>
          <p> We're build to help you end your frustrations, bring your ideas and dreams to reality.</p>
          <p>You’re joining over 100 passionate creators who are shaping the future of digital experiences. We’re eager to hear your ideas and see what you’ll craft as we grow this together.</p>
          <p><span class="highlight">Next Steps:</span> Check your inbox soon for your access details and a quick guide to get started. We’re excited for what’s ahead!</p>
          <div class="divider"></div>
          <p>Thanks for being here,<br><span class="team">The UIblocks Team</span></p>
          <div class="footer">
            © 2025 UIblocks. All rights reserved.
          </div>
        </div>
      </body>
      </html>`,
      });
      // Success Response
      res.json({
        success: true,
        message: "Successfully joined the beta access!",
      });
    } else {
      res.status(204).json({
        success: false,
        reason: "Failed.",
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      success: false,
      reason: "Server error. Please try again later.",
    });
  }
});

// Join Beta Access
app.post("/api/join-beta", async (req, res) => {
  try {
    const { email, name } = req.body;

    // Email Validation
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, reason: "Invalid email format." });
    }

    // Check if Email Already Exists
    const existingUser = await Beta.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, reason: "Email already registered." });
    }

    // Save to Database
    await Otps.create({ email, name });

    // Success Response
    res.json({
      success: true,
      message: "done!",
    });
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
