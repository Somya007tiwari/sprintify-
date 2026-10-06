const nodemailer = require('nodemailer');

/**
 * Asynchronously send an email notification if SMTP is configured.
 * Fire-and-forget, wrapped in try/catch to ensure caller is never blocked or affected.
 */
async function sendNotificationEmail({ to, subject, title, body, link }) {
  try {
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost || !smtpHost.trim()) {
      // SMTP not configured - silently skip
      return;
    }

    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const mailFrom = process.env.MAIL_FROM || 'Sprintify <noreply@sprintify.app>';
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: (smtpUser && smtpPass) ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    const fullLink = link ? (link.startsWith('http') ? link : `${frontendUrl}${link.startsWith('/') ? '' : '/'}${link}`) : frontendUrl;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #FAF7F2; padding: 24px; color: #2B2A28;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E8E2D9; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(43,42,40,0.05);">
          <div style="border-bottom: 1px solid #E8E2D9; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #3FA796; margin: 0; font-size: 20px;">Sprintify</h2>
          </div>
          <h3 style="margin-top: 0; color: #2B2A28; font-size: 16px;">${title}</h3>
          ${body ? `<p style="color: #7A746B; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">${body}</p>` : ''}
          <div style="margin-top: 24px;">
            <a href="${fullLink}" style="display: inline-block; background-color: #3FA796; color: #FFFFFF; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; font-size: 13px;">View in Sprintify</a>
          </div>
          <div style="margin-top: 32px; border-t: 1px solid #E8E2D9; pt: 16px; font-size: 11px; color: #7A746B;">
            You are receiving this email based on your Sprintify notification preferences.
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: mailFrom,
      to,
      subject: subject || title,
      html: htmlContent,
      text: `${title}\n\n${body || ''}\n\nView: ${fullLink}`,
    });
    console.log(`[Email Service] Sent email to ${to}: "${subject}"`);
  } catch (err) {
    console.warn(`[Email Service Warning] Failed to send email to ${to}: ${err.message}`);
  }
}

module.exports = {
  sendNotificationEmail,
};
