import { BaseMessage } from "@langchain/core/messages";

// Define the agent state structure
export interface AgentStat {
  messages: BaseMessage[];
  memory: MemoryState;
  user_id: string;
}

// Structure for planning information
export interface PlanState {
  currentPlan: PlanStep[];
  completedSteps: string[];
  validationResults: ValidationResult[];
  currentStepIndex: number;
}

// Structure for code management
export interface CodeRepository {
  files: CodeFile[];
  currentFile: string;
  errorLog: ErrorItem[];
  lintResults: LintResult[];
}

// Structure for memory management
export interface MemoryState {
  conversationHistory: ConversationChunk[];
  relevantContext: string[];
  summaries: Summary[];
}

// Structure for tool usage information
export interface ToolState {
  lastSearchResults: WebSearchResult[];
  lastUsedTool: string;
  scrapeResults: ScrapeResult[];
  imageResults: ImageSearchResult[];
}

// Structure for UI-related information
export interface UIState {
  currentView: string;
  terminalOutput: string;
  previewUrl: string;
  lastError: string;
}

// Structure for feedback tracking
export interface FeedbackState {
  userFeedback: string[];
  suggestions: FeatureSuggestion[];
  pendingQuestions: string[];
}

// Detailed type definitions
export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  subSteps?: PlanStep[];
  codeChanges?: CodeChange[];
  estimatedComplexity: "simple" | "moderate" | "complex";
}

export interface ValidationResult {
  stepId: string;
  isValid: boolean;
  concerns: string[];
  suggestions: string[];
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
  lastModified: number;
}

export interface CodeChange {
  filePath: string;
  operation: "create" | "update" | "delete";
  content?: string;
  diffDescription?: string;
}

export interface ErrorItem {
  message: string;
  location?: string;
  severity: "error" | "warning" | "info";
  code?: string;
  timestamp: number;
  resolved: boolean;
}

export interface LintResult {
  filePath: string;
  issues: LintIssue[];
  lastChecked: number;
}

export interface LintIssue {
  rule: string;
  message: string;
  location: string;
  severity: "error" | "warning" | "info";
}

export interface ConversationChunk {
  id: string;
  messages: BaseMessage[];
  timestamp: number;
  summary?: string;
}

export interface Summary {
  id: string;
  text: string;
  category: "conversation" | "plan" | "code" | "execution";
  timestamp: number;
}

export interface WebSearchResult {
  query: string;
  results: {
    title: string;
    url: string;
    snippet: string;
    timestamp: number;
  }[];
}

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  screenshot?: string;
  timestamp: number;
}

export interface ImageSearchResult {
  query: string;
  images: {
    url: string;
    alt: string;
    source: string;
  }[];
  timestamp: number;
}

export interface FeatureSuggestion {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  implementationComplexity: "simple" | "moderate" | "complex";
}

// Node output types
export interface NodeResponse {
  type: string;
  action: string;
  data: string[] | string;
}

// Tool types
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Stream related types
export interface StreamChunk {
  type:
    | "start"
    | "thinking"
    | "planning"
    | "coding"
    | "executing"
    | "error"
    | "complete"
    | "tool_result"
    | "step_started"
    | "step_completed"
    | "step_skipped"
    | "sequence_started"
    | "waiting_for_input";
  content?: string | object;
  step?: string;
  description?: string;
  reason?: string;
  message?: string;
  suggestions?: string;
  error?: string;
  output?: string;
  timestamp: number;
}

// Web Container types
export interface CommandResult {
  command: string;
  output: string;
  exitCode: number;
  error?: string;
  duration: number;
}
