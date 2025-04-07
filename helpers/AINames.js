// Assuming you might need fetch if not on Node 18+
// const fetch = require('node-fetch'); // Uncomment if needed

const { GoogleGenerativeAI } = require("@google/generative-ai"); // Use the standard modern package name if possible
const { GEMINI_API_KEY_1 } = require("../config"); // Assuming GEMINI_API_KEY_2 is not used here

// Initialize the client
// Using GoogleGenerativeAI is the modern way. If your package is truly named 'GoogleGenAI', adjust accordingly.
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_1);

// --- Helper Function to Process Image URLs ---

/**
 * Fetches image data from URLs and converts it to base64 format for Gemini API.
 * @param {string | string[]} urls - A single URL or an array of image URLs.
 * @returns {Promise<Array<{inlineData: {mimeType: string, data: string}}>>} - Array of image parts for the API.
 */
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

// --- Modified Exported Functions ---

// NOTE: Assuming 'gemini-1.5-flash-latest' as it's a common multimodal model.
// Adjust 'gemini-1.5-flash-latest' if you specifically need 'gemini-2.0-flash' and it's available/multimodal.
const MODEL_NAME = "gemini-1.5-flash-latest";

exports.generateName = async ({ input, data }) => {
  // Process image URLs into the required format
  const imageParts = await processImageData(data);

  // Construct the prompt text (remove direct interpolation of 'data')
  const promptText = `
    Generate a creative name for the project based on the input: "${input}" and the provided visual context (if any).

    ### Instructions:
    1. The name must be a **sensible sentence** between **3 to 6 words**.
    2. **Always start with a relevant phrase** (e.g., "Create a", "Design a", "Craft a", "Develop an", "Assemble a", "Invent a", "Forge a", etc.).
       - Select the phrase **dynamically** based on the input context and visual information.
       - Avoid repetition of phrases across multiple requests.
       - Think out of the box
    3. The output should be **unique, sensible, and context-aware**.
    4. **Do NOT use markdown** formatting.
    5. **Strictly follow the instructions** without deviating.
    6. **DO Not put fullstop** at the end.
    7. If images/videos are provided and suggest cloning, generate a name accordingly (e.g., "Recreate the Provided UI"). If not, analyze the input and image context to give a cheerful or appropriate name.
    `;

  // Combine text prompt and image parts
  const requestContents = [
    {
      role: "user",
      parts: [
        { text: promptText }, // Text part first
        ...imageParts, // Spread the processed image parts
      ],
    },
  ];

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent({ contents: requestContents });
    // Adjust based on the actual structure returned by your specific genAI library instance
    const response = result.response;
    const text = response.text(); // Standard way in modern SDK
    return text;
  } catch (error) {
    console.error("Error generating name with Gemini:", error);
    // Handle error appropriately, maybe return a default or throw
    return "Error generating name";
  }
};

exports.generateMessage = async ({ input, data }) => {
  // Process image URLs
  const imageParts = await processImageData(data);

  // Construct the prompt text
  const promptText = `
    UserInput:${input}
    Visual Context: [Analyze provided images/video if any]

    ### Instructions:

    Generate a concise message (0-200 characters) that acknowledges the user's input and confirms project creation. The message should naturally incorporate the user's request (and visual context if provided) while maintaining clarity and engagement.
    Example: 'Got it! I'll create a project based on your idea: [user prompt description].'
    Think out of the box and put yourself in the user's shoes.
    If images/videos suggesting cloning are provided, generate a message confirming the cloning task accordingly. Otherwise, analyze the input and visual context to respond cheerfully or appropriately.
    DON'T use emotes and don't tell rules to the user!!
    `;

  // Combine text and image parts
  const requestContents = [
    {
      role: "user",
      parts: [{ text: promptText }, ...imageParts],
    },
  ];

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent({ contents: requestContents });
    const response = result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error generating message with Gemini:", error);
    return "Error generating message";
  }
};

