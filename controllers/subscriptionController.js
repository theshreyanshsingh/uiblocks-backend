const User = require("../models/User");

const Subscription = require("../models/Subscription");

exports.handleWebhook = async (req, res) => {
  try {
    const data = req.body;

    if (!data || !data.type || !data.data) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook data",
      });
    }

    const { type } = data;
    const subscriptionData = data.data;
    const customerEmail = subscriptionData.customer?.email;
    // const id = subscriptionData.customer?.external_id;
    const subscriptionId = subscriptionData.id;

    if (!customerEmail) {
      console.error("Customer email or id not found in webhook data");
      return res.status(200).json({ success: false }); // Return 200 to acknowledge receipt
    }

    if (!subscriptionId) {
      console.error("Subscription ID not found in webhook data");
      return res.status(200).json({ success: false }); // Return 200 to acknowledge receipt
    }

    // Find user by email
    const user = await User.findOne({ email: customerEmail });
    if (!user) {
      console.error(`User not found for email: ${customerEmail}`);
      return res.status(200).json({ success: false }); // Return 200 to acknowledge receipt
    }

    // Check if this is a duplicate event for the same subscription
    const existingSubscription = await Subscription.findOne({ subscriptionId });
    if (existingSubscription && type === "subscription.created") {
      console.log(
        `Duplicate subscription creation event for ID: ${subscriptionId}, skipping processing`
      );
      return res.status(200).json({ success: false }); // Return 200 to acknowledge receipt
    }

    // Process based on event type
    switch (type) {
      case "subscription.created":
      case "subscription.active":
        await handleSubscriptionActive(user, subscriptionData);
        break;

      case "subscription.updated":
        await handleSubscriptionUpdated(user, subscriptionData);
        break;

      case "subscription.canceled":
      case "subscription.revoked":
        await handleSubscriptionCanceled(user, subscriptionData);
        break;

      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }

    // Update subscription record
    await updateSubscriptionRecord(customerEmail, subscriptionData);

    // Return success with current plan and subscription status
    res.status(200).json({
      success: true,
      plan: user.plan,
      promptCount: user.promptCount,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndDate: user.subscriptionEndDate,
    });
  } catch (e) {
    console.error("Webhook Processing Error:", e);
    res.status(500).json({
      success: false,
      message: "Server error while processing webhook",
    });
  }
};

// Helper function to handle active subscriptions
async function handleSubscriptionActive(user, subscriptionData) {
  try {
    // Check if subscription ID is provided
    if (!subscriptionData.id) {
      console.error("No subscription ID provided in webhook data");
      return;
    }

    // Check if this subscription event has already been processed
    if (user.subscriptionIds.includes(subscriptionData.id)) {
      console.log(
        `Subscription with ID ${subscriptionData.id} already exists for user ${user.email}, skipping activation`
      );
      return;
    }

    // Determine plan type based on product name or amount
    let planType = "scale"; // Default to scale plan
    if (subscriptionData.product?.name) {
      // You can map product names to plan types here if needed
      // For example: if (subscriptionData.product.name === "Premium") planType = "unlimited";
    }

    // Set subscription details
    user.plan = planType;
    user.subscriptionStatus = "active";
    user.subscriptionStartDate = new Date(subscriptionData.currentPeriodStart);
    user.subscriptionEndDate = new Date(subscriptionData.currentPeriodEnd);
    user.promptCount = planType === "scale" ? 200 : 0;
    user.lastPromptReset = new Date();

    // Store subscription ID for reference
    user.subscriptionIds.push(subscriptionData.id);

    await user.save();
    console.log(`Subscription activated for user: ${user.email}`);
  } catch (error) {
    console.error("Error handling active subscription:", error);
  }
}

// Helper function to handle subscription updates
async function handleSubscriptionUpdated(user, subscriptionData) {
  try {
    // Check if subscription ID is provided
    if (!subscriptionData.id) {
      console.error("No subscription ID provided in webhook data");
      return;
    }

    // Check if this subscription exists for the user
    if (!user.subscriptionIds.includes(subscriptionData.id)) {
      console.log(
        `Subscription with ID ${subscriptionData.id} not found for user ${user.email}, adding it`
      );
      user.subscriptionIds.push(subscriptionData.id);
    }

    // Check if status is changed
    if (subscriptionData.status === "active") {
      await handleSubscriptionActive(user, subscriptionData);
    } else if (subscriptionData.status === "canceled") {
      await handleSubscriptionCanceled(user, subscriptionData);
    } else {
      // Update period dates if they've changed
      if (subscriptionData.currentPeriodStart) {
        user.subscriptionStartDate = new Date(
          subscriptionData.currentPeriodStart
        );
      }
      if (subscriptionData.currentPeriodEnd) {
        user.subscriptionEndDate = new Date(subscriptionData.currentPeriodEnd);
      }
      await user.save();
    }
    console.log(`Subscription updated for user: ${user.email}`);
  } catch (error) {
    console.error("Error handling subscription update:", error);
  }
}

