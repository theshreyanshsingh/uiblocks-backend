const { z } = require("zod");

// leader node
const ExplanationSchema = z.object({
  type: z
    .literal("explanation")
    .describe("The type of the response, always 'explanation'"),
  action: z.string().describe("The action to be taken, e.g., 'user guidance'"),
  tool: z.string().optional().describe("The tool to be used, if any, e.g., ''"),
  command: z
    .string()
    .optional()
    .describe("The command to execute, if applicable, e.g., ''"),
  data: z
    .string()
    .describe("The main content of the explanation or related suggestion."),
  role: z.literal("ai").describe("The role of the responder, always 'ai'"),
  url: z
    .string()
    .optional()
    .describe("A relevant URL, if applicable, e.g., ''"),
  code: z
    .string()
    .optional()
    .describe(
      "A single file's full content, including its filepath. Example: 'src/backend.ts:\\nimport express from \"express\";\\nconst app = express();\\n...'"
    ),
  isachieved: z
    .boolean()
    .describe("Whether the action was achieved, if applicable"),
});

// Define the routing response schema
const RoutingSchema = z.object({
  NextNode: z
    .enum([
      "assets",
      "examiner",
      "terminal",
      "frontend",
      "backend",
      "error_resolution",
      "web",
      "feat_sugges",
    ])
    .describe("The next node to route to"),
  user_message: z.string().describe("The original user message"),
});

// Union schema for both response types
exports.LeaderOutputSchema = z.union([ExplanationSchema, RoutingSchema]);

// exports.leadOutput = z.infer<typeof LeaderOutputSchema>;/

// planner node
exports.ExaminerSchema = z.object({
  type: z
    .literal("examiner")
    .describe("The type of the response, always 'examiner'"),
  action: z
    .string()
    .describe(
      "The action taken, e.g., 'searched hianime.to' - must be summarized"
    ),
  tool: z.string().describe("The tool used, e.g., 'WebSearch'"),
  command: z
    .string()
    .describe("The command executed, e.g., 'search: hianime.to features'"),
  data: z.string().describe("The summarized result of the action"),
  role: z.literal("ai").describe("The role of the responder, always 'ai'"),
  url: z
    .string()
    .describe(
      "A relevant cloudfront URL, e.g., search result or cloudfront URL"
    ),
  code: z
    .string()
    .optional()
    .describe("A single file's full content, if applicable"),
  isachieved: z
    .boolean()
    .describe("Whether the action was achieved, in this case true"),
  planId: z.string().describe("6 digit random Id provided by asset node"),
});

// export type ExaminerOutputSchema = z.infer<typeof ExaminerSchema>;

// frontend node
exports.FrontendSchema = z.object({
  type: z
    .literal("coding")
    .describe("The type of the response, always 'coding'"),
  action: z
    .string()
    .describe(
      "The action taken, e.g., 'wrote file e.g. frontend/src/index.tsx'"
    ),
  tool: z.string(),
  command: z.string().describe("The command executed"),
  nextFile: z
    .string()
    .describe(
      "The next file to be written according to pre-determined plan e.g. frontend/auth/login.tsx"
    ),
  data: z
    .string()
    .describe("Be humble and tell the user what you have done in 2-4 lines."),
  role: z.literal("ai").describe("The role of the responder, always 'ai'"),
  file: z.string().describe("The file you wrote e.g. frontend/app.tsx"),
  url: z
    .string()
    .describe(
      "A relevant cloudfront URL, e.g., search result or cloudfront URL"
    ),
  code: z
    .string()
    .describe(
      "full path of the file on left:A single file's full code on right, e.g. filepath: code"
    ),
  isachieved: z
    .boolean()
    .describe(
      "Whether the action was achieved, in this case false until all the files are written inside the frontend folder"
    ),
});

// export type FrontendOutputSchema = z.infer<typeof FrontendSchema>;

// backend node
exports.BackendSchema = z.object({
  type: z
    .literal("coding")
    .describe("The type of the response, always 'coding'"),
  action: z
    .string()
    .describe(
      "The action taken, e.g., 'wrote file e.g. backend/server/src/index.ts'"
    ),
  tool: z.string(),
  nextFile: z
    .string()
    .describe(
      "The next file to be written according to pre-determined plan e.g. backend/server/src/models/user.ts"
    ),
  file: z
    .string()
    .describe("The file you wrote e.g. backend/server/src/index.ts"),
  data: z
    .string()
    .describe(
      "Respond to user e.g. I am creating a file - action can be anything..."
    ),
  role: z.literal("ai").describe("The role of the responder, always 'ai'"),
  url: z
    .string()
    .describe(
      "A relevant cloudfront URL, e.g., search result or cloudfront URL"
    ),
  code: z
    .string()
    .describe(
      "full path of the file:A single file's full code, e.g. filepath: code"
    ),
  isachieved: z
    .boolean()
    .describe(
      "Whether the action was achieved, in this case false until all the files are written inside the backend folder"
    ),
});

// export type BackendOutputSchema = z.infer<typeof BackendSchema>;

//terminal prompt
exports.TerminalSchema = z.object({
  type: z
    .literal("terminal")
    .describe("The type of the response, always 'terminal'"),
  action: z.string().describe("The action taken, e.g., 'executing ls -la'"),
  tool: z.string(),
  data: z
    .string()
    .describe("Respond to user e.g. Here are the files available!"),
  role: z.literal("ai").describe("The role of the responder, always 'ai'"),
  command: z.string().describe("ls -la"),
  isachieved: z
    .boolean()
    .describe(
      "Whether the action was achieved, in this case false until the desired result is achieved"
    ),
});

// export type TerminalOutputSchema = z.infer<typeof TerminalSchema>;

//feature_sugges
exports.featSchema = z.object({
  type: z
    .literal("feat_sugges")
    .describe("The type of the response, always 'feat_sugges'"),
  action: z.string().describe("telling user what more features can be made"),
  tool: z.string(),
  data: z
    .string()
    .describe(
      "Respond to user e.g. Well now we can also add...a list of at least 4 features!"
    ),
  role: z.literal("ai").describe("The role of the responder, always 'ai'"),
  isachieved: z
    .boolean()
    .describe("Whether the action was achieved, in this case true"),
});

// export type featOutputSchema = z.infer<typeof featSchema>;
