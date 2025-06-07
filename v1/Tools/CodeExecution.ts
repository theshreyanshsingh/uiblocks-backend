import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface CodeExecutionSuccessOutput {
  success: true;
  language: string;
  output: string;
  executionTime: number;
}

interface CodeExecutionErrorOutput {
  success: false;
  language: string;
  error: string;
}

type CodeExecutionOutput = CodeExecutionSuccessOutput | CodeExecutionErrorOutput;

const codeExecutionSchema = z.object({
  code: z.string().describe("The code to execute"),
  language: z.string().describe("The programming language (e.g., python, javascript)"),
});

// Validate code for potential security issues
const validateCode = (code: string, language: string): { valid: boolean; reason?: string } => {
  // Basic security checks (would be more robust in production)
  if (language.toLowerCase() === "javascript" || language.toLowerCase() === "js") {
    // Check for infinite loops
    if (code.includes("while(true)") || code.includes("while (true)")) {
      return { valid: false, reason: "Potential infinite loop detected" };
    }
    
    // Check for dangerous APIs
    if (code.includes("fs.") || code.includes("child_process") || code.includes("require(")) {
      return { valid: false, reason: "Potentially unsafe API usage detected" };
    }
  }
  
  return { valid: true };
};

// Code execution tool
const createCodeExecutionTool = () => {
  return tool(
    function executeCode({
      code,
      language,
    }: {
      code: string;
      language: string;
    }): Promise<CodeExecutionOutput> {
      return (async () => {
        try {
          console.log(`Executing ${language} code...`);
          
          // Validate code before execution
          const validation = validateCode(code, language);
          if (!validation.valid) {
            throw new Error(validation.reason);
          }
          
          // In a real implementation, this would execute the code in a sandboxed environment
          // For now, mocking the response
          const startTime = Date.now();
          
          // Simulate execution time
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          const executionTime = (Date.now() - startTime) / 1000;
          
          return {
            success: true as const,
            language,
            output: `Code execution completed successfully in ${executionTime.toFixed(2)}s.\nNo errors detected.\nOutput:\n> Hello, world!`,
            executionTime,
          };
        } catch (error) {
          return {
            success: false as const,
            language,
            error: error instanceof Error ? error.message : "Code execution failed",
          };
        }
      })();
    },
    {
      name: "executeCode",
      description: "Execute code in a sandbox environment",
      schema: codeExecutionSchema,
    }
  );
};

export const executeCode = () => {
  return [createCodeExecutionTool()];
}; 