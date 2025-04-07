const AWS = require("aws-sdk");
const { BUCKET_REGION, AWS_ACCESS_KEY, AWS_SECRET_KEY } = require("../config");

// Configure AWS SDK
AWS.config.update({
  region: BUCKET_REGION,
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_KEY,
});

exports.s3 = new AWS.S3();

exports.invalidateCloudFront = async (distributionId, paths) => {
  try {
    const cloudfront = new AWS.CloudFront();

    await cloudfront
      .createInvalidation({
        DistributionId: distributionId, // Replace with your CloudFront distribution ID
        InvalidationBatch: {
          Paths: {
            Quantity: 1,
            Items: [
              `/projects/67e2aaa65148739d3ba86aec/67eac5301b5dc42792ffadc2`, // Invalidate everything under this path
            ],
          },
          CallerReference: `${Date.now()}`, // Use a unique identifier for the invalidation
        },
      })
      .promise();

    return true;
  } catch (error) {
    console.error("CloudFront invalidation failed:", error);
    throw error;
  }
};
