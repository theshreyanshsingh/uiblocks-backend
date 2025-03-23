const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Login controller
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        reason: "Email and password are required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        reason: "Invalid credentials",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        reason: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "1d" }
    );

    // Update user session
    user.session = token;
    await user.save();

    // Send response
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        numberOfProjects: user.numberOfProjects,
      },
    });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({
      success: false,
      reason: "Server error. Please try again later.",
    });
  }
};

exports.userData = async (req, res) => {
  try {
    const { email, provider, name } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      user.name = name;
      user.email = email;
      user.provider = provider;
      await user.save();
    }

    const characters = "abcdefghijklmnopqrstuvwxyz123456789";
    const projectId = Array.from({ length: 16 }, () =>
      characters.charAt(Math.floor(Math.random() * characters.length))
    ).join("");

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        plan: user.plan,
        numberOfProjects: user.numberOfProjects,
        projectId: projectId,
      },
    });
  } catch (error) {
    console.error("User Data Error:", error);
    res.status(500).json({
      success: false,
      reason: "Server error. Please try again later.",
    });
  }
};
