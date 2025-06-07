const { generateProjectDetails } = require("../helpers/AINames");
const Project = require("../models/Project");
const User = require("../models/User");
const Message = require("../models/Message");
const Plan = require("../models/Plan");
const { s3, invalidateCloudFront } = require("../helpers/Aws");
const { BUCKET_NAME, BUCKET_URL, CLOUDFRONTID } = require("../config");
const Code = require("../models/Code");
const { default: axios } = require("axios");
const { generateDetails } = require("../helpers/oldagent");

const file = [
  {
    file: "frontend/package.json",
    code: `{
  "name": "frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.0.2",
    "vite": "^4.3.9"
  }
}`,
  },
  {
    file: "frontend/vite.config.ts",
    code: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:7777',
        changeOrigin: true
      }
    }
  }
})`,
  },
  {
    file: "frontend/tsconfig.json",
    code: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,
  },
  {
    file: "frontend/tsconfig.node.json",
    code: `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}`,
  },
  {
    file: "frontend/tailwind.config.js",
    code: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
  },
  {
    file: "frontend/postcss.config.js",
    code: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
  },
  {
    file: "frontend/index.html",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TS Frontend + Backend</title>
</head>
<body class="bg-black text-white min-h-screen">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`,
  },
  {
    file: "frontend/src/main.tsx",
    code: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`,
  },
  {
    file: "frontend/src/App.tsx",
    code: `import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [message, setMessage] = useState<string>('Loading...')
  
  useEffect(() => {
    const fetchMessage = async () => {
      try {
        const response = await axios.get('/api/hello')
        setMessage(response.data.message)
      } catch (error) {
        console.error('Error fetching message:', error)
        setMessage('Failed to connect to server')
      }
    }
    
    fetchMessage()
  }, [])
  
  return (
    <div className="flex flex-col items-center w-full min-h-screen p-8">
      <header className="w-full mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">TS Frontend + Backend</h1>
      </header>
      <main className="w-full max-w-3xl flex-1">
        <div className="bg-gray-900 border border-gray-700 p-8 rounded-lg text-center">
          <h2 className="text-2xl font-medium mb-4">Message from server:</h2>
          <div className="text-3xl font-bold mt-4 p-4 bg-black border border-gray-600 rounded">
            {message}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App`,
  },
  {
    file: "frontend/src/styles/globals.css",
    code: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
  },
  {
    file: "frontend/src/vite-env.d.ts",
    code: `/// <reference types="vite/client" />`,
  },
  {
    file: "backend/package.json",
    code: `{
  "name": "backend",
  "version": "1.0.0",
  "description": "Express TypeScript Backend",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.13",
    "@types/express": "^4.17.17",
    "@types/morgan": "^1.9.4",
    "@types/node": "^20.2.5",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.1.3"
  }
}`,
  },
  {
    file: "backend/tsconfig.json",
    code: `{
  "compilerOptions": {
    "target": "es2018",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}`,
  },
  {
    file: "backend/src/index.ts",
    code: `import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Initialize Express app
const app = express();
const PORT = 7777;

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.get('/api/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello from the backend!' });
});

// Add a root route to handle the 404 issue
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Backend API is running. Use /api/hello to get data.' });
});

// Start server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`API endpoint available at http://localhost:\${PORT}/api/hello\`);
});`,
  },
  {
    file: "backend/.gitignore",
    code: `node_modules
