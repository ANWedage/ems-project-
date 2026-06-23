const https = require('https');

/**
 * Sends email via SendGrid's plain HTTPS API (v3/mail/send), with no
 * dependency on the @sendgrid/mail SDK package. This avoids npm registry
 * issues some environments hit when installing @sendgrid/mail (e.g. a
 * 403 from a restricted/corporate npm registry), since `https` ships
 * with Node itself - nothing extra to install.
 *
 * Behavior is unchanged from before: safe, never throws, never breaks
 * the main app flow, and skips quietly if env vars are missing.
 */

function ensureConfigured() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;

  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set - emails will be skipped.');
    return null;
  }
  if (!fromAddress) {
    console.warn('[email] EMAIL_FROM not set - skipping email send.');
    return null;
  }
  return { apiKey, fromAddress };
}

function postToSendGrid(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);

    const req = https.request(
      {
        hostname: 'api.sendgrid.com',
        path: '/v3/mail/send',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          // SendGrid returns 202 with an empty body on success.
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`SendGrid responded ${res.statusCode}: ${responseBody || '(empty body)'}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Send email using SendGrid's HTTPS API directly.
 * Safe: never throws, never breaks main app flow.
 */
async function sendEmail({ to, subject, text, html }) {
  try {
    if (!to) {
      console.warn('[email] No recipient provided');
      return;
    }

    const config = ensureConfigured();
    if (!config) return;

    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: config.fromAddress }, // must be verified in SendGrid
      subject: subject || 'Notification',
      content: [
        { type: 'text/plain', value: text || '' },
        { type: 'text/html', value: html || `<p>${text || ''}</p>` },
      ],
    };

    await postToSendGrid(config.apiKey, payload);

    console.log(`[email] sent "${subject}" to ${to}`);
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${to}: ${err.message}`);
  }
}

module.exports = {
  sendEmail,
};
