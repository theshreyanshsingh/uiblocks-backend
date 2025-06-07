import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface LintIssue {
  line: number;
  column: number;
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
}

interface LintCheckSuccessOutput {
  success: true;
  language: string;
  issues: LintIssue[];
  summary: {
    errorCount: number;
    warningCount: number;
    fixableCount: number;
  };
  checkTime: number;
}

interface LintCheckErrorOutput {
  success: false;
  language: string;
  error: string;
}

type LintCheckOutput = LintCheckSuccessOutput | LintCheckErrorOutput;

const lintCheckSchema = z.object({
  code: z.string().describe("The code to check for linting issues"),
  language: z.string().describe("The programming language (e.g., typescript, javascript)"),
});

// Mock linting rules for JavaScript/TypeScript
const lintRules: Record<string, { pattern: RegExp; severity: "error" | "warning" | "info"; message: string }> = {
  "no-console": {
    pattern: /console\.(log|error|warn|info)/g,
    severity: "warning",
    message: "Unexpected console statement"
  },
  "no-unused-vars": {
    pattern: /const\s+([a-zA-Z0-9_]+)\s*=.*?(?!\1)/g,
    severity: "warning",
    message: "Variable is declared but never used"
  },
  "prefer-const": {
    pattern: /let\s+([a-zA-Z0-9_]+)\s*=\s*([^;]+);/g,
    severity: "info",
    message: "Use 'const' instead of 'let' when variable is not reassigned"
  },
  "missing-semicolon": {
    pattern: /}\n(?![\s})])/g, 
    severity: "error",
    message: "Missing semicolon"
  },
};

// Lint check tool
const createLintCheckTool = () => {
  return tool(
    function lintCheck({
      code,
      language,
    }: {
      code: string;
      language: string;
    }): Promise<LintCheckOutput> {
      return (async () => {
        try {
          console.log(`Linting ${language} code...`);
          
          // In a real implementation, this would use real linters like ESLint
          // For now, mocking the response based on simple patterns
          const startTime = Date.now();
          
          // Simple mock implementation
          const lines = code.split("\n");
          const issues: LintIssue[] = [];
          
          // Only apply linting to JavaScript or TypeScript
          if (["javascript", "js", "typescript", "ts"].includes(language.toLowerCase())) {
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const lineNumber = i + 1;
              
              // Check each lint rule
              for (const [ruleName, rule] of Object.entries(lintRules)) {
                const matches = [...line.matchAll(rule.pattern)];
                
                for (const match of matches) {
                  issues.push({
                    line: lineNumber,
                    column: match.index || 0,
                    rule: ruleName,
                    severity: rule.severity,
                    message: rule.message,
                  });
                }
              }
            }
          }
          
          const errorCount = issues.filter(issue => issue.severity === "error").length;
          const warningCount = issues.filter(issue => issue.severity === "warning").length;
          
          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 300));
          
          const checkTime = (Date.now() - startTime) / 1000;
          
          return {
            success: true as const,
            language,
            issues,
            summary: {
              errorCount,
              warningCount,
              fixableCount: Math.floor(issues.length * 0.7), // Assume 70% are auto-fixable
            },
            checkTime,
          };
        } catch (error) {
          return {
            success: false as const,
            language,
            error: error instanceof Error ? error.message : "Lint check failed",
          };
        }
      })();
    },
    {
      name: "lintCheck",
      description: "Check code for linting errors and style issues",
      schema: lintCheckSchema,
    }
  );
};

export const lintCheck = () => {
  return [createLintCheckTool()];
}; 