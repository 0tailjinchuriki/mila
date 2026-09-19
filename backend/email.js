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
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0b3d91,#1a4fa0);padding:28px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="USMC" width="56" height="56" style="border-radius:50%;background:#fff;padding:4px;margin-bottom:10px;" onerror="this.style.display='none'"/>
            <h1 style="margin:0;color:#ffffff;font-size:18px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">United States Marine Corps</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:1px;">Leave Application System</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">USMC Leave Application System &mdash; Official Communication</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">This is an automated message. Please do not reply directly.</p>
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
    <h2 style="margin:0 0 8px;color:#0b3d91;font-size:20px;">Verify Your Email</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Use the code below to verify your email address.</p>
    <div style="background:#eff6ff;border:2px dashed #3b82f6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#3b82f6;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Verification Code</p>
      <p style="margin:0;color:#0b3d91;font-size:36px;font-weight:800;letter-spacing:8px;font-family:'Courier New',monospace;">${code}</p>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">This code expires in 10 minutes. Do not share this code with anyone.</p>
  `)
});

const forgotPasswordTemplate = (code) => ({
  subject: 'USMC-LAS - Password Reset Code',
  html: baseTemplate(`
    <h2 style="margin:0 0 8px;color:#0b3d91;font-size:20px;">Password Reset Request</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">We received a request to reset your password. Use the code below.</p>
    <div style="background:#fefce8;border:2px dashed #eab308;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#ca8a04;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Reset Code</p>
      <p style="margin:0;color:#92400e;font-size:36px;font-weight:800;letter-spacing:8px;font-family:'Courier New',monospace;">${code}</p>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
  `)
});

const adminEmailTemplate = (userName, message) => ({
  subject: 'US MARINE LEAVE REQUEST UPDATE',
  html: baseTemplate(`
    <h2 style="margin:0 0 16px;color:#0b3d91;font-size:20px;">Leave Request Update</h2>
    <div style="background:#f8fafc;border-left:4px solid #0b3d91;border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap;">${message}</div>
    </div>
    <p style="margin:0;color:#64748b;font-size:13px;">If you have any questions, please contact your unit administrator.</p>
  `)
});

const receiptConfirmationTemplate = (invoiceNumber) => ({
  subject: `Invoice ${invoiceNumber} - Receipt Received`,
  html: baseTemplate(`
    <h2 style="margin:0 0 8px;color:#0b3d91;font-size:20px;">Payment Receipt Received</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Dear Applicant,</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:20px;">
      <tr><td>
        <p style="margin:0 0 4px;color:#3b82f6;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:600">Invoice Number</p>
        <p style="margin:0;color:#1e40af;font-size:24px;font-weight:800;letter-spacing:3px;font-family:'Courier New',monospace;">${invoiceNumber}</p>
      </td></tr>
    </table>
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">We have received your payment receipt for your application fee of <strong>$239.00</strong>. Your receipt is now being reviewed by our team.</p>
    <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;">You will be contacted once the review is complete. Please allow up to 48 hours for processing.</p>
    <div style="background:#f8fafc;border-left:4px solid #0b3d91;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">Please keep your invoice number <strong style="color:#0b3d91">${invoiceNumber}</strong> for your records. You will need it for any future correspondence regarding your application.</p>
    </div>
    <p style="margin:0;color:#64748b;font-size:13px;">If you have any questions, please contact your unit administrator.</p>
  `)
});

const customEmailTemplate = (subject, body) => ({
  subject,
  html: baseTemplate(`
    <div style="color:#334155;font-size:14px;line-height:1.7;">${body}</div>
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

export const sendAdminEmail = async (to, userName, message) => {
  const { subject, html } = adminEmailTemplate(userName, message);
  return resend.emails.send({ from: FROM_EMAIL, to, subject, html });
};

export const sendReceiptConfirmationEmail = async (to, invoiceNumber) => {
  const { subject, html } = receiptConfirmationTemplate(invoiceNumber);
  return resend.emails.send({ from: FROM_EMAIL, to, subject, html });
};

export const sendSupportNotificationEmail = async (userName, userEmail, subject, message) => {
  const tpl = ({
    subject: `USMC-LAS Support: ${subject}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;color:#0b3d91;font-size:20px;">New Support Request</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;">A new support message has been submitted by an applicant.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;">
        <tr><td style="padding:0 0 12px;border-bottom:1px solid #e2e8f0;margin-bottom:12px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;width:80px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">From</td>
              <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600">${userName} <span style="font-weight:400;color:#64748b">&lt;${userEmail}&gt;</span></td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Subject</td>
              <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600">${subject}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Date</td>
              <td style="padding:4px 0;color:#64748b;font-size:13px">${new Date().toLocaleString()}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding-top:16px">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Message</p>
          <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">${message}</div>
        </td></tr>
      </table>
      <p style="margin:0;color:#64748b;font-size:13px;">Log in to the <strong>Admin Console</strong> to view and respond to this message.</p>
    `)
  });
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
