require("dotenv").config();

module.exports = {
  DB: process.env.DB || "",
  PORT: process.env.PORT || 7730,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_REGION: process.env.AWS_REGION || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  MONGO_URI: process.env.MONGO_URI || "",
  RESEND_KEY: process.env.RESEND || "",
};
