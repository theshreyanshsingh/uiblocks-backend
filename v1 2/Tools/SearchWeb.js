const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { RELICS_API_KEY } = require("../../config");

//types
type SearchEngineType = "yahoo" | "duckduckgo";

interface ImageSearchSuccessOutput {
  success: true;
  engine: SearchEngineType;
  query: string;
  results: string[];
  count: number;
  cloudfrontUrl: string;
  ImageforAiToReadOnly: string;
}

interface ImageSearchErrorOutput {
  success: false;
  engine: SearchEngineType;
  error: string;
}

interface WebSearchOutput {
  success: true;
  results: string[];
}

interface WebSearchErrorOutput {
  success: false;

  error: string;
}

interface WebScreenshotOutput {
  success: true;
  cloudfrontUrl: string;
  html: string;
  ImageforAiToReadOnly: string;
}

interface WebScreenshotErrorOutput {
  success: false;
  error: string;
}

type ImageSearchOutput = ImageSearchSuccessOutput | ImageSearchErrorOutput;
type webSearchOutput = WebSearchOutput | WebSearchErrorOutput;
type webScreeshotOutput = WebScreenshotOutput | WebScreenshotErrorOutput;

const imageSearchSchema = z.object({
  query: z.string().min(1, { message: "Query is required" }),
  engine: z.enum(["yahoo", "duckduckgo"]).optional(),
});
const webSearchSchema = z.object({
  query: z.string().min(1, { message: "Query is required" }),
  engine: z.enum(["yahoo", "duckduckgo"]).optional(),
});
const webScreenshotSchema = z.object({
  url: z.string().min(1, { message: "Query is required" }),
});

// for image processing
async function processImageData(urls: Array<string> | string) {
  if (!urls || (Array.isArray(urls) && urls.length === 0)) {
    return []; // Return empty array if no URLs provided
  }

  const imageParts = [];
  // Ensure urls is always an array
  const urlArray = Array.isArray(urls) ? urls : [urls];
  let mimeType;
  for (const url of urlArray) {
    if (!url || typeof url !== "string") {
      console.warn(`Skipping invalid image URL: ${url}`);
      continue;
    }
    try {
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
    } catch (error) {
      console.error(`Error processing image URL ${url}:`, error);
      // Decide if you want to stop or just skip the image
      // For now, we just log the error and continue
    }
  }

  return imageParts;
}

// tools
const createSearchImageTool = () => {
  return tool(
    function webSearchImages({
      query,
      engine = "yahoo" as SearchEngineType,
    }: {
      query: string;
      engine?: SearchEngineType;
    }): Promise<ImageSearchOutput> {
      return (async () => {
        try {
          const response = await fetch(
            `${RELICS_API_KEY}/search/images?query=${encodeURIComponent(
              query
            )}`,
            { method: "GET" }
          );

          if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
          }

          const data = await response.json();
          const results = Array.isArray(data.results) ? data.results : [];

          const cloudfrontUrl = results[0].cloudFrontUrl;
          const ImageforAiToReadOnly = await processImageData(
            results[0].cloudFrontUrl
          );

          return {
            success: true as const,
            engine,
            query,
            results,
            ImageforAiToReadOnly: JSON.stringify(ImageforAiToReadOnly),
            count: results.length,
            cloudfrontUrl,
          };
        } catch (error) {
          return {
            success: false as const,
            engine,
            error:
              error instanceof Error ? error.message : "Image search failed",
          };
        }
      })();
    },
    {
      name: "WebSearchImages",
      description: "Search an image from web",
      schema: imageSearchSchema,
    }
  );
};

// const createNonUrlGeneralWebSearchTool = () => {
//   return tool(
//     function webSearchResults({
//       query,
//     }: {
//       query: string;
//       engine?: SearchEngineType;
//     }): Promise<webSearchOutput> {
//       return (async () => {
//         try {
//           const response = await fetch(
//             `${NEXT_PUBLIC_RELICS_API}/search?query=${encodeURIComponent(query)}`,
//             { method: "GET" }
//           );

//           if (!response.ok) {
//             throw new Error(`API responded with status: ${response.status}`);
//           }

//           const data = await response.json();
//           const results = Array.isArray(data.results) ? data.results : [];

//           return {
//             success: true as const,

//             results,
//           };
//         } catch (error) {
//           return {
//             success: false as const,
//             error:
//               error instanceof Error ? error.message : "Image search failed",
//           };
//         }
//       })();
//     },
//     {
//       name: "WebSearch",
//       description: "Search web for results with query",
//       schema: webSearchSchema,
//     }
//   );
// };

const createWebScreenshotandReadWebsiteTool = () => {
  return tool(
    function webScreenshotResults({
      url,
    }: {
      url: string;
    }): Promise<webScreeshotOutput> {
      return (async () => {
        try {
          const response = await fetch(
            `${RELICS_API_KEY}/screenshot?url=${encodeURIComponent(url)}`,
            { method: "GET" }
          );

          if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
          }

          const data = await response.json();
          const screenshotUrl = data.screenshotUrl;
          const html = data.html;

          const screenshot = await processImageData(screenshotUrl);

          return {
            ImageforAiToReadOnly: JSON.stringify(screenshot),
            success: true as const,
            cloudfrontUrl: screenshotUrl,
            html,
          };
        } catch (error) {
          return {
            success: false as const,
            error:
              error instanceof Error ? error.message : "Image search failed",
          };
        }
      })();
    },
    {
      name: "WebScreenShotAndReadWebsiteTool",
      description:
        "Take full page screenshot of a website and read it's content and html",
      schema: webScreenshotSchema,
    }
  );
};

export const searchWeb = () => {
  return [
    createSearchImageTool(), //search images
    // createNonUrlGeneralWebSearchTool(), // surf web
    createWebScreenshotandReadWebsiteTool(), // ss and scrape a site
  ];
};
