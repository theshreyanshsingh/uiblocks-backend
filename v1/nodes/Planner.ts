import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { AzureChatOpenAI } from "@langchain/openai";
import { AgentStat, NodeResponse, PlanState, PlanStep } from "./types";
import { getPlanningSystemPrompt } from "../allPrompts";
import { enhanceMessagesWithMemory } from "./MemoryNode";

// Planning node function
export const planningNode = async (
  state: AgentStat,
  llm: AzureChatOpenAI,
  customInstructions: string = ""
): Promise<NodeResponse> => {
  console.log("Planning node executing...");

  // Extract the last human message to understand what we're planning for
  const lastHumanMessage = state.messages
    .slice()
    .reverse()
    .find((msg) => msg.getType() === "human") as HumanMessage | undefined;

  if (!lastHumanMessage) {
    return {
      type: "planning",
      action: "error",
      data: "No user request found to create a plan for.",
    };
  }

  // Get system prompt for planning
  const planningPrompt = getPlanningSystemPrompt(customInstructions);

  // Create planning-specific messages
  const planningMessages = [
    new SystemMessage({ content: planningPrompt }),
    new HumanMessage({
      content: `I need you to create a detailed plan for the following request: "${lastHumanMessage.content}".
Please break this down into clear, actionable steps that you will follow while bringing the project to life`,
    }),
  ];

  // Enhance with memory if relevant
  //   const enhancedMessages = enhanceMessagesWithMemory(
  //     planningMessages,
  //     state.memory,
  //     lastHumanMessage.content as string
  //   );

  try {
    // Generate the plan
    const planningResponse = await llm.invoke(planningMessages);
    console.log(planningResponse, "respsonse of rplainng");
    return {
      type: "planning",
      action: "plan_created",
      data: planningResponse.content,
    };
  } catch (error) {
    console.error("Error in planning node:", error);
    return {
      type: "planning",
      action: "error",
      data: `Error creating plan: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
