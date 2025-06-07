import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { InMemoryStore } from "@langchain/core/stores";
import { ChatOpenAI } from "@langchain/openai";
import { AgentStat, ConversationChunk, MemoryState, Summary } from "./types";
import { v4 as uuidv4 } from "uuid";

// Maximum number of messages before summarization
export const MAX_MESSAGES_BEFORE_SUMMARY = 20;

// Create a memory store instance
export const createMemoryStore = () => {
  return new InMemoryStore();
};

// Initialize memory state
export const initializeMemoryState = (): MemoryState => {
  return {
    conversationHistory: [],
    relevantContext: [],
    summaries: [],
  };
};

// Add messages to conversation history
export const addToConversationHistory = (
  memoryState: MemoryState,
  messages: BaseMessage[]
): MemoryState => {
  if (!messages || messages.length === 0) {
    return memoryState;
  }

  const newChunk: ConversationChunk = {
    id: uuidv4(),
    messages,
    timestamp: Date.now(),
  };

  return {
    ...memoryState,
    conversationHistory: [...memoryState.conversationHistory, newChunk],
  };
};

// Create a summary of a conversation chunk
export const summarizeConversationChunk = async (
  chunk: ConversationChunk,
  model: ChatOpenAI
): Promise<string> => {
  try {
    const prompt = [
      new SystemMessage({
        content: `Create a concise summary of the following conversation.
  Focus on key points, decisions, code concepts, and important outcomes.
  Keep the summary brief but include all essential information.`,
      }),
      ...chunk.messages,
    ];

    const response = await model.invoke(prompt);
    return response.content as string;
  } catch (error) {
    console.error("Error summarizing conversation:", error);
    return "Failed to generate summary.";
  }
};

// Summarize all messages in the conversation history
export const summarizeEntireConversation = async (
  memoryState: MemoryState,
  model: ChatOpenAI
): Promise<string> => {
  try {
    // Flatten all messages from all chunks
    const allMessages = memoryState.conversationHistory.flatMap(
      (chunk) => chunk.messages
    );

    if (allMessages.length === 0) {
      return "No conversation to summarize.";
    }

    // If there are too many messages, we'll just use the summaries we already have
    if (allMessages.length > 100) {
      const existingSummaries = memoryState.summaries
        .filter((s) => s.category === "conversation")
        .map((s) => s.text)
        .join("\n\n");

      const summaryPrompt = [
        new SystemMessage({
          content: `Create a comprehensive summary of the following summaries of a conversation.
  Synthesize these summaries into a coherent overview of the entire conversation.`,
        }),
        new HumanMessage({
          content: existingSummaries || "No existing summaries available.",
        }),
      ];

      const response = await model.invoke(summaryPrompt);
      return response.content as string;
    }

    // Otherwise, summarize all messages directly
    const summaryPrompt = [
      new SystemMessage({
        content: `Create a comprehensive summary of the following conversation.
  Focus on key points, decisions, code concepts, and important outcomes.
  This should be a complete overview of the entire conversation.`,
      }),
      ...allMessages,
    ];

    const response = await model.invoke(summaryPrompt);
    return response.content as string;
  } catch (error) {
    console.error("Error summarizing entire conversation:", error);
    return "Failed to generate comprehensive summary.";
  }
};

// Add a summary to memory
export const addSummary = (
  memoryState: MemoryState,
  text: string,
  category: "conversation" | "plan" | "code" | "execution" = "conversation"
): MemoryState => {
  const newSummary: Summary = {
    id: uuidv4(),
    text,
    category,
    timestamp: Date.now(),
  };

  return {
    ...memoryState,
    summaries: [...memoryState.summaries, newSummary],
  };
};