dist
.env`,
  },
];

async function processImageData(urls) {
  if (!urls || (Array.isArray(urls) && urls.length === 0)) {
    return [];
  }

  const imageParts = [];
  const urlArray = Array.isArray(urls) ? urls : [urls];
  let mimeType;
  for (const url of urlArray) {
    if (!url || typeof url !== "string") {
      console.warn(`Skipping invalid image URL: ${url}`);
      continue;
    }
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" }); // Use axios.get with arraybuffer
      const contentType = response.headers["content-type"];
      if (!contentType || !contentType.startsWith("image/")) {
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
          default:
            console.warn(
              `Could not determine valid image MIME type for ${url}. Content-Type: ${contentType}. Skipping.`
            );
            continue;
        }
        mimeType = inferredMimeType;
      } else {
        mimeType = contentType;
      }

      const imageBuffer = response.data; // Axios response.data is the arraybuffer
      const base64Data = Buffer.from(imageBuffer).toString("base64");

      imageParts.push({
        base64Data,
      });
    } catch (error) {
      console.error(`Error processing image URL ${url}:`, error);
    }
  }

  return imageParts;
}

const f = async () => {
  const code = await Code.create({
    projectId: "eqkz8com-3xkahdxp-wlejoa5d-f4m4onp1",
    user: "theshreyanshsingh7@gmail.com",
    files: file,
  });
};

const wipe = async () => {
  const me = await Message.deleteMany({
    projectId: "67f5f0acd591a8d896416b3d",
  });
};

const a = async () => {
  const text = await generateDetails({
    input: "build a flappy bird clone",
    images: [],
    memory: "diff theme",
  });
  const cleanedText = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(cleanedText);
  console.log("t", parsed);
};

exports.createProject = async (req, res) => {
  try {
    const { input, memory, cssLibrary, framework, projectId, owner, images } =
      req.body;
    const user = await User.findOne({ email: owner }).select(
      "_id plan promptCount pubId"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    const existingProject = await Project.findOne({
      generatedName: projectId,
      status: "active",
    })
      .lean()
      .exec();

    if (existingProject) {
      const messages = await Message.find({ projectId: existingProject._id })
        .sort({ createdAt: -1 })
        .select("role text images")
        .limit(10)
        .lean()
        .exec();

      const plan = await Plan.findOne({
        projectId: existingProject._id,
        user: user._id,
      }).sort({ createdAt: -1 });

      const code = await Code.findOne({
        projectId: projectId,
        user: owner,
      });

      if (existingProject.url) {
        return res.json({
          success: true,
          messages: messages.reverse(),
          title: existingProject.title,
          projectId: existingProject.generatedName,
          input: existingProject.input,
          csslib: existingProject.csslibrary,
          framework: existingProject.framework,
          memory: existingProject.memory,
          url: existingProject.url,
          lastResponder: existingProject.lastResponder,
          isResponseCompleted: existingProject.isResponseCompleted,
          email: user.email,
          promptCount: user.promptCount,
          plan: user.plan,
          id: user.pubId,
          plan,
          code: code && code.files.length > 0 ? code.files : [],
        });
      } else {
        return res.json({
          success: true,
          messages: messages.reverse(),
          title: existingProject.title,
          projectId: existingProject.generatedName,
          input: existingProject.input,
          csslib: existingProject.csslibrary,
          framework: existingProject.framework,
          memory: existingProject.memory,
          email: user.email,
          enh_prompt: existingProject.enh_prompt,
          lastResponder: existingProject.lastResponder,
          isResponseCompleted: existingProject.isResponseCompleted,
          promptCount: user.promptCount,
          plan: user.plan,
          id: user.pubId,
        });
      }
    } else {
      //name of project
      const text = await generateDetails({
        input,
        images,
        memory,
        cssLib: cssLibrary,
        framework,
      });

      const cleanedText = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleanedText);

      const {
        projectName,
        message,
        summary,
        features,
        memoryEnhancement,
        theme,
      } = parsed;

      const prompt = {
        summary,
        features,
        memoryEnhancement,
        theme,
      };

      const project = await Project.create({
        title: projectName,
        originalInput: input,
        memory,
        csslibrary: cssLibrary,
        framework,
        generatedName: projectId,
        owner: user._id,
        enh_prompt: JSON.stringify(prompt),
      });

      const msg = await Message.create({
        text: input,
        user: user._id,
        projectId: project._id,
        role: "user",
        images,
      });

      const AImessage = await Message.create({
        text: message,
        user: user._id,
        projectId: project._id,
        role: "ai",
        seq: Message.countDocuments() + 1,
      });

      await User.updateOne(
        { _id: user._id },
        {
          $push: { projects: project._id },
          $inc: { numberOfProjects: 1 },
        }
      );

      if (user.promptCount > 0) {
        user.promptCount = user.promptCount - 1;
        await user.save();
      }

      return res.json({
        success: true,
        messages: [
          { role: "user", text: msg.text, images: msg.images },
          { role: "ai", text: AImessage.text },
        ],
        title: project.title,
        projectId: project.generatedName,
        input: input,
        csslib: cssLibrary,
        framework: framework,
        memory: memory,
        email: user.email,
        promptCount: user.promptCount,
        plan: user.plan,
        enh_prompt: JSON.stringify(prompt),
        id: user.pubId,
      });
    }
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

exports.presigned = async (req, res) => {
  try {
    const { fileName, fileType, email, projectId } = req.body;

    const user = await User.findOne({ email: email });

    if (!user) {
      return res
        .status(400)
        .json({ message: "User not found!", success: false });
    }

    const params = {
      Bucket: BUCKET_NAME,
      Key: `projects/${user._id}/uploads/${fileName}`,
      Expires: 60,
      ContentType: fileType,
    };

    const uploadURL = await s3.getSignedUrlPromise("putObject", params);
    res.json({
      uploadURL,
      url: `${BUCKET_URL}/projects/${user._id}/uploads/${fileName}`,
      key: params.Key,
      success: true,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to generate pre-signed URL" });
  }
};

exports.getProject = async (req, res) => {
  try {
    const { p: projectId } = req.query;

    const project = await Project.findOne({
      generatedName: projectId,
      status: "active",
    }).select("title");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found!",
      });
    }

    res.json({
      success: true,
      title: project.title,
    });
  } catch (error) {
    console.error("Error getting project:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

exports.getAllProjects = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    const projects = await Project.find({ owner: user, status: "active" })
      .select("title _id updatedAt memory isPinned isPublic generatedName")
      .limit(30)
      .lean()
      .exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    if (!Project) {
      return res.status(201).json({
        success: true,
        message: "Projects not found!",
      });
    }

    res.json({
      success: true,
      projects: projects.reverse(),
    });
  } catch (error) {
    console.error("Error getting project:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

//fetch all messages
exports.getMessages = async (req, res) => {
  const { p: projectId, loadMore } = req.query;

  try {
    const project = await Project.findOne(
      { generatedName: projectId, status: "active" },
      { _id: 1 }
    )
      .lean()
      .exec();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found!",
      });
    }

    const messages = await Message.find(
      { projectId: project._id },
      { _id: 0, __v: 0, projectId: 0 }
    )
      .sort({ createdAt: -1 })
      .skip(loadMore ? parseInt(loadMore) : 0)
      .limit(10)
      .lean()
      .exec();

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No messages found!",
      });
    }

    res.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

//save project
exports.saveProject = async (req, res) => {
  try {
    const { projectId, owner, data } = req.body;

    const project = await Project.findOne({
      generatedName: projectId,
      status: "active",
    })
      .select("_id")
      .lean()
      .exec();

    const user = await User.findOne({ email: owner })
      .select("_id")
      .lean()
      .exec();

    if (!project || !user) {
      return res.status(500).json({
        success: false,
        message: "User or project not found!",
      });
    }

    // Define S3 params
    const params = {
      Bucket: BUCKET_NAME,
      Key: `projects/${user._id}/${project._id}`,
      Body: data,
      ContentType: "application/json",
      CacheControl: "no-cache, no-store, must-revalidate", // Forces immediate refresh
      Expires: new Date(0), // Prevents old versions being served
    };

    // Ensure URL updates in the database
    await Project.updateOne(
      { _id: project._id },
      {
        $set: {
          url: `${BUCKET_URL}/projects/${user._id}/${project._id}`,
          lastResponder: "ai",
          isResponseCompleted: true,
        },
      }
    );

    // Use putObject for guaranteed overwrite
    s3.putObject(params, (error, data) => {
      if (error) {
        console.error("Error uploading to S3:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to upload project to S3.",
        });
      }

      res.json({
        success: true,
        message: "Project saved successfully!",
        url: `${BUCKET_URL}/projects/${user._id}/${project._id}`,
      });
    });

    //Invalidating cache
    invalidateCloudFront(CLOUDFRONTID, [
      `${BUCKET_URL}/projects/${user._id}/${project._id}`,
    ])
      .then(() => console.log("Invalidation successful"))
      .catch((err) => console.error("Invalidation error:", err));
  } catch (error) {
    console.error("Error saving project:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

//save text msgs
exports.saveMessage = async (req, res) => {
  try {
    const { projectId, text, role, email, image } = req.body;

    const project = await Project.findOne({
      generatedName: projectId,
      status: "active",
    });
    const user = await User.findOne({ email });
    if (!project || !user) {
      return res.status(404).json({
        success: false,
        message: "Project or User not found.",
      });
    }

    if (project.owner.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to save messages for this project.",
      });
    }

    const message = await Message.create({
      text,
      role,
      projectId: project._id,
      user: user._id,
      images: image,
    });

    //udpating the prompt count
    if (user.promptCount > 0) {
      user.promptCount = user.promptCount - 1;
      await user.save();
    }

    if (role === "user") {
      await Project.findByIdAndUpdate(project._id, {
        $set: {
          lastResponder: "user",
        },
      });
    } else {
      await Project.findByIdAndUpdate(project._id, {
        $set: {
          lastResponder: "ai",
        },
      });
    }

    res.json({
      success: true,
      message: "Message saved successfully!",
      message: message,
    });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

//save to memory
exports.saveMemory = async (req, res) => {
  try {
    const { projectId, text, email } = req.body;

    const project = await Project.findOne({
      generatedName: projectId,
      status: "active",
    });
    const user = await User.findOne({ email: email });
    if (!project || !user) {
      return res.status(404).json({
        success: false,
        message: "Project or User not found.",
      });
    }

    await Project.findByIdAndUpdate(project._id, {
      $set: {
        memory: text,
      },
    });

    res.json({
      success: true,
      message: "Memory saved successfully!",
    });
  } catch (error) {
    console.error("Error saving memory:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// actions
//update project name, make public/private, delete, isPinned actions
exports.updateProject = async (req, res) => {
  try {
    const { projectId, action, name, value } = req.body;
    const project = await Project.findOne({
      generatedName: projectId,
      status: "active",
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const updateFields = {};

    if (action === "update-name") {
      updateFields.title = name;
    } else if (action === "make-public") {
      updateFields.isPublic = true;
    } else if (action === "make-private") {
      updateFields.isPublic = false;
    } else if (action === "delete") {
      await Project.findByIdAndUpdate(project._id, {
        $set: { status: "deleted" },
      });
      return res.json({
        success: true,
        message: "Project deleted successfully!",
      });
    } else if (action === "pin") {
      updateFields.isPinned = value;
    }

    if (Object.keys(updateFields).length > 0) {
      await Project.findByIdAndUpdate(project._id, { $set: updateFields });
    }

    res.json({
      success: true,
      message: "Project updated successfully!",
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Load more messages with pagination (20 messages per request)
exports.loadMoreMessages = async (req, res) => {
  try {
    const { projectId, page = 0 } = req.body;
    const limit = 20; // Number of messages per page
    const skip = page * limit; // Calculate how many messages to skip

    // Find the project
    const project = await Project.findOne(
      { generatedName: projectId, status: "active" },
      { _id: 1 }
    )
      .lean()
      .exec();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found!",
      });
    }

    // Get total count of messages for this project
    const totalMessages = await Message.countDocuments({
      projectId: project._id,
    });

    // Fetch messages with pagination
    const messages = await Message.find(
      { projectId: project._id },
      { _id: 0, __v: 0, projectId: 0 }
    )
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No more messages found!",
      });
    }

    // Calculate if there are more messages to load
    const hasMore = totalMessages > skip + messages.length;

    res.json({
      success: true,
      messages,
      hasMore,
      totalMessages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error loading more messages:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// savemessage helper
exports.saveMessageHelper = async ({
  projectId,
  email,
  text,
  role,
  image,
  plan,
}) => {
  try {
    const project = await Project.findOne({
      generatedName: projectId,
      status: "active",
    });
    const user = await User.findOne({ email });
    if (!project || !user) {
      return res.status(404).json({
        success: false,
        message: "Project or User not found.",
      });
    }

    if (project.owner.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to save messages for this project.",
      });
    }

    // save message
    const message = await Message.create({
      text,
      role,
      projectId: project._id,
      user: user._id,
      images: image,
    });
    //save plan
    if (plan) {
      const cleaned = plan
        .replace(/___start___/, "")
        .replace(/___end___/, "")
        .trim();

      const urlMatch = cleaned.match(/"url":\s*"([^"]+)"/);

      if (urlMatch) {
        const img = await processImageData(urlMatch[1]);

        const newplan = new Plan({
          text: plan,
          role,
          projectId: project._id,
          user: user._id,
          images: image,
          ImagetoClone: JSON.stringify(img),
        });
        await newplan.save();
      } else {
        const newplan = new Plan({
          text: plan,
          role,
          projectId: project._id,
          user: user._id,
          images: image,
        });
        await newplan.save();
      }
    }
    //udpating the prompt count
    if (user.promptCount > 0) {
      user.promptCount = user.promptCount - 1;
      await user.save();
    }

    if (role === "user") {
      await Project.findByIdAndUpdate(project._id, {
        $set: {
          lastResponder: "user",
        },
      });
    } else {
      await Project.findByIdAndUpdate(project._id, {
        $set: {
          lastResponder: "ai",
        },
      });
    }

    return true;
  } catch (error) {
    console.log(error, "issues while saving");
    return false;
  }
};

exports.saveCode = async (req, res) => {
  const { projectId, userId, file, code } = req.body;

  try {
    if (!projectId || !userId || !file || !code) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const existingCode = await Code.findOne({ user: userId, projectId });

    if (existingCode) {
      console.log("Adding file to existing project");
      existingCode.files.push({ file, code });
      await existingCode.save();
      return res.status(200).json({ message: "Code saved successfully." });
    } else {
      console.log("Creating new code entry for project");
      await Code.create({
        projectId,
        user: userId,
        files: [{ file, code }],
      });
      return res.status(201).json({ message: "Code created successfully." });
    }
  } catch (error) {
    console.error("Error while saving code:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
