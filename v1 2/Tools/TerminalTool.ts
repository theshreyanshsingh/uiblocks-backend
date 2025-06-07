
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Define the schema for terminal command execution
const terminalCommandSchema = z.object({
  command: z.string().min(1, { message: "Command is required" }),
});

// Types for command execution results
interface TerminalCommandSuccessOutput {
  success: true;
  command: string;
  output: string;
}

interface TerminalCommandErrorOutput {
  success: false;
  command: string;
  error: string;
}

type TerminalCommandOutput = TerminalCommandSuccessOutput | TerminalCommandErrorOutput;

// Track command attempts to prevent excessive retries
const commandAttempts: Record<string, number> = {};
const MAX_ATTEMPTS = 2; // Maximum number of attempts per command

// Debug function to log detailed state information - minimal to avoid excessive logging
const logState = (message: string, extraInfo?: any) => {
  console.log(`[TerminalTool] ${message}`, extraInfo || '');
};

// // Check if terminal is busy
// const isTerminalBusy = (): boolean => {
//   if (typeof window === 'undefined') return false;
//   return window.terminalIsBusy === true;
// };

// Function to interrupt current terminal process
const interruptTerminal = async (): Promise<void> => {
  if (typeof window === 'undefined' || !window.executeTerminalCommand) return;
  
  try {
    await window.executeTerminalCommand("^C");
    logState('Terminal interrupted via executeTerminalCommand');
  } catch (error) {
    logState('Terminal interrupt error:', error);
  }
};

// // Function to inform the tool that terminal is ready
// export const setTerminalReady = (ready: boolean = true) => {
//   if (typeof window !== 'undefined') {
//     window.terminalReady = ready;
//   }
// };

