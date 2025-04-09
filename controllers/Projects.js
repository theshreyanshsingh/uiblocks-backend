const { generateProjectDetails } = require("../helpers/AINames");
const Project = require("../models/Project");
const User = require("../models/User");
const Message = require("../models/Message");
const { s3, invalidateCloudFront } = require("../helpers/Aws");
const { BUCKET_NAME, BUCKET_URL, CLOUDFRONTID } = require("../config");

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
      const text = await generateProjectDetails({
        input,
        data: images,
        memory,
      });

      const {
        projectName,
        message,
        summary,
        features,
        memoryEnhancement,
        theme,
      } = text;

      const prompt = {
        summary,
        features,
        memoryEnhancement,
        theme,
      };

      const project = await Project.create({
        title: projectName,
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

      console.log("4");
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
