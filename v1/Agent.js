const { AzureChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");
const { searchWeb } = require("./Tools/SearchWeb");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");
const {
  Annotation,
  END,
  InMemoryStore,
  MemorySaver,
  START,
  StateGraph,
} = require("@langchain/langgraph");
const {
  BaseMessage,
  AIMessage,
  SystemMessage,
  HumanMessage,
} = require("@langchain/core/messages");
const {
  AssetPrompt,
  BackendPrompt,
  ExaminerPrompt,
  FeatureSuggestionPrompt,
  FrontendPrompt,
  LeaderPrompt,
  TerminalPrompt,
} = require("./Prompts");
const {
  LeaderOutputSchema,

  ExaminerSchema,

  FrontendSchema,

  BackendSchema,

  TerminalSchema,

  featSchema,
} = require("./Schemas");
const { MODEL_API_KEY, MODEL_API_POINT, MODEL_NAME } = require("../config");

const Message = require("../models/Message");
const User = require("../models/User");
const { saveMessageHelper } = require("../controllers/Projects");
const Plan = require("../models/Plan");
const Project = require("../models/Project");
const Code = require("../models/Code");

// tools
const tools = [...searchWeb()];
const toolNode = new ToolNode(tools);

// embeddings
const embeddings = new OpenAIEmbeddings({
  model: "gpt-4.1",
  apiKey: MODEL_API_KEY,
});

// memory
const memory = new MemorySaver();

// long-term memory
const store = new InMemoryStore({
  index: { embeddings, dims: 1536, fields: ["s"] },
});

const llm = async () => {
  const config = {
    model: MODEL_NAME,
    azureOpenAIApiKey: MODEL_API_KEY,
    azureOpenAIApiInstanceName: MODEL_NAME,
    azureOpenAIApiDeploymentName: MODEL_NAME,
    azureOpenAIApiVersion: "2024-04-01-preview",
    azureOpenAIEndpoint: MODEL_API_POINT,
    apiKey: MODEL_API_KEY,
    maxTokens: 20000,
    maxRetries: 3,
    streaming: true,
    callbacks: [
      {
        // handleLLMStart: async () => {
        //   console.log("Started LLM call");
        // },
        // handleLLMEnd: async (output) => {
        //   // console.log("Ended LLM", output.llmOutput);
        //   const tokenUsage = output.llmOutput?.tokenUsage || {};
        //   console.log("Token Usage:", {
        //     promptTokens: tokenUsage.promptTokens || 0,
        //     completionTokens: tokenUsage.completionTokens || 0,
        //     totalTokens: tokenUsage.totalTokens || 0,
        //   });
        // },
      },
    ],
  };

  return new AzureChatOpenAI(config).bindTools(tools);
};

const UsableAsset = {
  cloudfrontUrl: String,
  readableImage: String,
};

const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
  }),
  usableAssets: Annotation({
    reducer: (x, y) => x.concat(y),
  }),
  user_id: Annotation(),
  plan: Annotation(),
});

// Leader prompt template
const leadPrompt = ChatPromptTemplate.fromMessages([
  ["system", `{leaderPrompt}\n\n{formatInstructions}`],
  [
    "human",
    "All Messages - {conversationHistory}\n\nCurrent Message - {userInput}",
  ],
]);

const leadparser = StructuredOutputParser.fromZodSchema(LeaderOutputSchema);

// Asset prompt template
const examinPrompt = ChatPromptTemplate.fromMessages([
  ["system", `{examinerPrompt}\n\n{formatInstructions}`],
  [
    "human",
    "All Messages - {conversationHistory}\n\nCurrent Message - {userInput}",
  ],
]);

const examinerparser = StructuredOutputParser.fromZodSchema(ExaminerSchema);

// frontend prompt template
const frontPrompt = ChatPromptTemplate.fromMessages([
  ["system", `{frontendprompt}\n\n{formatInstructions}`],
  [
    "human",
    "All code written yet - {allcode} \n\nCurrent Plan - {plan} \n\nImage to get reference from - ${Image} \n\nAll Messages - {conversationHistory}\n\nCurrent Message - {userInput}",
  ],
]);

const frontparser = StructuredOutputParser.fromZodSchema(FrontendSchema);

// backend prompt template
const backPrompt = ChatPromptTemplate.fromMessages([
  ["system", `{backendprompt}\n\n{formatInstructions}`],
  [
    "human",
    "All code written yet - {allcode} \n\nCurrent Plan - {plan} \n\nAll Messages - {conversationHistory}\n\nCurrent Message - {userInput}",
  ],
]);

const backparser = StructuredOutputParser.fromZodSchema(BackendSchema);

