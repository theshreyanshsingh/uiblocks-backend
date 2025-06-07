const { AzureChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");
const { searchWeb } = require("../v1/Tools/SearchWeb");
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

const { z } = require("zod");

async function processImageData(urls) {
  if (!urls || (Array.isArray(urls) && urls.length === 0)) {
    return []; // Return empty array if no URLs provided
  }

  const imageParts = [];
  // Ensure urls is always an array
  const urlArray = Array.isArray(urls) ? urls : [urls];

  for (const url of urlArray) {
    if (!url || typeof url !== "string") {
      console.warn(`Skipping invalid image URL: ${url}`);
      continue;
    }
    try {
      console.log(`Fetching image from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image ${url}: ${response.statusText}`);
      }

      // Determine MIME type
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) {
        // Try to infer from URL extension if content-type is missing/invalid
        const extension = url.split(".").pop()?.toLowerCase();
        let inferredMimeType;
        switch (extension) {
          case "jpg":
          case "jpeg":
            inferredMimeType = "image/jpeg";
            break;
          case "png":
            inferredMimeType = "image/png";
            break;
          case "webp":
            inferredMimeType = "image/webp";
            break;
          case "gif":
            inferredMimeType = "image/gif";
            break;
          // Add more cases if needed
          default:
            console.warn(
              `Could not determine valid image MIME type for ${url}. Content-Type: ${contentType}. Skipping.`
            );
            continue; // Skip if we can't determine a valid image type
        }
        console.warn(`Using inferred MIME type ${inferredMimeType} for ${url}`);
        mimeType = inferredMimeType;
      } else {
        mimeType = contentType;
      }

      // Get image data as ArrayBuffer and convert to Base64
      const imageBuffer = await response.arrayBuffer();
      const base64Data = Buffer.from(imageBuffer).toString("base64");

      imageParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
      console.log(`Successfully processed image: ${url}`);
    } catch (error) {
      console.error(`Error processing image URL ${url}:`, error);
      // Decide if you want to stop or just skip the image
      // For now, we just log the error and continue
    }
  }

  return imageParts;
}

// leader node
const OutputSchema = z.object({
  action: z.string().describe("The action to be taken, e.g., 'user guidance'"),
  tool: z.string().optional().describe("The tool to be used, if any, e.g., ''"),
  Steps: z
    .string()
    .describe("The main content of the explanation or related suggestion."),
  role: z.literal("ai").describe("The role of the responder, always 'ai'"),
  url: z
    .string()
    .optional()
    .describe("A relevant URL, if applicable, e.g., ''"),
  generatedFiles: z
    .record(
      z.string(),
      z.object({
        code: z.string(),
      })
    )
    .describe("A mapping of file paths to their content."),
  files: z
    .array(z.string())
    .describe("List of generated or modified file paths."),
  filesCount: z
    .number()
    .describe("Total number of files generated or modified."),
});
// Define the routing response schema
const RoutingSchema = z.object({
  NextNode: z.enum(["tools", "agent"]).describe("The next node to route to"),
  user_message: z.string().describe("The original user message"),
});

// Union schema for both response types
const LeaderOutputSchema = z.union([OutputSchema, RoutingSchema]);

const nameSchema = z.object({
  projectName: z.string().describe("the name of the project"),
  message: z
    .string()
    .describe("one liner message given to user at the end of the project"),
  summary: z.string().describe("3-4 line summary of the project"),
  features: z
    .array()
    .describe(
      "a 3 pointer list of features that input does not contain but are fundamental and can be instantly implemented"
    ),
  memoryEnhancement: z
    .string()
    .describe(
      "if memory is given enhance and make it more expressive and explanatory"
    ),
  theme: z
    .string()
    .describe(
      "the theme of the project containing - color combo of evey element and the vibe of the project - color codes, font styles, should be creative unless its a clone of anykind or an image is given"
    ),
});

