import { searchImages } from "./SearchWeb";
import { searchWeb } from "./WebSearch";
import { takeScreenshot } from "./Screenshot";
import { executeCode } from "./CodeExecution";
import { analyzeUI } from "./UIAnalysis";
import { lintCheck } from "./LintCheck";
import { terminalCommands } from "./TerminalTool";

// Tool registry for easy access to all tools
export const tools = {
  searchImages,
  searchWeb,
  takeScreenshot,
  executeCode,
  analyzeUI,
  lintCheck,
  terminalCommands,
};

// Get all tools as a flat array
export const getAllTools = () => {
  return [
    ...searchImages(),
    ...searchWeb(),
    ...takeScreenshot(),
    ...executeCode(),
    ...analyzeUI(),
    ...lintCheck(),
    ...terminalCommands(),
  ];
};

// Get tools by type
export const getToolsByType = (toolTypes: string[]) => {
  const allTools = getAllTools();
  return allTools.filter(tool => toolTypes.includes(tool.name));
}; 