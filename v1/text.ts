import { AzureChatOpenAI } from "@langchain/openai";

import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  Annotation,
  BaseStore,
  END,
  InMemoryStore,
  interrupt,
  LangGraphRunnableConfig,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  RemoveMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { searchWeb } from "./Tools/SearchWeb";
import { SYSTEM_MESSAGE } from "./Tools/ModelPrompts";
import { OpenAIEmbeddings } from "@langchain/openai";
import { getPlanningSystemPrompt, LeaderPrompt } from "./allPrompts";
import { planningNode } from "./nodes/Planner";
import { AgentStat } from "./nodes/types";

const tools = [...searchWeb()];

const GEMLLM = new AzureChatOpenAI({
  model: "gpt-4.1",
  azureOpenAIApiKey:
    "Cjx5p2Cw5LGQTuV5zTK8FoGqfPU016U3buzgFrwasWMY88MghbSQJQQJ99BDACHYHv6XJ3w3AAAAACOGgIW6",
  azureOpenAIApiInstanceName: "gpt-4.1",
  azureOpenAIApiDeploymentName: "gpt-4.1",
  azureOpenAIApiVersion: "2024-04-01-preview",
  azureOpenAIEndpoint:
    "https://ai-theshreyanshsingh78322ai222634691125.openai.azure.com/",
  apiKey:
    "Cjx5p2Cw5LGQTuV5zTK8FoGqfPU016U3buzgFrwasWMY88MghbSQJQQJ99BDACHYHv6XJ3w3AAAAACOGgIW6",

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
}).bindTools(tools);

const embeddings = new OpenAIEmbeddings({
  model: "gpt-4.1",
  apiKey:
    "Cjx5p2Cw5LGQTuV5zTK8FoGqfPU016U3buzgFrwasWMY88MghbSQJQQJ99BDACHYHv6XJ3w3AAAAACOGgIW6",
});

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  user_id: Annotation<string>(),
  memory: Annotation<string>(),
});

const memoryStore = new InMemoryStore({
  index: { embeddings, dims: 1536, fields: ["$"] },
});

// memory
const memory = new MemorySaver();

//Leader Node - meant for explanantions & supervising
async function callModel(
  state: typeof AgentState.State
): Promise<Partial<typeof AgentState.State>> {
  let { messages } = state;

  try {
    const response = await GEMLLM.invoke(messages);

    return { messages: [response] };
  } catch (error) {
    console.error("Error calling model:", error);
    return {
      messages: [
        new AIMessage({
          content:
            "I encountered an error processing your request. Let's try a simpler approach.",
        }),
      ],
    };
  }
}

const plannerNodeWrapper = async (state: typeof AgentState.State) => {
  const response = await planningNode(
    state as unknown as AgentStat,
    GEMLLM as AzureChatOpenAI
  );
  return response.data;
};

const plan = async (state: typeof AgentState.State) => {
  const lastHumanMessage = state.messages
    .slice()
    .reverse()
    .find((msg) => msg.getType() === "human") as HumanMessage | undefined;

  const planningMessages = [
    ...state.messages,
    new HumanMessage({
      content: `Build a google.com clone. Use a tool to visit the site, collect layout, design, and structure, and respond with the required output format.
      EXAMPLE reponse format- 
      ___start___
      {
        "type": "web",
        "action": "Visited whatsapp.com",
        "data": "Visited https://www.whatsapp.com to collect layout, navigation structure, UI patterns, and core visual references.",
        "role": "ai",
        "url": "https://your-cloudfront-url.amazonaws.com/whatsapp-snapshot.png"
      }
      ___end___`,
    }),
  ];

  const planningResponse = await GEMLLM.invoke(planningMessages);

  // Handle tool calls if present
  if (planningResponse.additional_kwargs?.tool_calls) {
    const toolCalls = planningResponse.additional_kwargs.tool_calls;
    const toolMessages = await Promise.all(
      toolCalls.map(async (toolCall: any) => {
        // Actually execute the tool here
        const toolResult = await executeTool(
          toolCall.function.name,
          toolCall.function.arguments
        );
        return new ToolMessage({
          content: JSON.stringify(toolResult),
          tool_call_id: toolCall.id,
        });
      })
    );
    return { messages: [planningResponse, ...toolMessages] };
  }

  return { messages: [planningResponse] };
};

async function executeTool(name: string, args: string) {
  // Implement actual tool execution logic here
  // Find the tool from your tools array and call it
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool.func(JSON.parse(args));
}
export const startAgent = async (
  prompt: string,
  projectId: string,
  history: [],
  userId: string
): Promise<ReadableStream> => {
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(`data: ${JSON.stringify({ type: "start" })}\n\n`);

        const workflow = new StateGraph(AgentState)
          .addNode("agent", callModel)

          .addEdge(START, "agent");

        const app = workflow.compile({
          checkpointer: memory,
          store: memoryStore,
        });

        // mapping all the msgs of user
        const messages = [
          new SystemMessage(LeaderPrompt()),
          ...history.map((msg) => new HumanMessage(msg)),
          new HumanMessage(prompt),
        ];

        const nextState = await app.invoke(
          { messages, user_id: userId },
          {
            configurable: {
              thread_id: projectId,
              recursionLimit: 5,
            },
          }
        );

        controller.enqueue(
          `data: ${JSON.stringify({
            type: "tool_result",
            output: JSON.stringify(
              nextState.messages[nextState.messages.length - 1].content
            ),
          })}\n\n`
        );

        // Send completion message
        controller.enqueue(
          `data: ${JSON.stringify({
            type: "end",
          })}\n\n`
        );

        // Close the stream
        controller.close();
      } catch (error) {
        console.error("Agent error:", error);
        // Send error message
        controller.enqueue(
          `data: ${JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          })}\n\n`
        );

        // Close the stream on error
        controller.close();
      }
    },
  });
};
