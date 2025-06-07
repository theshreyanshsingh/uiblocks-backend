const { oldagent } = require("../helpers/oldagent.js");
const { startAgent } = require("../v1/Agent.js");

exports.handleAgentRequest = async (req, res) => {
  try {
    const {
      prompt,
      feedbackResponse,
      requestId,
      projectId,
      userId,
      history,
      terminal,
      code,
    } = req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== "string") {
      console.log("Invalid prompt:", prompt);
      return res.status(400).json({
        error: "Prompt is required and must be a string",
      });
    }

    // Set SSE headers
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();

    // Start agent processing directly writing to res
    await startAgent(
      prompt,
      projectId,
      history,
      userId,
      res, // pass res instead of writer
      terminal,
      code
    );
  } catch (error) {
    console.error("Error in agent route:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    res.write(`data: Error: ${message}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
};

exports.oldagent = async (req, res) => {
  try {
    const { prompt, memory, cssLib, framework, images, projectId, owner } =
      req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== "string") {
      console.log("Invalid prompt:", prompt);
      return res.status(400).json({
        error: "Prompt is required and must be a string",
      });
    }

    // Set SSE headers
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();

    // Start agent processing directly writing to res
    await oldagent(
      prompt,
      memory,
      cssLib,
      framework,
      images,
      projectId,
      owner,
      res
    );
  } catch (error) {
    console.error("Error in agent route:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    res.write(`data: Error: ${message}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
};
