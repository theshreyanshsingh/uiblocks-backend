const { Resend } = require("resend");
require("dotenv").config();
const resend = new Resend(process.env.MOON);

exports.MoonMail = async ({
  to,
  from,
  subject,
  html,
  cc,
  bcc,
  attachments,
  body,
}) => {
  try {
    console.log("reached");
    await resend.emails.send({
      from: from,
      to: [to],
      subject: subject,
      html: html,
      text: body,
      cc,
      bcc,
      attachments,
    });
  } catch (error) {
    console.log(error, "unable to send moon mails");
  }
};
