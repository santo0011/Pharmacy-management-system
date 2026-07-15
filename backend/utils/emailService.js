import nodemailer from 'nodemailer';

/**
 * Send an email using the configured SMTP transport.
 * Falls back silently if SMTP is not configured.
 */
export async function sendEmail({ to, subject, html }) {
  // Skip if SMTP is not configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured. Email not sent.');
    return { success: false, message: 'SMTP not configured' };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const fromName = process.env.SMTP_FROM || 'Pharmacy Management System';

  const mailOptions = {
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error.message);
    throw error;
  }
}

/**
 * Build a professional HTML email template for password reset.
 */
export function buildResetEmailTemplate({ userName, resetUrl, expiresInMinutes }) {
  const appName = 'Pharmacy Management System';
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);padding:32px 24px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;text-align:center;vertical-align:middle;">
                    <span style="font-size:26px;line-height:56px;">🏥</span>
                  </td>
                </tr>
              </table>
              <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:14px 0 4px;letter-spacing:-0.3px;">${appName}</h1>
              <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:0;">Password Reset Request</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;">
              <h2 style="color:#0f172a;font-size:18px;font-weight:600;margin:0 0 8px;">Hello ${escapeHtml(userName)},</h2>
              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 16px;">
                We received a request to reset the password for your account. Click the button below to set a new password.
              </p>
              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;">
                This link will expire in <strong style="color:#0ea5e9;">${expiresInMinutes} minutes</strong>. If you did not request a password reset, please ignore this email.
              </p>

              <!-- Reset Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:8px;padding:0;">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 4px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="color:#0ea5e9;font-size:12px;line-height:1.5;word-break:break-all;margin:0 0 20px;background:#f8fafc;padding:10px 14px;border-radius:6px;border:1px solid #e2e8f0;">
                ${resetUrl}
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />

              <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;">
                If you didn't request this password reset, please secure your account by changing your password immediately or contact support.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 28px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">
                &copy; ${year} ${appName}. All rights reserved.
              </p>
              <p style="color:#94a3b8;font-size:11px;margin:0;">
                This is an automated message, please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Simple HTML entity escaping for user-provided text in emails.
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}