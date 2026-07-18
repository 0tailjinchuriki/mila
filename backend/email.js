import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'USMC-LAS <onboarding@resend.dev>';

const verificationTemplate = (code) => ({
  subject: 'USMC-LAS - Email Verification Code',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
      <div style="text-align: center; margin-bottom: 2rem;">
        <h1 style="color: #0b3d91; font-size: 1.5rem; text-transform: uppercase;">United States Marine Corps</h1>
        <p style="color: #666; font-size: 0.9rem;">Leave Application System</p>
      </div>
      <div style="background: #f0f7ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 1.5rem; text-align: center; margin-bottom: 1.5rem;">
        <p style="color: #1e40af; font-size: 0.9rem; margin-bottom: 0.5rem;">Your verification code is:</p>
        <p style="color: #0b3d91; font-size: 2rem; font-weight: bold; letter-spacing: 0.5rem; margin: 0;">${code}</p>
      </div>
      <p style="color: #666; font-size: 0.85rem; text-align: center;">This code expires in 10 minutes. Do not share this code with anyone.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;" />
      <p style="color: #999; font-size: 0.75rem; text-align: center;">USMC Leave Application System. This is an automated message.</p>
    </div>
  `
});

const forgotPasswordTemplate = (code) => ({
  subject: 'USMC-LAS - Password Reset Code',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
      <div style="text-align: center; margin-bottom: 2rem;">
        <h1 style="color: #0b3d91; font-size: 1.5rem; text-transform: uppercase;">United States Marine Corps</h1>
        <p style="color: #666; font-size: 0.9rem;">Leave Application System</p>
      </div>
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 1.5rem; text-align: center; margin-bottom: 1.5rem;">
        <p style="color: #92400e; font-size: 0.9rem; margin-bottom: 0.5rem;">Your password reset code is:</p>
        <p style="color: #92400e; font-size: 2rem; font-weight: bold; letter-spacing: 0.5rem; margin: 0;">${code}</p>
      </div>
      <p style="color: #666; font-size: 0.85rem; text-align: center;">This code expires in 10 minutes. If you did not request a password reset, ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;" />
      <p style="color: #999; font-size: 0.75rem; text-align: center;">USMC Leave Application System. This is an automated message.</p>
    </div>
  `
});

const adminEmailTemplate = (userName, message) => ({
  subject: 'US MARINE LEAVE REQUEST UPDATE',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
      <div style="text-align: center; margin-bottom: 2rem;">
        <h1 style="color: #0b3d91; font-size: 1.5rem; text-transform: uppercase;">United States Marine Corps</h1>
        <p style="color: #666; font-size: 0.9rem;">Leave Application System</p>
      </div>
      <div style="background: #f0f7ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <p style="color: #1e40af; font-size: 0.9rem; font-weight: bold; margin-bottom: 0.5rem;">US MARINE LEAVE REQUEST UPDATE</p>
        <p style="color: #555; font-size: 0.9rem;">Dear ${userName},</p>
        <div style="color: #333; font-size: 0.9rem; line-height: 1.6; margin-top: 1rem; white-space: pre-wrap;">${message}</div>
      </div>
      <p style="color: #666; font-size: 0.85rem; text-align: center;">This is an official update regarding your leave application. Please review the message above.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;" />
      <p style="color: #999; font-size: 0.75rem; text-align: center;">USMC Leave Application System. This is an automated message.</p>
    </div>
  `
});

export const sendVerificationEmail = async (to, code) => {
  const { subject, html } = verificationTemplate(code);
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html
  });
};

export const sendForgotPasswordEmail = async (to, code) => {
  const { subject, html } = forgotPasswordTemplate(code);
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html
  });
};

export const sendAdminEmail = async (to, userName, message) => {
  const { subject, html } = adminEmailTemplate(userName, message);
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html
  });
};