exports.generatePrompt = async ({ input, memory, data }) => {
  // Process image URLs
  const imageParts = await processImageData(data);

  // Construct the prompt text
  const promptText = `
    Generate a structured and detailed project description based on the given input: "${input}", memory: "${memory}", and the provided visual context (if any).

    ### NOTE:

    1- When visual context (images/videos) is provided, analyze it carefully. Instructions should aim to recreate the visual elements with high accuracy, matching components, colors, layout, and implied functionality.

    2. If the request involves cloning based on visual context, the generated instructions, features, summary, and theme must reflect this goal of pixel-perfect or high-fidelity recreation.


    ### Instructions:

    Project Summary:
    Provide a clear and concise description of the project's purpose and functionality (Max 300 Characters). If cloning, emphasize accurate recreation.

    Features:
    List 3 to 5 key UI-based features derived from 'input', 'memory', and visual context (if any). Use concise language.
    List features relevant only to frontend UI/interactions (no backend).
    Format as a numbered list (1., 2., 3., ...).

    Memory Enhancement:
    Incorporate insights from "${memory}" to improve the project concept, if applicable and relevant (Max 300 Characters). If not relevant or empty, state so.

    Theme:
    Define a consistent visual identity (Max 500 characters):
    Primary and secondary colors (include hex codes). If cloning, sample accurately from visuals.
    UI design principles (layout, spacing, button styles, responsiveness). Describe observed principles if cloning.
    Aesthetic guidelines (e.g., minimalist, vibrant) aligned with the project's purpose or visual data.

    General Guidelines:
    Ensure the description is logically structured, coherent, and contextually relevant.
    Avoid contradictions or redundancy.
    Use clear, professional language.
    Give a customer-first experience.
    Return a clear structure using only '\\n' for newlines. No markdown (*, _, , etc.), no JSON. Titles must stay exactly as listed above.
    `;

  // Combine text and image parts
  const requestContents = [
    {
      role: "user",
      parts: [{ text: promptText }, ...imageParts],
    },
  ];

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent({ contents: requestContents });
    const response = result.response;
    const text = response.text();
    // Optional: Add intermediate logging to see raw response before parsing
    // console.log("Raw response from generatePrompt:", text);
    return text; // Still return raw text for the next function to parse
  } catch (error) {
    console.error("Error generating prompt with Gemini:", error);
    return "Error generating prompt details"; // Return an error string or handle differently
  }
};

// --- generateProjectDetails and Parsing Logic ---
// This function now relies on the text output of the others, but we need to modify its *own* call
// to Gemini to also handle potential images if 'data' is passed directly to it as well.

