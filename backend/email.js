import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'USMC-LAS <info@usmarinelas.site>';
const LOGO_URL = 'https://usmarinelas.site/usmc.png';

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border:1px solid #d0d0d0;">
        <tr>
          <td style="padding:24px 32px 16px;border-bottom:2px solid #1a1a1a;text-align:center;">
            <img src="${LOGO_URL}" alt="USMC-LAS" width="48" height="48" style="display:block;margin:0 auto 12px;" />
            <p style="margin:0;color:#1a1a1a;font-size:16px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">USMC-LAS</p>
            <p style="margin:4px 0 0;color:#555;font-size:11px;letter-spacing:1px;">Leave Application System</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;border-top:1px solid #d0d0d0;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#888;font-size:11px;">USMC-LAS &mdash; Official Communication</p>
            <p style="margin:4px 0 0;color:#888;font-size:11px;">This is an automated message. Please do not reply directly.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const verificationTemplate = (code) => ({
  subject: 'USMC-LAS - Email Verification Code',
  html: baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:18px;">Verify Your Email</h2>
    <p style="margin:0 0 20px;color:#555;font-size:14px;">Use the code below to verify your email address.</p>
    <div style="background:#f5f5f5;border:2px dashed #999;padding:24px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Verification Code</p>
      <p style="margin:0;color:#1a1a1a;font-size:32px;font-weight:800;letter-spacing:8px;font-family:'Courier New',monospace;">${code}</p>
    </div>
    <p style="margin:0;color:#999;font-size:12px;text-align:center;">This code expires in 10 minutes. Do not share this code with anyone.</p>
  `)
});

const forgotPasswordTemplate = (code) => ({
  subject: 'USMC-LAS - Password Reset Code',
  html: baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:18px;">Password Reset Request</h2>
    <p style="margin:0 0 20px;color:#555;font-size:14px;">We received a request to reset your password. Use the code below.</p>
    <div style="background:#f5f5f5;border:2px dashed #999;padding:24px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Reset Code</p>
      <p style="margin:0;color:#1a1a1a;font-size:32px;font-weight:800;letter-spacing:8px;font-family:'Courier New',monospace;">${code}</p>
    </div>
    <p style="margin:0;color:#999;font-size:12px;text-align:center;">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
  `)
});

const adminEmailTemplate = (userName, applicationNumber, message) => ({
  subject: 'USMC-LAS - Leave Request Update',
  html: baseTemplate(`
    <p style="margin:0 0 16px;color:#1a1a1a;font-size:14px;">Dear ${userName},</p>
    <p style="margin:0 0 8px;color:#555;font-size:13px;">Application ID: <strong>${applicationNumber || 'N/A'}</strong></p>
    <p style="margin:0 0 20px;color:#555;font-size:13px;">Below is an update regarding your leave application:</p>
    <div style="border-left:3px solid #1a1a1a;padding:16px 20px;margin-bottom:20px;background:#fafafa;">
      <div style="color:#333;font-size:14px;line-height:1.7;white-space:pre-wrap;">${message}</div>
    </div>
    <p style="margin:0;color:#888;font-size:12px;">If you have any questions, please contact your unit administrator.</p>
  `)
});

const receiptConfirmationTemplate = (applicationNumber, invoiceNumber) => ({
  subject: `USMC-LAS - Invoice ${invoiceNumber} Received`,
  html: baseTemplate(`
    <p style="margin:0 0 16px;color:#1a1a1a;font-size:14px;">Dear Applicant,</p>
    <p style="margin:0 0 8px;color:#555;font-size:13px;">Application ID: <strong>${applicationNumber || 'N/A'}</strong></p>
    <p style="margin:0 0 20px;color:#555;font-size:13px;">Invoice Number: <strong>${invoiceNumber}</strong></p>
    <p style="margin:0 0 16px;color:#333;font-size:14px;line-height:1.6;">We have received your payment receipt for your application fee of <strong>$239.00</strong>. Your receipt is now being reviewed by our team.</p>
    <p style="margin:0 0 16px;color:#333;font-size:14px;line-height:1.6;">You will be contacted once the review is complete. Please allow up to 48 hours for processing.</p>
    <p style="margin:0;color:#888;font-size:12px;">Please keep your invoice number for your records. If you have any questions, contact your unit administrator.</p>
  `)
});

const supportNotificationTemplate = (userName, userEmail, subject, message) => ({
  subject: `USMC-LAS Support: ${subject}`,
  html: baseTemplate(`
    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px;">New Support Request</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d0d0d0;margin-bottom:20px;">
      <tr><td style="padding:12px 16px;border-bottom:1px solid #d0d0d0;background:#fafafa;"><strong style="color:#555;font-size:12px;text-transform:uppercase;letter-spacing:1px;">From</strong></td><td style="padding:12px 16px;border-bottom:1px solid #d0d0d0;color:#1a1a1a;font-size:14px;">${userName} &lt;${userEmail}&gt;</td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #d0d0d0;background:#fafafa;"><strong style="color:#555;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Subject</strong></td><td style="padding:12px 16px;border-bottom:1px solid #d0d0d0;color:#1a1a1a;font-size:14px;">${subject}</td></tr>
      <tr><td style="padding:12px 16px;background:#fafafa;"><strong style="color:#555;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date</strong></td><td style="padding:12px 16px;color:#555;font-size:13px;">${new Date().toLocaleString()}</td></tr>
    </table>
    <p style="margin:0 0 8px;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Message</p>
    <div style="color:#333;font-size:14px;line-height:1.7;white-space:pre-wrap;background:#fafafa;border:1px solid #d0d0d0;padding:16px;margin-bottom:20px;">${message}</div>
    <p style="margin:0;color:#888;font-size:12px;">Log in to the Admin Console to view and respond to this message.</p>
  `)
});

const customEmailTemplate = (subject, body) => ({
  subject,
  html: baseTemplate(`
    <div style="color:#333;font-size:14px;line-height:1.7;white-space:pre-wrap;">${body}</div>
  `)
});

export const sendVerificationEmail = async (to, code) => {
  const { subject, html } = verificationTemplate(code);
  return resend.emails.send({ from: FROM_EMAIL, to, subject, html });
};

export const sendForgotPasswordEmail = async (to, code) => {
  const { subject, html } = forgotPasswordTemplate(code);
  return resend.emails.send({ from: FROM_EMAIL, to, subject, html });
};

export const sendAdminEmail = async (to, userName, applicationNumber, message) => {
  const { subject, html } = adminEmailTemplate(userName, applicationNumber, message);
  return resend.emails.send({ from: FROM_EMAIL, to, subject, html });
};

export const sendReceiptConfirmationEmail = async (to, applicationNumber, invoiceNumber) => {
  const { subject, html } = receiptConfirmationTemplate(applicationNumber, invoiceNumber);
  return resend.emails.send({ from: FROM_EMAIL, to, subject, html });
};

export const sendSupportNotificationEmail = async (userName, userEmail, subject, message) => {
  const tpl = supportNotificationTemplate(userName, userEmail, subject, message);
  return resend.emails.send({ from: FROM_EMAIL, to: process.env.ADMIN_EMAIL || 'admin@usmc-las.gov', subject: tpl.subject, html: tpl.html });
};

export const sendCustomEmail = async (to, subject, body, attachments) => {
  const tpl = customEmailTemplate(subject, body);
  const opts = { from: FROM_EMAIL, to, subject: tpl.subject, html: tpl.html };
  if (attachments && attachments.length > 0) {
    opts.attachments = attachments.map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64')
    }));
  }
  return resend.emails.send(opts);
};
