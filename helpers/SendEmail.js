const AWS = require("aws-sdk");
const {
  AWS_ACCESS_KEY_ID,
  AWS_REGION,
  AWS_SECRET_ACCESS_KEY,
} = require("../config");

AWS.config.update({
  region: AWS_REGION,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

// Create the SES service object
const ses = new AWS.SES();

// Function to send email
function sendEmail({ from, to, subject, bodyText, bodyHtml }) {
  const params = {
    Source: from,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
      },
      Body: {
        Text: {
          Data: bodyText,
        },
        Html: {
          Data: bodyHtml,
        },
      },
    },
  };
  ses.sendEmail(params, (err, data) => {
    if (err) {
      console.error("Error sending email:", err);
    } else {
      console.log("Email sent successfully:", data);
    }
  });
}

module.exports = { sendEmail };
