const express = require("express");
const { handleAgentRequest, oldagent } = require("../controllers/agent");
const router = express.Router();

router.post("/v1/agent", handleAgentRequest);
router.post("/old/agent", oldagent);

module.exports = router;
