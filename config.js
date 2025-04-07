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
  GEMINI_API_KEY_1: process.env.GEMINI_API_KEY_1 || "",
  GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2 || "",
  BUCKET_NAME: process.env.BUCKET_NAME,
  BUCKET_REGION: process.env.BUCKET_REGION,
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
  BUCKET_URL: process.env.BUCKET_URL,
  CLOUDFRONTID: process.env.CLOUDFRONTID,
};