// terminal prompt
const terminalPrompt = ChatPromptTemplate.fromMessages([
  ["system", `{terminalPrompt}\n\n{formatInstructions}`],
  ["human", "{userInput}"],
]);

const terminalParser = StructuredOutputParser.fromZodSchema(TerminalSchema);

// feature prompt
const featurePrompt = ChatPromptTemplate.fromMessages([
  ["system", `{featurePrompt}\n\n{formatInstructions}`],
  ["human", "{userInput}"],
]);

const featureParser = StructuredOutputParser.fromZodSchema(featSchema);

const createAgent = async (history, userId, projectId, plan, allcode) => {
  // leader node with all msg history
  const coreNode = async (state) => {
    let { messages } = state;

    try {
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";
      console.log(userInput, "core node");
      // Format the prompt with user input
      const formattedPrompt = await leadPrompt.formatPromptValue({
        leaderPrompt: LeaderPrompt(),
        userInput: String(userInput),
        formatInstructions: leadparser.getFormatInstructions(),
        conversationHistory: JSON.stringify(history),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      const nextNodeMatch = res.content.match(/"NextNode"\s*:\s*"([^"]+)"/);

      if (!nextNodeMatch) {
        saveMessageHelper({
          projectId,
          email: userId,
          role: "ai",
          text: res.content,
        });
      }

      // const parsedOutput = await leadparser.parse(res.content);
      // console.log("2", parsedOutput);

      return {
        messages: [
          new AIMessage({
            content: JSON.stringify(res.content, null, 2),
          }),
        ],
      };
    } catch (error) {
      console.log(error, "core node");
      return {
        messages: [
          new AIMessage({
            content:
              "I encountered an error processing your request. Let's try a simpler approach.",
          }),
        ],
      };
    }
  };

  // with only current msg
  const assetNode = async (state) => {
    let { messages } = state;
    try {
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";

      const allMessages = [new SystemMessage(AssetPrompt()), userInput];

      const res = await llmInstance.invoke(allMessages);

      return {
        messages: [res],
      };
    } catch (error) {
      return {
        messages: [
          new AIMessage({
            content:
              "I encountered an error processing your request. Let's try a simpler approach.",
          }),
        ],
      };
    }
  };

  // with current msg
  const ExaminerNode = async (state) => {
    try {
      const { messages } = state;
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";

      // Format the prompt with user input
      const formattedPrompt = await examinPrompt.formatPromptValue({
        examinerPrompt: ExaminerPrompt(),
        userInput: String(userInput),
        conversationHistory: JSON.stringify(history),
        formatInstructions: examinerparser.getFormatInstructions(),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();
      const res = await llmInstance.invoke(promptMessages);
      saveMessageHelper({
        projectId,
        email: userId,
        role: "ai",
        text: res.content,
        plan: res.content,
      });

      // const parsedOutput = await examinerparser.parse(res.content);

      return {
        messages: [
          new AIMessage({
            content: JSON.stringify(res.content, null, 2),
          }),
        ],
      };
    } catch (error) {
      console.log(error);
      return {
        messages: [
          new AIMessage({
            content:
              "I was planning but encountered an issue!\n Please try again.",
          }),
        ],
      };
    }
  };

  const FrontNode = async (state) => {
    try {
      const { messages } = state;
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";

      // Format the prompt with user input
      const formattedPrompt = await frontPrompt.formatPromptValue({
        frontendprompt: FrontendPrompt(),
        userInput: String(userInput),
        conversationHistory: JSON.stringify(history),
        plan: plan.text,
        Image: plan.ImagetoClone,
        allcode: allcode,
        formatInstructions: frontparser.getFormatInstructions(),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      function extractFileAndCode(jsonString) {
        try {
          // Extract the JSON part between ___start___ and ___end___
          const match = jsonString.match(/___start___([\s\S]*?)___end___/);
          if (!match) throw new Error("No JSON content found.");

          const jsonContent = JSON.parse(match[1]);
          const file = jsonContent.file;
          const code = jsonContent.code;

          return { file, code };
        } catch (error) {
          console.error("Failed to extract file and code:", error);
          return null;
        }
      }

      const result = extractFileAndCode(res.content);

      if (result) {
        const fullcode = await Code.findOne({
          user: userId,
          projectId: projectId,
        });

        if (fullcode) {
          const targetIndex = fullcode.files.findIndex(
            (f) => f.file === result.file
          );

          if (targetIndex === -1) {
            //file not found

            fullcode.files.push({ file: result.file, code: result.code });
            await fullcode.save();
          } else {
            //if file exists replace it

            fullcode.files[targetIndex].code = result.code;

            await fullcode.save();
          }

          console.log("saved");
        } else {
          await Code.create({
            projectId,
            user: userId,
            files: [{ file: result.file, code: result.code }], // Fixed: using 'files' instead of 'code'
          });
        }
      }

      saveMessageHelper({
        projectId,
        email: userId,
        role: "ai",
        text: res.content,
      });

      // const parsedOutput = await frontparser.parse(res.content);
      return {
        messages: [
          new AIMessage({
            content: JSON.stringify(res.content, null, 2),
          }),
        ],
      };
    } catch (error) {
      return {
        messages: [
          new AIMessage({
            content:
              "I was planning but encountered an issue!\n Please try again.",
          }),
        ],
      };
    }
  };

  const BackNode = async (state) => {
    try {
      const { messages } = state;
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";

      // Format the prompt with user input
      const formattedPrompt = await backPrompt.formatPromptValue({
        backendprompt: BackendPrompt(),
        userInput: String(userInput),
        conversationHistory: JSON.stringify(history),
        plan: plan.text,
        allcode: allcode,
        formatInstructions: backparser.getFormatInstructions(),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      // const parsedOutput = await backparser.parse(res.content);
      console.log("backend");

      function extractFileAndCode(jsonString) {
        try {
          // Extract the JSON part between ___start___ and ___end___
          const match = jsonString.match(/___start___([\s\S]*?)___end___/);
          if (!match) throw new Error("No JSON content found.");

          const jsonContent = JSON.parse(match[1]);
          const file = jsonContent.file;
          const code = jsonContent.code;

          return { file, code };
        } catch (error) {
          console.error("Failed to extract file and code:", error);
          return null;
        }
      }
      const result = extractFileAndCode(res.content);
      if (result) {
        const fullcode = await Code.findOne({
          user: userId,
          projectId: projectId,
        });

        if (fullcode) {
          const targetIndex = fullcode.files.findIndex(
            (f) => f.file === result.file
          );

          if (targetIndex === -1) {
            //file not found

            fullcode.files.push({ file: result.file, code: result.code });
            await fullcode.save();
          } else {
            //if file exists replace it

            fullcode.files[targetIndex].code = result.code;

            await fullcode.save();
          }

          console.log("saved");
        } else {
          await Code.create({
            projectId,
            user: userId,
            files: [{ file: result.file, code: result.code }], // Fixed: using 'files' instead of 'code'
          });
        }
      }

      saveMessageHelper({
        projectId,
        email: userId,
        role: "ai",
        text: res.content,
      });

      return {
        messages: [
          new AIMessage({
            content: JSON.stringify(res.content, null, 2),
          }),
        ],
      };
    } catch (error) {
      return {
        messages: [
          new AIMessage({
            content:
              "I was planning but encountered an issue!\n Please try again.",
          }),
        ],
      };
    }
  };

  const TerminalNode = async (state) => {
    try {
      const { messages } = state;
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";

      // Format the prompt with user input
      const formattedPrompt = await terminalPrompt.formatPromptValue({
        terminalPrompt: TerminalPrompt(),
        userInput: String([...history, userInput]),
        formatInstructions: terminalParser.getFormatInstructions(),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      const parsedOutput = await terminalParser.parse(res.content);
      console.log("terminal");

      return {
        messages: [
          new AIMessage({
            content: JSON.stringify(parsedOutput, null, 2),
          }),
        ],
      };
    } catch (error) {
      return {
        messages: [
          new AIMessage({
            content:
              "I was planning but encountered an issue!\n Please try again.",
          }),
        ],
      };
    }
  };

  const FeatureNode = async (state) => {
    try {
      const { messages } = state;
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";

      // Format the prompt with user input
      const formattedPrompt = await featurePrompt.formatPromptValue({
        featurePrompt: FeatureSuggestionPrompt(),
        userInput: String([...history, userInput]),
        formatInstructions: featureParser.getFormatInstructions(),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      const parsedOutput = await featureParser.parse(res.content);
      console.log("feat_sugges");

      return {
        messages: [
          new AIMessage({
            content: JSON.stringify(parsedOutput, null, 2),
          }),
        ],
      };
    } catch (error) {
      return {
        messages: [
          new AIMessage({
            content:
              "I was planning but encountered an issue!\n Please try again.",
          }),
        ],
      };
    }
  };

  const workflow = new StateGraph(AgentState)
    .addNode("agent", coreNode)
    .addNode("assets", assetNode)
    .addNode("tools", toolNode)
    .addNode("frontend", FrontNode)
    .addNode("backend", BackNode)
    .addNode("examiner", ExaminerNode)
    .addNode("terminal", TerminalNode)
    .addNode("feat_sugges", FeatureNode)
    .addEdge(START, "agent")
    .addEdge("assets", "tools")
    .addEdge("tools", "examiner")
    .addEdge("examiner", END)
    // Conditional routing after agent node
    .addConditionalEdges(
      "agent",
      async (state) => {
        // Get the last message from the agent
        const lastMessage = state.messages[state.messages.length - 1];

        let content = JSON.parse(lastMessage.content);

        if (typeof content === "string") {
          const nextNodeMatch = content.match(/"NextNode"\s*:\s*"([^"]+)"/);

          if (nextNodeMatch) {
            const nextNodeValue = nextNodeMatch[1];
            console.log(nextNodeValue, "forwarded to ");
            switch (nextNodeValue) {
              case "assets":
                return "assets";
              case "frontend":
                return "frontend";
              case "backend":
                return "backend";
              // Add other cases as needed
              default:
                console.log("Unknown NextNode value:", nextNodeValue);
                return END;
            }
          }
        }

        return END;
      },
      [
        "assets",
        "tools",
        "examiner",
        "frontend",
        "backend",
        "terminal",
        "feat_sugges",
        END,
      ]
    );
  // .addConditionalEdges(
  //   "tools",
  //   async (state) => {
  //     const lastMessage = state.messages[state.messages.length - 1];
  //     let content = lastMessage.content;
  //     console.log("tools done", content);
  //     return "examiner";
  //   },
  //   ["examiner", END]
  // );

  const compiledWorkflow = workflow.compile({
    checkpointer: memory,
    store: store,
  });

  // if (history && history.length > 0) {
  //   console.log("trigger");
  //   await compiledWorkflow.invoke(
  //     {
  //       user_id: userId,
  //       messages: history,
  //     },
  //     {
  //       configurable: {
  //         thread_id: projectId,
  //       },
  //     }
  //   );
  // }

  return compiledWorkflow;
};

const startAgent = async (
  prompt,
  projectId,
  history,
  userId,
  res,
  terminal,
  code
) => {
  try {
    const user = await User.findOne({ email: userId });

    const Proj = await Project.findOne({ generatedName: projectId });
    const allMessages = await Message.find({
      user: user._id.toString(),
      projectId: Proj,
    })
      .limit(10)
      .sort({ createdAt: -1 });

    const plan = await Plan.findOne({
      user: user._id.toString(),
      projectId: Proj,
    })
      .limit(1)
      .sort({ createdAt: -1 });

    const allcode = await Code.findOne({
      user: userId,
      projectId: projectId,
    });

    const workflow = await createAgent(
      allMessages,
      user.email,
      projectId,
      plan,
      allcode
    );

    // save message to mongo
    saveMessageHelper({
      projectId,
      email: user.email,
      role: "user",
      text: prompt,
    });

    const finalPrompt = JSON.stringify({
      userInput: prompt,
      terminal: terminal,
      code,
    });

    const stream = workflow.streamEvents(
      {
        messages: [new HumanMessage(finalPrompt)],
        user_id: userId,
      },
      {
        version: "v1",
        configurable: { thread_id: projectId },
      }
    );

    // Stream start
    res.write(`data: stream_start\n\n`);

    let accumulatedText = "";

    for await (const chunk of stream) {
      // console.log(chunk.event);

      if (
        chunk.event === "on_chat_model_stream" ||
        chunk.event === "on_llm_stream"
      ) {
        const textChunk = chunk.data?.chunk;

        let content = "";

        if (textChunk?.agent?.messages && textChunk.agent.messages.length > 0) {
          const message = textChunk.agent.messages[0];
          if (typeof message === "string") {
            content = message;
          } else if (typeof message === "object") {
            content = message.content || JSON.stringify(message);
          }
        } else if (textChunk?.content) {
          content = textChunk.content;
        } else if (textChunk?.text) {
          content = textChunk.text;
        } else if (typeof textChunk === "string") {
          content = textChunk;
        } else if (textChunk) {
          try {
            content = JSON.stringify(textChunk);
          } catch (e) {
            console.log("Could not stringify chunk", e);
          }
        }

        if (content) {
          accumulatedText += content;
          res.write(`data: ${content}\n\n`);
        }
      }
    }

    if (accumulatedText.length === 0) {
      console.log("No content was streamed, sending default message");
      res.write(`data: I'm processing your request...\n\n`);
    }

    console.log("Stream processing complete");
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    res.write(
      `data: Error processing your request: ${
        error instanceof Error ? error.message : "Unknown error"
      }\n\n`
    );
    res.write("data: [DONE]\n\n");
    res.end();
    throw error;
  }
};

module.exports = { createAgent, startAgent };
