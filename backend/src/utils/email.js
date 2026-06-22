const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[email] SMTP not configured - emails will be skipped. Set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to enable.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465, // true for port 465, false for 587/others
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

/**
 * Sends an email for a critical action (task assigned, leave approved, etc).
 * Never throws - email failures should never break the actual business
 * operation (e.g. a task should still get created even if the email fails
 * to send because of a bad SMTP password or network blip).
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to) return;

  const t = getTransporter();
  if (!t) return; // SMTP not configured, silently skip

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });
    console.log(`[email] sent "${subject}" to ${to}`);
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, err.message);
  }
}

module.exports = { sendEmail };