// Helper function to handle canceled subscriptions
async function handleSubscriptionCanceled(user, subscriptionData) {
  try {
    // Check if subscription ID is provided
    if (!subscriptionData.id) {
      console.error("No subscription ID provided in webhook data");
      return;
    }

    // Check if this subscription exists for the user
    if (!user.subscriptionIds.includes(subscriptionData.id)) {
      console.log(
        `Subscription with ID ${subscriptionData.id} not found for user ${user.email}, cannot cancel`
      );
      return;
    }

    // If subscription is canceled immediately (not at period end)
    if (!subscriptionData.cancelAtPeriodEnd) {
      user.plan = "free";
      user.subscriptionStatus = "inactive";
      user.promptCount = 0;
    } else {
      // Subscription will be canceled at period end
      user.subscriptionStatus = "canceling";
    }

    await user.save();
    console.log(`Subscription canceled for user: ${user.email}`);
  } catch (error) {
    console.error("Error handling subscription cancellation:", error);
  }
}

// Helper function to update or create subscription record
async function updateSubscriptionRecord(email, subscriptionData) {
  try {
    // Check if subscription already exists with this ID
    if (!subscriptionData.id) {
      console.log("No subscription ID provided in webhook data");
      return;
    }

    // First check if a subscription record already exists for this email
    let subscription = await Subscription.findOne({ email });

    if (!subscription) {
      subscription = new Subscription({
        email,
        name: subscriptionData.customer?.name || "",
        plan: "scale", // Default to scale plan
        status: subscriptionData.status,
        subscriptionId: subscriptionData.id, // Store the subscription ID
      });
    } else if (subscription.subscriptionId === subscriptionData.id) {
      console.log(
        `Subscription with ID ${subscriptionData.id} already exists for ${email}, updating details`
      );
    }

    // Update subscription details
    subscription.status =
      subscriptionData.status === "active"
        ? "active"
        : subscriptionData.status === "canceled"
        ? "inactive"
        : "pending";

    // Always store the subscription ID for reference
    subscription.subscriptionId = subscriptionData.id;

    if (subscriptionData.currentPeriodStart) {
      subscription.startDate = new Date(subscriptionData.currentPeriodStart);
    }

    if (subscriptionData.currentPeriodEnd) {
      subscription.endDate = new Date(subscriptionData.currentPeriodEnd);
    }

    await subscription.save();
  } catch (error) {
    console.error("Error updating subscription record:", error);
  }
}

exports.createSubscription = async (req, res) => {
  try {
    const { name, email, plan } = req.body;

    if (!email || !plan) {
      return res.status(400).json({
        success: false,
        message: "Email and plan are required",
      });
    }

    const subscription = new Subscription({
      name,
      email,
      plan,
      status: "pending",
    });

    await subscription.save();

    res.status(201).json({
      success: true,
      message: "Subscription created with pending status",
      subscription,
    });
  } catch (error) {
    console.error("Create Subscription Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating subscription",
    });
  }
};
exports.updateSubscriptionStatus = async (req, res) => {
  try {
    const { email, status, startDate, endDate } = req.body;

    if (!email || !status || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Email, status, startDate and endDate are required",
      });
    }

    const subscription = await Subscription.findOne({ email });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    subscription.status = status;
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    await subscription.save();

    res.json({
      success: true,
      message: "Subscription status updated successfully",
      subscription,
    });
  } catch (error) {
    console.error("Update Subscription Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating subscription status",
    });
  }
};

exports.upgradePlan = async (req, res) => {
  try {
    const { email, planType, isExtension } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Set subscription details
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    if (planType === "scale") {
      if (isExtension && user.plan === "scale") {
        // $15 for additional 200 prompts extension
        user.promptCount += 200;
      } else {
        // Initial $20 for 200 prompts plan
        user.plan = "scale";
        user.promptCount = 200;
      }

      user.subscriptionStatus = "active";
      user.subscriptionStartDate = startDate;
      user.subscriptionEndDate = endDate;
      user.lastPromptReset = new Date();

      await user.save();
    }
    res.json({
      success: true,
      message: "Successfully upgraded to Scale plan",
      plan: user.plan,
      subscriptionEndDate: user.subscriptionEndDate,
    });
  } catch (error) {
    console.error("Upgrade Plan Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while upgrading plan",
    });
  }
};

exports.downgradeToFree = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user to free plan
    user.plan = "free";
    user.subscriptionStatus = "inactive";
    user.subscriptionStartDate = null;
    user.subscriptionEndDate = null;
    user.promptCount = 0;
    user.lastPromptReset = new Date();

    await user.save();

    res.json({
      success: true,
      message: "Successfully downgraded to Free plan",
      plan: user.plan,
    });
  } catch (error) {
    console.error("Downgrade Plan Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while downgrading plan",
    });
  }
};

exports.getSubscriptionStatus = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let promptLimit = 5; // Default free plan
    let totalPrompts = user.promptCount;

    if (user.plan === "scale") {
      promptLimit = 200;
    } else if (user.plan === "unlimited") {
      promptLimit = 200 + user.unlimitedPromptPacks * 200;
      totalPrompts = user.promptCount + user.unlimitedPromptCount;
    }

    res.json({
      success: true,
      plan: user.plan,
      promptCount: totalPrompts,
      promptLimit: promptLimit,
      unlimitedPromptPacks: user.unlimitedPromptPacks || 0,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndDate: user.subscriptionEndDate,
    });
  } catch (error) {
    console.error("Subscription Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching subscription status",
    });
  }
};
