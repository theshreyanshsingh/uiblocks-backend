import { AzureChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { searchWeb } from "./Tools/SearchWeb";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

import {
  Annotation,
  END,
  InMemoryStore,
  MemorySaver,
  START,
  StateGraph,
} from "@langchain/langgraph";
import {
  BaseMessage,
  AIMessage,
  SystemMessage,
  HumanMessage,
} from "@langchain/core/messages";
import {
  AssetPrompt,
  BackendPrompt,
  ExaminerPrompt,
  FeatureSuggestionPrompt,
  FrontendPrompt,
  LeaderPrompt,
  TerminalPrompt,
} from "./Prompts";
import {
  LeaderOutputSchema,
  leadOutput,
  ExaminerSchema,
  ExaminerOutputSchema,
  FrontendSchema,
  FrontendOutputSchema,
  BackendSchema,
  BackendOutputSchema,
  TerminalSchema,
  TerminalOutputSchema,
  featSchema,
  featOutputSchema,
} from "./Schemas";
import { MODEL_API_Key, MODEL_API_POINT, MODEL_NAME } from "../config";

// tools
const tools = [...searchWeb()];
const toolNode = new ToolNode(tools);

export const createAgentTools = () => {
  const searchTools = searchWeb();

  return [...searchTools];
};

// emmbeddings
const embeddings = new OpenAIEmbeddings({
  model: "gpt-4.1",
  apiKey: MODEL_API_Key,
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
    azureOpenAIApiKey: MODEL_API_Key,
    azureOpenAIApiInstanceName: MODEL_NAME,
    azureOpenAIApiDeploymentName: MODEL_NAME,
    azureOpenAIApiVersion: "2024-04-01-preview",
    azureOpenAIEndpoint: MODEL_API_POINT,
    apiKey: MODEL_API_Key,
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

type UsableAsset = {
  cloudfrontUrl: string;
  readableImage: string;
};

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  usableAssets: Annotation<UsableAsset[]>({
    reducer: (x, y) => x.concat(y),
  }),
  user_id: Annotation<string>(),
  plan: Annotation<string>(),
});

// Leader prompt template
const leadPrompt = ChatPromptTemplate.fromMessages([
  ["system", `{leaderPrompt}\n\n{formatInstructions}`],
  ["human", "{userInput}"],
]);

const leadparser = StructuredOutputParser.fromZodSchema(LeaderOutputSchema);

// Asset prompt template
const examinPrompt = ChatPromptTemplate.fromMessages([
  ["system", `{examinerPrompt}\n\n{formatInstructions}`],
  ["human", "{userInput}"],
]);

const examinerparser = StructuredOutputParser.fromZodSchema(ExaminerSchema);

// frontend prompt template
const frontPrompt = ChatPromptTemplate.fromMessages([
  ["system", `{frontendprompt}\n\n{formatInstructions}`],
  ["human", "{userInput}"],
]);

const frontparser = StructuredOutputParser.fromZodSchema(FrontendSchema);

// backend prompt template
const backPrompt = ChatPromptTemplate.fromMessages([
  ["system", `{backendprompt}\n\n{formatInstructions}`],
  ["human", "{userInput}"],
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

const createAgent = async (history: [], userId: string, projectId: string) => {
  //leader node with all msg history
  const coreNode = async (
    state: typeof AgentState.State
  ): Promise<Partial<typeof AgentState.State>> => {
    let { messages, plan } = state;
    console.log(plan, "plan");
    try {
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";

      // Format the prompt with user input
      const formattedPrompt = await leadPrompt.formatPromptValue({
        leaderPrompt: LeaderPrompt(),
        userInput: String([...history, userInput]),
        formatInstructions: leadparser.getFormatInstructions(),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      const parsedOutput: leadOutput = await leadparser.parse(
        res.content as string
      );

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
              "I encountered an error processing your request. Let's try a simpler approach.",
          }),
        ],
      };
    }
  };

  // with only current msg
  const assetNode = async (
    state: typeof AgentState.State
  ): Promise<Partial<typeof AgentState.State>> => {
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
  const ExaminerNode = async (
    state: typeof AgentState.State
  ): Promise<Partial<typeof AgentState.State>> => {
    try {
      const { messages } = state;
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";

      // const parsedData = JSON.parse(userInput);

      // Format the prompt with user input
      const formattedPrompt = await examinPrompt.formatPromptValue({
        examinerPrompt: ExaminerPrompt(),
        userInput: String(userInput),
        formatInstructions: examinerparser.getFormatInstructions(),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      const parsedOutput: ExaminerOutputSchema = await examinerparser.parse(
        res.content as string
      );

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

  const FrontNode = async (
    state: typeof AgentState.State
  ): Promise<Partial<typeof AgentState.State>> => {
    try {
      const { messages } = state;
      const llmInstance = await llm();

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";
      console.log("reached", userInput);
      // Format the prompt with user input
      const formattedPrompt = await frontPrompt.formatPromptValue({
        frontendprompt: FrontendPrompt(),
        userInput: String(userInput),
        formatInstructions: frontparser.getFormatInstructions(),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      const parsedOutput: FrontendOutputSchema = await frontparser.parse(
        res.content as string
      );
      console.log("front");

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

  const BackNode = async (
    state: typeof AgentState.State
  ): Promise<Partial<typeof AgentState.State>> => {
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
        userInput: String([...history, userInput]),
        formatInstructions: backparser.getFormatInstructions(),
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      const parsedOutput: BackendOutputSchema = await backparser.parse(
        res.content as string
      );
      console.log("backend");

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

  const TerminalNode = async (
    state: typeof AgentState.State
  ): Promise<Partial<typeof AgentState.State>> => {
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

      const parsedOutput: TerminalOutputSchema = await terminalParser.parse(
        res.content as string
      );
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

  const FeatureNode = async (
    state: typeof AgentState.State
  ): Promise<Partial<typeof AgentState.State>> => {
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

      const parsedOutput: featOutputSchema = await featureParser.parse(
        res.content as string
      );
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
    .addEdge("examiner", END)
    // Conditional routing after agent node
    .addConditionalEdges(
      "agent",
      async (state) => {
        // Get the last message from the agent
        const lastMessage = state.messages[state.messages.length - 1];

        let content = lastMessage.content;
        // Handle if content is a string that contains JSON
        if (typeof content === "string") {
          try {
            // Try to parse it as JSON
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              const parsed = JSON.parse(jsonStr);

              if (parsed.NextNode === "assets") {
                return "assets";
              }
              // // Add condition to route to tools if needed
              // if (parsed.NextNode === "tools") {
              //   return "tools";
              // }

              // if (parsed.NextNode === "examiner") {
              //   return "examiner";
              // }

              // console.log(content);
              if (parsed.NextNode === "frontend") {
                return "frontend";
              }
              // if (parsed.NextNode === "backend") {
              //   return "backend";
              // }
              // if (parsed.NextNode === "terminal") {
              //   return "terminal";
              // }
              // if (parsed.NextNode === "feat_sugges") {
              //   return "feat_sugges";
              // }
            }
          } catch (e) {
            console.error("Error parsing JSON from message:", e);
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
    )
    .addConditionalEdges(
      "tools",
      async (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        let content = lastMessage.content;

        return "examiner";
      },
      ["examiner", END]
    );

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

export const startAgent = async (
  prompt: string,
  projectId: string,
  history: [],
  userId: string,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  terminal: string,
  code: string
) => {
  try {
    const workflow = await createAgent(history, userId, projectId);

    const finalPrompt = JSON.stringify({
      userInput: prompt,
      terminal: terminal,
      code,
    });

    //checking messages before passing history
    const res = workflow.streamEvents(
      {
        messages: [new HumanMessage(finalPrompt)],
        user_id: userId,
        plan: "passed",
      },
      {
        version: "v1",
        configurable: {
          thread_id: projectId,
        },
      }
    );

    // Send stream start event
    await writer.write(encoder.encode("data: stream_start\n\n"));

    let accumulatedText = "";

    for await (const chunk of res) {
      if (
        chunk.event === "on_chat_model_stream" ||
        chunk.event === "on_llm_stream"
      ) {
        const textChunk = chunk.data?.chunk;

        // Handle different chunk structures
        let content = "";

        if (textChunk?.agent?.messages && textChunk.agent.messages.length > 0) {
          const message = textChunk.agent.messages[0];
          if (message && typeof message === "string") {
            content = message;
          } else if (message && typeof message === "object") {
            // Try to extract content from message object
            content = message.content || JSON.stringify(message);
          }
        } else if (textChunk?.content) {
          content = textChunk.content;
        } else if (textChunk?.text) {
          content = textChunk.text;
        } else if (typeof textChunk === "string") {
          content = textChunk;
        } else if (textChunk) {
          // Last resort: try to stringify the chunk
          try {
            content = JSON.stringify(textChunk);
          } catch (e) {
            console.log("Could not stringify chunk", e);
          }
        }

        if (content) {
          accumulatedText += content;
          // Send the chunk as a properly formatted SSE message
          await writer.write(encoder.encode(`data: ${content}\n\n`));
        }
      }
    }

    // If no content was sent, send a default message to ensure the client receives something
    if (accumulatedText.length === 0) {
      console.log("No content was streamed, sending default message");
      await writer.write(
        encoder.encode(`data: I'm processing your request...\n\n`)
      );
    }

    console.log("Stream processing complete");
    await writer.write(encoder.encode("data: [DONE]\n\n"));
    await writer.close();
  } catch (error) {
    // Send error message to client
    await writer.write(
      encoder.encode(
        `data: Error processing your request: ${
          error instanceof Error ? error.message : "Unknown error"
        }\n\n`
      )
    );
    await writer.write(encoder.encode("data: [DONE]\n\n"));
    await writer.close();
    throw error;
  }
};