const MainPrompt = () => `
You are an expert AI Agent designed to create high-quality, interactive web-based 3D games, Framer Motion animations expert, and frontend applications, primarily using React and Tailwind CSS. Your purpose is to generate exceptionally accurate, visually stunning, professionally themed, pixel-perfect, functionally robust, highly maintainable, secure, performant, and fully realized JavaScript code for games, animations, and frontend UIs. 
You have two primary jobs: 
(1) fix or modify code strictly according to user input and memory, and 
(2) generate complete, error-free code for all files specified in a provided plan in a single response, starting file generation immediately without unnecessary preamble, strictly adhering to user input, memory, specified framework, CSS library, and plan details, without omitting any code or including unnecessary console logs unless required for debugging.

## Core Responsibilities

1. **Intent Detection**: Analyze user intent through reasoning, not keyword matching.
   - Conversational or general queries: Respond with a clear explanation and suggest a small game or animation idea using the "explanation" format.
   - Creation, replication, or building requests (games, animations, or frontend apps): Start generating complete code for all files in one go immediately, strictly based on the provided plan or user prompt, ensuring pixel-perfect accuracy for cloning tasks.
   - Code fixing/modification: Start fixing or modifying code immediately, strictly according to user input and memory, ensuring no deviations.
2. **Plan Adherence**: Immediately generate code for all files in a single response, precisely implementing all features, themes, colors, and functionality specified in the provided plan or user prompt. If no plan is provided, infer requirements from the prompt and memory, using web search if needed.
3. **Web Tools**: Use web search to gather context, inspiration, or references for games/animations. Capture screenshots when requested, returning CloudFront URLs.
4. **No Unnecessary Questions**: Only seek clarification for unclear requests or malformed URLs.
5. **Code Fixes**: Start fixing or modifying code immediately based on user input and memory, ensuring consistency with prior context.
6. Write error free json.
7. You can write as long codes as you like.
8. Never forget to import a component and always use correct imports.

## Capabilities

- **Frontend**: React (Hooks, Context, JSX, default), Tailwind CSS (default)
- **Animations**: Framer Motion for smooth, professional animations
- **Game Development**: React-based game libraries (e.g., React-Three-Fiber for 3D, canvas-based games avoiding SVGs)
- **Features**: Authentication, mobile-responsive UI, file upload
- **Web Tools**: Web search, website reading, screenshot capture (returning CloudFront URLs)
- **Icon Library**: Use \`lucide-react\` or \`react-icons\` for React projects
- **Image Sourcing**: Use web tools to get CloudFront URLs or https://picsum.photos for images

## Behavioral Rules

1. **Code Quality**:
   - Generate syntactically correct, error-free, secure, performant, and maintainable JavaScript (.js only, unless .jsx explicitly requested).
   - Ensure responsive, SEO-friendly, multi-component UIs with professional aesthetics (minimalist default or pixel-perfect for cloning).
   - Use \`lucide-react\` or \`react-icons\` for icons in React projects, adding to \`package.json\` as "latest".
   - Avoid SVGs, base64 images, or external image sources (except https://picsum.photos).
   - For cloning, achieve pixel-perfect accuracy in visuals, functionality, and component count, matching fonts, colors, layouts, and features.
   - Structure code in multiple components for maintainability, even for simple requests.
   - Avoid unnecessary console logs unless explicitly requested for debugging.
   - Start generating all files specified in the plan immediately in a single response, ensuring no code is omitted.

2. **URL Validation**:
   - If a URL is malformed (e.g., missing TLD, invalid format):
     - Respond with the "explanation" format: "This URL seems incorrect. Would you like me to continue anyway?"
   - If a URL resembles a well-known domain but is misspelled (e.g., 'gooogle.com'):
     - Respond with the "explanation" format: "The URL 'gooogle.com' seems to refer to 'google.com'. Do you want me to continue using 'google.com' instead?"
     - Proceed only after user confirmation.

3. **Default Stack**:
   - Frontend: React + Tailwind CSS
   - Animation: Framer Motion
   - Only use a different stack if explicitly requested.

4. **Code Generation**:
   - For fixes: Start modifying code immediately based on user input and memory, ensuring consistency and no deviations.
   - For generation: Start generating complete code for all files specified in the plan immediately in a single response, using the requested framework and CSS library, ensuring all specified features are implemented without omissions.
   - For cloning, use web search or provided references to replicate visuals and functionality exactly.
   - Ensure correct imports/exports, valid JSON in \`package.json\`, and no runtime errors.
   - Conduct a final audit to verify theme, features, and functionality match the plan or prompt.
   - Package.json must only contain dependencies and devDependencies.
   - App.js is the root file in case of React, make sure to import eveyrthing correctly.
   
5. **Code Modification**
   - If the code is given analyze and understand the full code, then understand userInput then given only the modified files in output as per the user request.

5. ***___start___ and ___end___ markers are always required in the output.***

## Output Schema
\`\`\`json
___start___
{
  "Steps": "(If generating files): Planning actions after deep analysis:\n1. Analyzing the request to understand the goal: [Briefly state interpreted goal, e.g., create a game or animation].\n2. Immediately generating all files in one go, ensuring professional quality, maintainability, security, performance, responsiveness, multi-component structure, theme consistency (minimalist default or pixel-perfect clone), JS ONLY, React conventions, and error-free code/imports/exports.\n3. Creating component X at [path], focusing on [e.g., game logic, Framer animation, or UI].\n4. Creating related component Y at [path] to structure the UI/game/animation, ensuring [quality goals].\n5. Modifying main component A at [path] to import/render X and Y.\n6. Updating /package.json for dependencies like 'framer-motion' or 'lucide-react', ensuring valid JSON.\n(If fixing code): Fixing code based on user input and memory:\n1. Analyzing the request: [User's modification request].\n2. Immediately modifying file X at [path] to address [specific issue or change].\n3. Ensuring consistency with memory and user input.\n(If Refusal Required): Communicating refusal after analysis:\n1. Analyzing the request: [User's Idea].\n2. However, this request is incompatible because [e.g., 'non-web tasks are not supported'].\n3. Therefore, I cannot fulfill this request.\n4. Suggesting alternatives: [e.g., a JS-based game or animation].",
  "generatedFiles": {
  "/components/GameComponent.js": {
  "code": "import React from 'react';\n\nimport { motion } from 'framer-motion'; // Example Framer Motion import\n\nimport { CheckCircle } from 'lucide-react'; // Example icon import\n\nfunction GameComponent() {\n\n  return (\n\n    <motion.div className='p-6 bg-white rounded-lg shadow-md' animate={{ scale: 1 }} initial={{ scale: 0 }}>\n\n      <CheckCircle className='text-green-500 mr-3' size={20} />\n\n      <h3 className='text-lg font-semibold text-gray-800'>Game Component</h3>\n\n    </motion.div>\n\n  );\n\n}\n\nexport default GameComponent;"
},

   "/package.json": {
  "code": "{\n\n  \"dependencies\": {\n\n    \"react\": \"^18.2.0\",\n\n    \"react-dom\": \"^18.2.0\",\n\n    \"framer-motion\": \"latest\",\n\n    \"lucide-react\": \"latest\"\n\n  },\n\n  \"devDependencies\": {\n\n    \"tailwindcss\": \"latest\"\n\n  }\n\n}"
}
  },
  "files": [
    "/components/GameComponent.js",
    "/package.json"
  ],
  "filesCount": 2
}
___end___
\`\`\`
`;

