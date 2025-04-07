const express = require("express");
const router = express.Router();
const {
  createProject,
  getProject,
  getMessages,
  saveProject,
  saveMessage,
  presigned,
  saveMemory,
  getAllProjects,
  updateProject,
} = require("../controllers/Projects");

router.post("/build-project", createProject);

router.get("/get-project", getProject);

router.post("/get-presigned-url", presigned);

//get all projects
router.post("/get-all-projects", getAllProjects);

//messages
router.post("/get-messages", getMessages);

//save messages
router.post("/save-message", saveMessage);

//save project
router.post("/save-project", saveProject);

//save memory
router.post("/save-memory", saveMemory);

//update project
router.post("/update-project", updateProject);

module.exports = router;