// Create the terminal command execution tool
const createTerminalCommandTool = () => {
  return tool(
    function executeTerminalCommand({
      command,
    }: {
      command: string;
    }): Promise<TerminalCommandOutput> {
      return (async () => {
     
        console.log('command', command, typeof window);
        // Track retry attempts and limit them
        // commandAttempts[command] = (commandAttempts[command] || 0) + 1;
        // if (commandAttempts[command] > MAX_ATTEMPTS) {
        //   return {
        //     success: false as const,
        //     command,
        //     error: `Maximum retry limit reached (${MAX_ATTEMPTS}). Please try a different approach or command.`,
        //   };
        // }
        
        // try {
        //   // Get WebContainer directly - simplest approach first
        //   let webcontainerInstance = null;
          
        //   if (typeof window !== 'undefined') {
        //     // Try in priority order, but don't log every attempt
        //     webcontainerInstance = window.webcontainer || 
        //                           (window.getWebContainerInstance && window.getWebContainerInstance()) || 
        //                           (window.webcontainerGlobal && window.webcontainerGlobal.instance);
        //   }

        //   logState(`Executing command: ${typeof window}`,);
          
        //   // If no WebContainer found, return error immediately without retrying
        //   if (!webcontainerInstance) {
        //     return {
        //       success: false as const,
        //       command,
        //       error: `WebContainer is not available (attempt ${commandAttempts[command]}/${MAX_ATTEMPTS}). Please wait for the terminal to initialize.`,
        //     };
        //   }

        //   console.log('webcontainerInstance', webcontainerInstance);
        //   // Handle busy terminal by interrupting if needed
        // //   if (isTerminalBusy()) {
        // //     logState('Terminal is busy, interrupting current process');
        // //     await interruptTerminal();
        // //     // Brief pause to allow interrupt to take effect
        // //     await new Promise(resolve => setTimeout(resolve, 300));
        // //   }
          
        //   // Notify terminal UI of command execution
        //   if (typeof window !== 'undefined') {
        //     window.dispatchEvent(new CustomEvent('agent-terminal-command', {
        //       detail: { command, type: 'start' }
        //     }));
        //   }

        //   // Execute command directly without additional checks
        //   const process = await webcontainerInstance.spawn("bash", ["-c", command]);
          
        //   // Collect output simply
        //   const outputParts: string[] = [];
        //   const errorParts: string[] = [];
          
        //   process.output.pipeTo(
        //     new WritableStream({
        //       write(data) {
        //         outputParts.push(data);
        //       },
        //     })
        //   );
          
        //   process.stderr?.pipeTo(
        //     new WritableStream({
        //       write(data) {
        //         errorParts.push(data);
        //       },
        //     })
        //   );
          
        //   // Wait for process to complete
        //   const exitCode = await process.exit;
          
        //   // Combine output
        //   const stdout = outputParts.join("");
        //   const stderr = errorParts.join("");
        //   const output = stdout + (stderr ? `\nErrors:\n${stderr}` : "");
          
        //   // Notify terminal UI of completion
        //   if (typeof window !== 'undefined') {
        //     window.dispatchEvent(new CustomEvent('agent-terminal-command', {
        //       detail: { 
        //         command,
        //         output,
        //         success: exitCode === 0,
        //         type: 'complete'
        //       }
        //     }));
        //   }
          
        //   if (exitCode !== 0) {
        //     return {
        //       success: false as const,
        //       command,
        //       error: `Command failed (attempt ${commandAttempts[command]}/${MAX_ATTEMPTS}): ${output}`,
        //     };
        //   }
          
        //   // Update current directory for tracking
        //   if (command === 'pwd' && stdout.trim() && typeof window !== 'undefined') {
        //     window.terminalCurrentDir = stdout.trim();
        //   }
          
        //   // Reset command attempts counter on success
        //   delete commandAttempts[command];
          
        //   // Add command to history for AI reference
        //   if (typeof window !== 'undefined') {
        //     // Log the command for reference
        //     logState(`Command "${command}" executed successfully`);
        //   }
          
        //   return {
        //     success: true as const,
        //     command,
        //     output,
        //   };
        // } catch (error) {
        //   // Simple error handling without excessive retries
        //   return {
        //     success: false as const,
        //     command,
        //     error: `Command execution failed (attempt ${commandAttempts[command]}/${MAX_ATTEMPTS}): ${error instanceof Error ? error.message : "Unknown error"}`,
        //   };
        // }
        return {
                success: false as const,
                command,
                error: `Command execution failed (attempt ${commandAttempts[command]}/${MAX_ATTEMPTS}):}`,
              };
      })();
    },
    {
      name: "ExecuteTerminalCommand",
      description: "Execute a terminal command in the WebContainer environment",
      schema: terminalCommandSchema,
    }
  );
};

// Export a utility function to initialize WebContainer global reference - simplified
// export const initializeWebContainerGlobal = (webcontainerInstance: any) => {
//   if (!webcontainerInstance || typeof window === 'undefined') return;
  
//   // Set direct references without excess logging
//   window.webcontainer = webcontainerInstance;
//   window.webcontainerGlobal = { instance: webcontainerInstance };
//   window.getWebContainerInstance = () => webcontainerInstance;
  
//   // Mark terminal as ready
//   setTerminalReady(true);
  
//   // Clear any existing command attempts on initialization
//   Object.keys(commandAttempts).forEach(key => delete commandAttempts[key]);
  
//   // Get current directory immediately
//   setTimeout(async () => {
//     try {
//       const process = await webcontainerInstance.spawn("bash", ["-c", "pwd"]);
//       const output: string[] = [];
      
//       process.output.pipeTo(
//         new WritableStream({
//           write(data) {
//             output.push(data);
//           },
//         })
//       );
      
//       await process.exit;
//       const currentDir = output.join('').trim();
      
//       if (currentDir) {
//         window.terminalCurrentDir = currentDir;
//       }
//     } catch (err) {
//       // Silently fail
//     }
//   }, 1000);
// };

// Export the terminal command execution tool
export const terminalCommands = () => {
  return [createTerminalCommandTool()];
}; 