const namePromptText = () => `
You are a precise, context-aware naming and description generator for frontend projects, games, animations, and UI kits.  
Your task is to deeply analyze the user's input description (and visual context if provided) to extract the **main purpose and action of the project**.

## Process:
1. **Extract the exact core intent** of the user's request in 1-2 words (e.g., "weather dashboard", "clicker game", "profile card UI").
2. The final output must be a **valid JSON object string**.  
   - All keys and string values must use double quotes.
   - No comments or trailing commas.
   - No multiline strings — break long sentences properly.
   - The entire output must be strictly valid JSON, ready for parsing.

3. Based on that, generate:

- **projectName**: An expressive, stylish, and context-aware name (2–5 words) that hints at what the project does or feels like.
- **message**: A one-sentence engaging description of what the project offers or enables.
- **summary**: A 2–3 sentence overview explaining what the project does, who it’s for, and how it works.
- **features**: A bullet list (3–5) of key features or fundamental aspects of the project, beginner-friendly.
- **memoryEnhancement**: A single phrase that helps mentally associate the project with its function, theme, or vibe.
- **theme**: A description of the visual or conceptual theme (e.g., "Clean dashboard UI", "Retro arcade animation", "Neon card flip") including color palette and font suggestions if appropriate. If cloning is requested, make it an exact replica with all visual and UX details.

## Constraints:
- No generic starter phrases like “Create a” or “Develop a”.
- No unrelated, abstract, or generic names.
- All content must be **context-specific** and directly reflect the extracted intent.
- Avoid full stops in projectName.
- Ensure JSON validity in every output.

## Important rule
- if an image is given and user intent is to clone, then analyze the image and make sure to fill up all the details correctly according to the image.

## Example:

**User input**: "A React clicker game with score counter"  
**Extracted intent**: "clicker game"

** Strict Output Format **
  Project Name: [Generated Project Name]
        Message: [Generated Confirmation Message]
        Project Summary: [Generated Summary]
        Features:
        1. [Feature 1]
        2. [Feature 2]
        3. [Feature 3]
        4. [Optional Feature 4]
        5. [Optional Feature 5]
        Memory Enhancement: [Generated Memory Insights]
        Theme: [Generated Theme Guidelines]

Always follow this exact structure and formatting for every request.
`;

const { MODEL_API_KEY, MODEL_API_POINT, MODEL_NAME } = require("../config");

const Message = require("../models/Message");
const User = require("../models/User");
const { saveMessageHelper } = require("../controllers/Projects");

const Project = require("../models/Project");
const { default: axios } = require("axios");

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

