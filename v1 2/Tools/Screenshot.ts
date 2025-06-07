import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface ScreenshotSuccessOutput {
  success: true;
  url: string;
  imageUrl: string;
  timestamp: string;
}

interface ScreenshotErrorOutput {
  success: false;
  url: string;
  error: string;
}

type ScreenshotOutput = ScreenshotSuccessOutput | ScreenshotErrorOutput;

const screenshotSchema = z.object({
  url: z.string().describe("The URL of the website to take a screenshot of"),
});

// Screenshot tool
const createScreenshotTool = () => {
  return tool(
    function takeScreenshot({
      url,
    }: {
      url: string;
    }): Promise<ScreenshotOutput> {
      return (async () => {
        try {
          // Validate and normalize URL
          if (!url.match(/^https?:\/\/.+/i)) {
            url = `https://${url}`;
          }
          
          console.log(`Taking screenshot of website: ${url}`);
          
          // In a real implementation, this would call an actual screenshot service
          // For now, mocking the response
          const timestamp = new Date().toISOString();
          const safeUrl = url.replace(/[^a-zA-Z0-9]/g, '_');
          const mockImageUrl = `https://example.com/screenshots/${safeUrl}_${timestamp}.jpg`;
          
          return {
            success: true as const,
            url,
            imageUrl: mockImageUrl,
            timestamp,
          };
        } catch (error) {
          return {
            success: false as const,
            url,
            error: error instanceof Error ? error.message : "Screenshot failed",
          };
        }
      })();
    },
    {
      name: "screenshot",
      description: "Take a screenshot of a website",
      schema: screenshotSchema,
    }
  );
};

export const takeScreenshot = () => {
  return [createScreenshotTool()];
}; 