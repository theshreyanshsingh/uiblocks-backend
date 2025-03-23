require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const Waitlist = require("./waitlist");
const morgan = require("morgan");
const userRoutes = require("./routes/userRoutes");
const { MONGO_URI, PORT } = require("./config");
const Beta = require("./models/BetaAccess");
const Otps = require("./models/Otps");
const { sendEmail } = require("./helpers/SendEmail");
const { ResendEmail } = require("./helpers/Resend");

// Initialize Express App
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
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
        .json({ success: false, message: "Invalid email format." });
    }

    // Check if Email Already Exists
    const existingUser = await Waitlist.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered." });
    }

    // Save to Database
    await Waitlist.create({ email });

    // Success Response
    res.json({ success: true, message: "Successfully joined the waitlist!" });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// Verify beta Access
app.post("/api/verify-beta", async (req, res) => {
  try {
    const { email, name, otp } = req.body;

    // Validate Email Format
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res
        .status(203)
        .json({ success: false, message: "Invalid email format." });
    }

    // Check if Email is Already Registered
    const existingUser = await Beta.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered." });
    }

    // Find OTP
    const checkOtp = await Otps.findOne({ email, otp });
    if (!checkOtp) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    // Check OTP Expiry (10 minutes)
    const otpAge = (Date.now() - new Date(checkOtp.createdAt)) / (1000 * 60); // Convert to minutes
    if (otpAge > 10) {
      return res
        .status(400)
        .json({ success: false, message: "OTP expired. Request a new one." });
    }

    // Save User to Beta Database
    await Beta.create({ email, name });

    // Send Welcome Email
    await ResendEmail({
      from: "noreply@uiblocks.xyz",
      to: email,
      subject: `Welcome, ${name} – UIblocks Beta Access!`,
      //       bodyText: `Hi ${name},

      // We’re delighted to have you with us! UIblocks is here for people like you — making it fast and painless to create beautiful, responsive apps without losing the reins.

      // We're built to help you end your frustrations and bring your ideas and dreams to reality.

      // You’re joining 150+ passionate creators, devs, founders and designers who are shaping the future of digital experiences. We’re eager to hear your ideas and see what you’ll craft as we grow this together.

      // Next Steps: Check your inbox soon for your access details and a quick guide to get started. We’re excited for what’s ahead!

      // Note: You may check your spam folder. If you didn't received the email.

      // Thanks for being here,
      // It means a lot to us!

      // The UIblocks Team`,
      html: `<!DOCTYPE html>
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
  .highlight-link {
    color: white;
    text-decoration: none;
    font-weight: bold;
    transition: color 0.3s ease-in-out;
  }
  .highlight-link:hover {
    color: #cccccc;
  }
  .cta-button {
    display: inline-block;
    margin-top: 15px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: bold;
    text-align: center;
    text-decoration: none;
    color: #141414;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(255, 255, 255, 0.2);
    transition: background 0.3s ease, transform 0.2s ease;
  }
  .cta-button:hover {
    background-color: #dddddd;
    transform: translateY(-2px);
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
    <p>
      We’re delighted to have you with us! 
      <a href="https://uiblocks.xyz" class="highlight-link"><strong>UIblocks</strong></a> 
      is here for ambitious developers, founders, and designers, who are making it fast and effortless to build stunning, responsive apps without losing creative control.
    </p>
    <p>
      We’re built to help you turn ideas into reality and remove the friction from bringing your vision to life.
    </p>
    <p>
      You’re joining <strong>150+ passionate devs, designers and founders</strong> who are shaping the future of digital experiences. 
      We can’t wait to see what you’ll create as we grow this journey together.
    </p>
    
    <p><span class="highlight">Next Steps:</span></p>
    <p>
      We will send the access details and instructions straight to your inbox soon. 
      If you don’t see the email, please check your spam folder.
    </p>
    
    <div class="divider"></div>

    <p>Thanks for being here,<br><span class="team">The UIblocks Team</span></p>
    <p>It means a lot to us!</p>

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

    // Delete OTP After Successful Verification
    await Otps.deleteOne({ email, otp });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
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
        .status(203)
        .json({ success: false, message: "Invalid email format." });
    }

    // Check if Email Already Exists
    const existingUser = await Beta.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered." });
    }

    // Make a 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    // Save to Database
    await Otps.create({ email, name, otp });

    await ResendEmail({
      from: "noreply@uiblocks.xyz",
      to: email,
      subject: `Your OTP for UIblocks Beta Access!`,
      //   bodyText: `Hi ${name},

      // Your One-Time Password (OTP) for verification: **${otp}**

      // This OTP is valid for the next 10 minutes. Please use it to complete your the process.

      // The UIblocks Team`,
      html: `<!DOCTYPE html>
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
          .otp-box {
            font-size: 24px;
            font-weight: bold;
            color: #ffffff;
            background: rgba(255, 255, 255, 0.1);
            padding: 10px 20px;
            border-radius: 8px;
            display: inline-block;
            margin: 15px 0;
            letter-spacing: 2px;
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
          <p>Your One-Time Password (OTP) for verification:</p>
          <div class="otp-box">${otp}</div>
          <p>This OTP is valid for the next <strong>10 minutes</strong>. Please use it to complete the process.</p>
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
      message: "done!",
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// Start Server
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