exports.generateProjectDetails = async ({ input, memory, data }) => {
  console.log("Image data received in generateProjectDetails:", data); // Log received data

  // Process image URLs provided *directly* to this function
  const imageParts = await processImageData(data);

  // System Instruction - Keep as is unless the specific library version requires a different format
  const systemInstruction = {
    // Assuming your library takes 'role' and 'text' directly here.
    // Newer SDKs might expect systemInstruction: { parts: [{ text: "..."}] }
    role: "system", // Standard role for system instructions often 'system' or omitted
    parts: [
      {
        text: `
        **STRICT OUTPUT FORMAT - Adhere precisely to this structure using only single newlines:**

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

        ***Example Output (Illustrative)***

        Project Name: Google Homepage Replica
        Message: Got it! I’ll create an exact copy of Google’s homepage with perfect spacing, colors, and animations to match the original.
        Project Summary: Rebuild the Google homepage with pixel-perfect accuracy. Focus on matching the layout, colors, fonts, and animations exactly as seen in the provided visual context. The search bar, buttons, and overall design should look and feel identical.
        Features:
        1. Search bar with smooth focus animation and placeholder text.
        2. Header and footer with accurate spacing, fonts, and hover effects.
        3. Button styles and interactions matching Google’s UI.
        4. Light and dark mode support for a modern touch.
        5. Fully responsive design for desktop and mobile.
        Memory Enhancement: Memory enhancement is not needed as the goal is pixel-perfect replication of the provided visual.
        Theme: Primary: #FFFFFF, Secondary: #4285F4, Text: #202124. Follows Google’s clean style using Google Sans font and an 8px grid system. Subtle hover effects on interactive elements.
        `,
      },
    ],
  };

  // Construct the user prompt text for this specific call
  // Note: We removed the explicit ${data} interpolation here too.
  const userPromptText = `
    Objective: Generate a creative project name, a concise confirmation message, and a structured project prompt based on the provided details. Prioritize natural, engaging language and adhere strictly to formatting. Handle cloning requests (if visual context is provided) with a focus on pixel-perfect accuracy.

    ### Provided Context:
    UserInput: "${input}"
    MemoryContext: "${memory}"
    Visual Context: [Analyze provided images/video if any]
    DETERMINE YOURSELF IF IT's a CLONING REQUEST based on input and visual context.

    ***Guidelines if Visual Context is Provided***
     * Focus on elements within the visual context: text, components, colors, themes, fonts, layout, implied functionality, gradients, etc.
     * Analyze the provided visual context carefully to extract all relevant details for replication.

    ***STRICT RULE***
    * If visual context suggests cloning, prioritize it alongside input/memory for generation.
    * Features must be UI-focused (3-5), listed numerically, and represent meaningful frontend effort. No backend details. Prioritize desktop/web complexity.
    * If cloning, features MUST describe key interactive components observed.

    ** IMPROTANT - Project Naming **
    1. CHECK if it's a cloning project based on input/visuals. If so, name it accordingly (e.g., "Replicate Provided Dashboard Design", "Build Netflix Clone UI").
    2. Generate a unique, engaging name (3-6 words). Avoid generic starters unless essential. No punctuation at the end.

    ### Required Output Format (Strict Schema - Use ONLY single newlines between lines):
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

    ### Detailed Instructions (Recap):

    **Core Logic:** Cloning (visual priority) vs. Generative (text priority).
    **1. Project Name:** Unique, engaging, 3-6 words, cloning-aware, no trailing punctuation.
    **2. Confirmation Message:** 0-200 chars, natural tone, reflects input/visuals, mentions pixel-perfect accuracy if cloning. No emojis/markdown.
    **3. Project Prompt Generation:**
        *   **Summary (Max 300 chars):** Core purpose, emphasize 100% accurate UI recreation if cloning.
        *   **Features (UI-Focused, 3-5):** List 1., 2., 3.. High-impact frontend/UI elements/interactions. Accurately describe visual components if cloning. Desktop/web complexity favored.
        *   **Memory Enhancement (Max 300 chars):** Integrate relevant memory insights or state N/A.
        *   **Theme (Max 500 chars):** Colors (Hex, sample if cloning), UI Principles (layout, spacing, controls, describe observed if cloning), Aesthetics (overall feel).
    **Final Strict Guidelines:** Adhere precisely to output format, single newlines only, NO markdown/asterisks, professional tone.
    `;

  // Combine user text prompt and image parts for the user message
  const userContents = {
    role: "user",
    parts: [{ text: userPromptText }, ...imageParts],
  };

  try {
    // Make the API call using the specific model instance and configuration
    // Note: System instructions are passed differently in the modern SDK. Adapt if needed.
    // Check your library's documentation for passing system instructions alongside contents.
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      // Pass system instruction during model initialization in newer SDKs
      systemInstruction: systemInstruction,
    });

    const result = await model.generateContent({
      // Contents should be an array of message objects
      contents: [userContents],
    });

    const response = result.response;
    let generatedText = response.text();

    console.log("--- Raw Gemini Output (Before Cleaning/Parsing) ---");
    console.log(generatedText);
    console.log("-------------------------------------------------");

    // Clean potential markdown artifacts just in case model didn't follow instructions perfectly
    generatedText = generatedText.replace(/[*`_~]/g, "");

    // Parse the cleaned text using your existing function
    const extractedData = extractProjectData(generatedText);

    if (!extractedData) {
      console.error("Failed to parse generated text. Raw text:", generatedText);
      // Decide how to handle parsing failure: return null, throw error, return raw text?
      // Returning null as per original logic possibility
      return null;
    }

    console.log("--- Parsed Data ---");
    console.log(extractedData);
    console.log("--------------------");

    return extractedData;
  } catch (error) {
    console.error(
      "Error in generateProjectDetails Gemini call or processing:",
      error
    );
    // Handle error appropriately
    return null; // Or throw, or return an error object
  }
};

// --- Existing Helper Functions (Keep As Is) ---

// This function is likely not needed if constructing contents directly
/*
const buildContent = (prompt, history) => {
  // ... (original implementation - seems superseded by direct construction)
};
*/

// Keep your existing parsing function
function extractProjectData(text) {
  // This regex assumes Features will always have exactly 5 lines, even if optional.
  // Consider making 4 and 5 truly optional in the regex if they might be omitted entirely.
  // Added optional capture groups for features 4 and 5
  const regex =
    /Project\s+Name:\s*(.*?)\nMessage:\s*(.*?)\nProject\s+Summary:\s*(.*?)\nFeatures:\s*\n1\.\s*(.*?)\n2\.\s*(.*?)\n3\.\s*(.*?)(?:\n4\.\s*(.*?))?(?:\n5\.\s*(.*?))?\nMemory\s+Enhancement:\s*(.*?)\nTheme:\s*(.*)/s;

  const matches = text.match(regex);
  if (matches) {
    // Ensure features array has consistent length, padding with empty strings if needed
    const features = [
      matches[4]?.trim() || "", // Feature 1
      matches[5]?.trim() || "", // Feature 2
      matches[6]?.trim() || "", // Feature 3
      matches[7]?.trim() || "", // Feature 4 (optional)
      matches[8]?.trim() || "", // Feature 5 (optional)
    ].filter((f) => f !== ""); // Remove empty strings if you only want existing features

    return {
      projectName: matches[1]?.trim() || "",
      message: matches[2]?.trim() || "",
      summary: matches[3]?.trim() || "",
      features: features, // Array of found features
      memoryEnhancement: matches[9]?.trim() || "",
      theme: matches[10]?.trim() || "",
    };
  } else {
    console.warn("Regex did not match generated text structure.");
    return null; // No match found
  }
}