// Retrieve relevant context based on a query
export const retrieveRelevantContext = (
  memoryState: MemoryState,
  query: string,
  maxResults: number = 3
): string[] => {
  // This is a simplified version - in a real implementation,
  // you would use semantic search or embedding similarity

  const allSummaries = memoryState.summaries;
  if (allSummaries.length === 0) {
    return [];
  }

  // Simple keyword matching for demonstration
  const keywords = query.toLowerCase().split(/\s+/);

  const scoredSummaries = allSummaries.map((summary) => {
    const text = summary.text.toLowerCase();
    let score = 0;

    keywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        score += 1;
      }
    });

    return { summary, score };
  });

  // Sort by score (descending) and then by timestamp (newest first)
  scoredSummaries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.summary.timestamp - a.summary.timestamp;
  });

  // Return the top N results
  return scoredSummaries.slice(0, maxResults).map((item) => item.summary.text);
};

// Count all messages in memory
export const countAllMessages = (memoryState: MemoryState): number => {
  return memoryState.conversationHistory.reduce(
    (count, chunk) => count + chunk.messages.length,
    0
  );
};

// Check if we should summarize based on message count
export const shouldSummarize = (memoryState: MemoryState): boolean => {
  const messageCount = countAllMessages(memoryState);
  // Summarize if we have a multiple of MAX_MESSAGES_BEFORE_SUMMARY
  return messageCount > 0 && messageCount % MAX_MESSAGES_BEFORE_SUMMARY === 0;
};

// Process the agent state to maintain and update memory
export const processMemory = async (
  state: AgentState,
  model: ChatOpenAI
): Promise<AgentState> => {
  const { messages, memory } = state;

  // Add new messages to conversation history
  const updatedMemory = addToConversationHistory(memory, messages);

  // Check if we should create a new summary based on message count
  if (shouldSummarize(updatedMemory)) {
    console.log(
      `Summarizing conversation after ${countAllMessages(updatedMemory)} messages`
    );

    // Create a full conversation summary
    const conversationSummary = await summarizeEntireConversation(
      updatedMemory,
      model
    );

    // Add the summary to the summaries collection
    const memoryWithSummary = addSummary(updatedMemory, conversationSummary);

    return {
      ...state,
      summary: conversationSummary,
      memory: memoryWithSummary,
    };
  }

  // Check if we should create a new summary for the latest chunk
  const conversationHistory = updatedMemory.conversationHistory;
  const latestChunk = conversationHistory[conversationHistory.length - 1];

  if (latestChunk && !latestChunk.summary && latestChunk.messages.length >= 5) {
    const chunkSummary = await summarizeConversationChunk(latestChunk, model);

    // Update the chunk with its summary
    const updatedChunk = { ...latestChunk, summary: chunkSummary };
    const updatedHistory = [...conversationHistory.slice(0, -1), updatedChunk];

    // Add the summary to the summaries collection
    const memoryWithChunkSummary = addSummary(
      {
        ...updatedMemory,
        conversationHistory: updatedHistory,
      },
      chunkSummary
    );

    return {
      ...state,
      memory: memoryWithChunkSummary,
    };
  }

  return {
    ...state,
    memory: updatedMemory,
  };
};

// Enhance messages with relevant context from memory
export const enhanceMessagesWithMemory = (
  messages: BaseMessage[],
  memoryState: MemoryState,
  query: string
): BaseMessage[] => {
  // Get relevant context
  const relevantContext = retrieveRelevantContext(memoryState, query);

  if (relevantContext.length === 0) {
    return messages;
  }

  // Create a context message
  const contextContent = `
  Relevant context from previous interactions:
  ${relevantContext.map((ctx, i) => `[${i + 1}] ${ctx}`).join("\n")}
  
  Use this context to inform your response if relevant.
  `;

  const contextMessage = new SystemMessage({ content: contextContent });

  // Insert the context message after the first system message if one exists,
  // otherwise add it at the beginning
  const firstSystemIndex = messages.findIndex((m) => m.getType() === "system");

  if (firstSystemIndex >= 0) {
    return [
      ...messages.slice(0, firstSystemIndex + 1),
      contextMessage,
      ...messages.slice(firstSystemIndex + 1),
    ];
  } else {
    return [contextMessage, ...messages];
  }
};
