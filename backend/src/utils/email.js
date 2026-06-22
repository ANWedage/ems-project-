const { Resend } = require('resend');

let resendClient = null;

function getClient() {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set - emails will be skipped.');
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Sends an email for a critical action (task assigned, leave approved, etc)
 * using Resend's HTTPS API.
 *
 * Why Resend: it sends over HTTPS (port 443, never blocked by hosts like
 * Render), has a genuinely free tier (100/day, 3000/month, no card), and
 * new accounts aren't subjected to the kind of "0 credits, under review"
 * wall that SendGrid can apply to brand-new signups.
 *
 * Never throws - email failures should never break the actual business
 * operation (e.g. a task should still get created even if the email
 * provider has an outage or the API key is misconfigured).
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to) return;

  const client = getClient();
  if (!client) return;

  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) {
    console.warn('[email] EMAIL_FROM not set - skipping email send.');
    return;
  }

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });

    if (error) {
      console.error(`[email] failed to send "${subject}" to ${to}:`, error.message || error);
      return;
    }

    console.log(`[email] sent "${subject}" to ${to} (id: ${data?.id})`);
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, err.message);
  }
}

module.exports = { sendEmail };
