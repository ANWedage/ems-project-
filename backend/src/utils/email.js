const sgMail = require('@sendgrid/mail');

let initialized = false;

function ensureInitialized() {
  if (initialized) return true;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set - emails will be skipped.');
    return false;
  }

  sgMail.setApiKey(apiKey);
  initialized = true;
  return true;
}

/**
 * Sends an email for a critical action (task assigned, leave approved, etc)
 * using SendGrid's HTTPS API instead of raw SMTP.
 *
 * Why SendGrid instead of SMTP: many hosting providers (including Render)
 * block outbound SMTP ports (25/465/587) on free/standard tiers as an
 * anti-spam measure, which causes "Connection timeout" errors no matter how
 * correctly SMTP is configured. SendGrid's API runs over HTTPS (port 443),
 * which is never blocked, so this avoids that entire class of problem.
 *
 * Never throws - email failures should never break the actual business
 * operation (e.g. a task should still get created even if the email
 * provider has an outage or the API key is misconfigured).
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to) return;
  if (!ensureInitialized()) return;

  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) {
    console.warn('[email] EMAIL_FROM not set - skipping email send.');
    return;
  }

  try {
    await sgMail.send({
      to,
      from: fromAddress, // must match a verified Sender Identity in SendGrid
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });
    console.log(`[email] sent "${subject}" to ${to}`);
  } catch (err) {
    const detail = err.response?.body?.errors?.map((e) => e.message).join('; ') || err.message;
    console.error(`[email] failed to send "${subject}" to ${to}: ${detail}`);
  }
}

module.exports = { sendEmail };
