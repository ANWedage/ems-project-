const sgMail = require('@sendgrid/mail');

let initialized = false;

/**
 * Initialize SendGrid only once
 */
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
 * Send email using SendGrid API (HTTPS)
 * Safe: never throws, never breaks main app flow
 */
async function sendEmail({ to, subject, text, html }) {
  try {
    if (!to) {
      console.warn('[email] No recipient provided');
      return;
    }

    if (!ensureInitialized()) return;

    const fromAddress = process.env.EMAIL_FROM;

    if (!fromAddress) {
      console.warn('[email] EMAIL_FROM not set - skipping email send.');
      return;
    }

    await sgMail.send({
      to,
      from: fromAddress, // must be verified in SendGrid
      subject: subject || 'Notification',
      text: text || '',
      html: html || `<p>${text || ''}</p>`,
    });

    console.log(`[email] sent "${subject}" to ${to}`);
  } catch (err) {
    const detail =
      err.response?.body?.errors?.map((e) => e.message).join('; ') ||
      err.message;

    console.error(`[email] failed to send "${subject}" to ${to}: ${detail}`);
  }
}

/**
 * EXPORTS (IMPORTANT FIX)
 */
module.exports = {
  sendEmail,
};