const Namellm = async () => {
  const config = {
    model: "gpt-4.1-mini",
    azureOpenAIApiKey: MODEL_API_KEY,
    azureOpenAIApiInstanceName: "gpt-4.1-mini",
    azureOpenAIApiDeploymentName: "gpt-4.1-mini",
    azureOpenAIApiVersion: "2024-12-01-preview",
    azureOpenAIEndpoint: MODEL_API_POINT,
    apiKey: MODEL_API_KEY,
    maxTokens: 5000,
    maxRetries: 3,
  };

  return new AzureChatOpenAI(config).bindTools(tools);
};

// const UsableAsset = {
//   cloudfrontUrl: String,
//   readableImage: String,
// };

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
    "All Messages - {conversationHistory}\n\nCurrent Message - {userInput}\n\nCurrentCode - {currentCode}",
  ],
]);

const leadparser = StructuredOutputParser.fromZodSchema(LeaderOutputSchema);
const nameparser = StructuredOutputParser.fromZodSchema(nameSchema);

// Name generate template
const NamePrompt = ChatPromptTemplate.fromMessages([
  ["system", `{namePrompt}\n\n{formatInstructions}`],
  ["human", "images - {inputImages}\n\nUser input - {userInput}"],
]);

const createAgent = async (history, userId, projectId, code) => {
  // leader node with all msg history
  const coreNode = async (state) => {
    let { messages } = state;

    try {
      const llmInstance = await llm();

      const currentCode = await axios.get(code);

      const userInput =
        messages.length > 0 && messages[messages.length - 1].content
          ? String(messages[messages.length - 1].content)
          : "No user input provided";

      // Format the prompt with user input
      const formattedPrompt = await leadPrompt.formatPromptValue({
        leaderPrompt: MainPrompt(),
        userInput: String(userInput),
        formatInstructions: leadparser.getFormatInstructions(),
        conversationHistory: JSON.stringify(history),
        currentCode: currentCode.data,
      });

      // Convert prompt to messages
      const promptMessages = formattedPrompt.toChatMessages();

      const res = await llmInstance.invoke(promptMessages);

      const nextNodeMatch = res.content.match(/"NextNode"\s*:\s*"([^"]+)"/);

      if (!nextNodeMatch) {
        // saveMessageHelper({
        //   projectId,
        //   email: userId,
        //   role: "ai",
        //   text: res.content,
        // });
      }

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

  const workflow = new StateGraph(AgentState)
    .addNode("agent", coreNode)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addEdge("tools", "agent")
    .addEdge("agent", END)
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
              case "agent":
                return "agent";
              case "tools":
                return "tools";
              // Add other cases as needed
              default:
                console.log("Unknown NextNode value:", nextNodeValue);
                return END;
            }
          }
        }

        return END;
      },
      ["agent", "tools", END]
    );

  const compiledWorkflow = workflow.compile({
    checkpointer: memory,
    store: store,
  });

  return compiledWorkflow;
};

const oldagent = async (
  prompt,
  memory,
  cssLib,
  framework,
  images,
  projectId,
  userId,
  res
) => {
  try {
    const user = await User.findOne({ email: userId });

    const Proj = await Project.findOne({
      generatedName: projectId,
      status: "active",
    });
    const allMessages = await Message.find({
      user: user._id.toString(),
      projectId: Proj,
    })
      .limit(10)
      .sort({ createdAt: -1 });

    const workflow = await createAgent(
      allMessages,
      user.email,
      projectId,
      Proj.url
    );

    // save message to mongo
    // saveMessageHelper({
    //   projectId,
    //   email: user.email,
    //   role: "user",
    //   text: prompt,
    // });

    const finalPrompt = JSON.stringify({
      userInput: `prompt-${prompt}, memory- ${memory}, css-${cssLib}, framework-${framework},images-${images}`,
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

const generateDetails = async ({
  input,
  memory,
  images,
  cssLib,
  framework,
}) => {
  try {
    const image = await processImageData(images);

    const llmInstance = await Namellm();

    const formattedPrompt = await NamePrompt.formatPromptValue({
      namePrompt: namePromptText(),
      userInput: String(JSON.stringify({ input, memory, cssLib, framework })),
      formatInstructions: nameparser.getFormatInstructions(),
      inputImages: image,
    });

    // Convert prompt to messages
    const promptMessages = formattedPrompt.toChatMessages();

    const text = await llmInstance.invoke(promptMessages);
    // save message to mongo
    // saveMessageHelper({
    //   projectId,
    //   email: user.email,
    //   role: "user",
    //   text: prompt,
    // });
    return text.content;
  } catch (error) {
    throw error;
  }
};

module.exports = { createAgent, oldagent, generateDetails };
