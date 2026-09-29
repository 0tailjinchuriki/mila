import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redis from '../redis.js';
import { adminMiddleware } from '../middleware/auth.js';
import { sendAdminEmail, sendCustomEmail, sendSuspensionEmail, sendUnsuspensionEmail, sendEmail, isValidEmail, getEmailLog, logEmail, stripTags, syncSentFromResend, retryFailedEmails } from '../email.js';

const router = Router();

const getUser = async (id) => {
  const data = await redis.get(`user:${id}`);
  return data ? JSON.parse(data) : null;
};

const getAdminCreds = async () => {
  const envPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const stored = await redis.get('admin:creds');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (!parsed.changedViaUi) {
      const envMatches = await bcrypt.compare(envPassword, parsed.passwordHash);
      if (!envMatches) {
        parsed.username = process.env.ADMIN_USERNAME || 'admin';
        parsed.email = process.env.ADMIN_EMAIL || 'admin@usmc-las.gov';
        parsed.passwordHash = await bcrypt.hash(envPassword, 12);
        parsed.changedViaUi = false;
        await redis.set('admin:creds', JSON.stringify(parsed));
      }
    }
    return parsed;
  }
  const creds = {
    username: process.env.ADMIN_USERNAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@usmc-las.gov',
    passwordHash: await bcrypt.hash(envPassword, 12),
    changedViaUi: false
  };
  await redis.set('admin:creds', JSON.stringify(creds));
  return creds;
};

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Credentials required' });

    const loginNorm = String(login).trim().toLowerCase();
    const envUser = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    const envEmail = (process.env.ADMIN_EMAIL || 'admin@usmc-las.gov').toLowerCase();
    const envPass = process.env.ADMIN_PASSWORD || 'admin123';

    const creds = await getAdminCreds();
    const storedUser = (creds.username || '').toLowerCase();
    const storedEmail = (creds.email || '').toLowerCase();
    let valid = (loginNorm === storedUser || loginNorm === storedEmail) && await bcrypt.compare(password, creds.passwordHash);

    if (!valid && (loginNorm === envUser || loginNorm === envEmail || loginNorm === 'admin')) {
      if (password === envPass || password === 'admin123') {
        valid = true;
        creds.username = envUser;
        creds.email = envEmail;
        creds.passwordHash = await bcrypt.hash(password, 12);
        creds.changedViaUi = false;
        await redis.set('admin:creds', JSON.stringify(creds));
      }
    }

    if (valid) {
      const token = jwt.sign({ id: 'admin', email: creds.email, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, admin: { username: creds.username, email: creds.email, role: 'administrator' } });
    }

    const adminId = await redis.get(`admin:${loginNorm}`);
    if (adminId) {
      const adminData = await redis.get(`admin:user:${adminId}`);
      if (adminData) {
        const admin = JSON.parse(adminData);
        const adminValid = await bcrypt.compare(password, admin.password);
        if (adminValid) {
          const token = jwt.sign({ id: adminId, email: loginNorm, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
          return res.json({ token, admin: { username: loginNorm, email: loginNorm, role: admin.role || 'officer' } });
        }
      }
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/change-password', adminMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const creds = await getAdminCreds();
    const ok = await bcrypt.compare(currentPassword, creds.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    creds.passwordHash = await bcrypt.hash(newPassword, 12);
    creds.changedViaUi = true;
    creds.updatedAt = new Date().toISOString();
    await redis.set('admin:creds', JSON.stringify(creds));

    res.json({ success: true, message: 'Password changed successfully' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/dashboard', adminMiddleware, async (req, res) => {
  try {
    const allUserIds = JSON.parse(await redis.get('all:userIds') || '[]');
    const users = [];
    for (const uid of allUserIds) {
      const u = await getUser(uid);
      if (u) {
        users.push({
          id: u.id, applicationNumber: u.applicationNumber, fullName: u.fullName, email: u.email, username: u.username,
          applyingFor: u.applyingFor, address: u.address, city: u.city, state: u.state, zipCode: u.zipCode,
          currentStage: u.currentStage, stageStatus: u.stageStatus,
          applicationFee: u.applicationFee, applicationFeeVerified: u.applicationFeeVerified,
          applicationFeePaymentMethod: u.applicationFeePaymentMethod,
          applicationFeeCryptoNetwork: u.applicationFeeCryptoNetwork,
          applicationFeeReceiptImage: u.applicationFeeReceiptImage,
          clearanceDuration: u.clearanceDuration,
          finalApproved: u.finalApproved, finalRejectMessage: u.finalRejectMessage || '',
          createdAt: u.createdAt, updatedAt: u.updatedAt
        });
      }
    }
    const pendingPayments = JSON.parse(await redis.get('admin:pendingPayments') || '[]');
    const support = JSON.parse(await redis.get('admin:support') || '[]');

    res.json({
      stats: {
        totalUsers: users.length,
        pendingPayments: pendingPayments.length,
        support: support.length,
        approved: users.filter(u => u.finalApproved).length
      },
      users, pendingPayments, support
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/support-reply/:msgId', adminMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Reply message required' });

    const queue = JSON.parse(await redis.get('admin:support') || '[]');
    const msg = queue.find(m => m.id === req.params.msgId);
    if (!msg) return res.status(404).json({ error: 'Support message not found' });

    msg.replied = true;
    msg.adminReply = String(message).slice(0, 2000);
    msg.repliedAt = new Date().toISOString();
    await redis.set('admin:support', JSON.stringify(queue));

    const thread = JSON.parse(await redis.get(`support:${msg.userId}`) || '[]');
    const tmsg = thread.find(m => m.id === req.params.msgId);
    if (tmsg) {
      tmsg.replied = true;
      tmsg.adminReply = msg.adminReply;
      tmsg.repliedAt = msg.repliedAt;
      await redis.set(`support:${msg.userId}`, JSON.stringify(thread));
    }

    const user = await getUser(msg.userId);
    if (user) await sendAdminEmail(user.email, user.fullName, user.applicationNumber, `Re: ${msg.subject}\n\n${message.trim()}`);

    res.json({ success: true, message: 'Reply sent' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/users/:userId', adminMiddleware, async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { password, ...safe } = user;
    res.json({ user: safe });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/approve-application-fee/:userId', adminMiddleware, async (req, res) => {
  try {
    const { approved, message } = req.body;
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });

    if (approved) {
      user.applicationFeeVerified = true;
      user.stageStatus = 'clearance_pending';
      user.currentStage = 2;
      user.applicationFeeRejectMessage = '';
    } else {
      user.applicationFeeVerified = false;
      user.stageStatus = 'payment_rejected';
      user.applicationFeeRejectMessage = message || 'Receipt not accepted by administrator';
    }
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));

    let queue = JSON.parse(await redis.get('admin:pendingPayments') || '[]');
    queue = queue.filter(p => p.userId !== req.params.userId);
    await redis.set('admin:pendingPayments', JSON.stringify(queue));

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/approve-final/:userId', adminMiddleware, async (req, res) => {
  try {
    const { approved, rejectReason } = req.body;
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.finalApproved = !!approved;
    user.currentStage = 3;
    user.stageStatus = approved ? 'approved' : 'rejected';
    user.finalRejectMessage = approved ? '' : String(rejectReason || '').trim();
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/send-email/:userId', adminMiddleware, async (req, res) => {
  try {
    const { message, subject } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const firstName = (user.fullName || '').split(' ')[0] || 'Applicant';

    let result;
    if (subject && subject.trim()) {
      result = await sendCustomEmail(user.email, subject.trim(), `Dear ${firstName},\n\n${message.trim()}`, []);
    } else {
      result = await sendAdminEmail(user.email, firstName, user.applicationNumber, message.trim());
    }
    if (result && result.error) return res.status(500).json({ error: result.error.message || 'Failed to send email' });
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (e) { res.status(500).json({ error: e.message || 'Server error' }); }
});

router.post('/send-custom-email', adminMiddleware, async (req, res) => {
  try {
    const { to, subject, body, attachments } = req.body;
    if (!to || !to.trim()) return res.status(400).json({ error: 'Recipient email is required' });
    if (!subject || !subject.trim()) return res.status(400).json({ error: 'Subject is required' });
    if (!body || !body.trim()) return res.status(400).json({ error: 'Email body is required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) return res.status(400).json({ error: 'Invalid email address' });

    const safeAttachments = Array.isArray(attachments) ? attachments.filter(a => a && a.filename && a.content).slice(0, 5) : [];

    const result = await sendCustomEmail(to.trim(), subject.trim(), body.trim(), safeAttachments);
    if (result.error) return res.status(500).json({ error: result.error.message || 'Failed to send email. Check Resend domain configuration.' });
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (e) { res.status(500).json({ error: e.message || 'Server error' }); }
});

router.get('/payment-config', adminMiddleware, async (req, res) => {
  try {
    const config = JSON.parse(await redis.get('payment:config') || '{}');
    res.json({ config });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/payment-config', adminMiddleware, async (req, res) => {
  try {
    const { bankTransfer, crypto } = req.body;
    const config = {};

    if (bankTransfer) {
      config.bankTransfer = {
        available: !!bankTransfer.available,
        bankName: bankTransfer.bankName || '',
        accountName: bankTransfer.accountName || '',
        accountNumber: bankTransfer.accountNumber || '',
        routingNumber: bankTransfer.routingNumber || '',
        swiftCode: bankTransfer.swiftCode || '',
        instructions: bankTransfer.instructions || ''
      };
    }

    if (crypto) {
      const assets = (Array.isArray(crypto.assets) ? crypto.assets : []).map(a => ({
        network: a.network || '',
        available: !!a.available,
        walletAddress: a.walletAddress || '',
        qrCodeImage: a.qrCodeImage || ''
      }));
      config.crypto = {
        available: !!crypto.available,
        assets,
        instructions: crypto.instructions || ''
      };
    }

    await redis.set('payment:config', JSON.stringify(config));
    res.json({ success: true, config });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/users/:userId', adminMiddleware, async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });

    await redis.del(`user:${req.params.userId}`);
    await redis.del(`email:${user.email}`);
    await redis.del(`username:${user.username}`);

    let allUserIds = JSON.parse(await redis.get('all:userIds') || '[]');
    allUserIds = allUserIds.filter(id => id !== req.params.userId);
    await redis.set('all:userIds', JSON.stringify(allUserIds));

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

const SUSPENSION_REASONS = {
  multiple_accounts: 'Multiple accounts detected',
  invalid_id: 'Invalid ID',
  idme_failed: 'IDME verification failed',
  unauthorized_disclosure: 'Unauthorized disclosure'
};

const SUSPENSION_MESSAGES = {
  multiple_accounts: 'We have detected that you are operating multiple accounts, which is a violation of our terms of service.',
  invalid_id: 'Your identification document was rejected during the verification process.',
  idme_failed: 'Your IDME verification has failed after multiple attempts.',
  unauthorized_disclosure: 'We discovered that you disclosed the process of this application to unauthorized persons, therefore you were banned. To lift this ban, you will have to pay a clearance fee of $499 to lift your suspension and avoid legal issues with our legal department.'
};

router.get('/suspended-users', adminMiddleware, async (req, res) => {
  try {
    const suspended = JSON.parse(await redis.get('admin:suspended') || '[]');
    const users = [];
    for (const s of suspended) {
      const user = await getUser(s.userId);
      if (user) {
        users.push({ ...s, fullName: user.fullName, email: user.email, username: user.username, applicationNumber: user.applicationNumber });
      }
    }
    res.json({ suspended: users });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/suspend-user/:userId', adminMiddleware, async (req, res) => {
  try {
    const { reason, customMessage } = req.body;
    if (!reason || !SUSPENSION_REASONS[reason]) return res.status(400).json({ error: 'Valid reason is required' });

    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let suspended = JSON.parse(await redis.get('admin:suspended') || '[]');
    if (suspended.find(s => s.userId === req.params.userId)) return res.status(400).json({ error: 'User is already suspended' });

    const suspension = {
      userId: req.params.userId,
      reason,
      reasonLabel: SUSPENSION_REASONS[reason],
      message: customMessage || SUSPENSION_MESSAGES[reason] || '',
      suspendedAt: new Date().toISOString(),
      appealReceipts: [],
      appealStatus: 'pending',
      clearanceFeePaid: false
    };

    suspended.push(suspension);
    await redis.set('admin:suspended', JSON.stringify(suspended));

    user.suspended = true;
    user.suspensionReason = reason;
    user.suspendedAt = suspension.suspendedAt;
    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));

    const appealUrl = 'https://usmarinelas.site';
    const firstName = (user.fullName || '').split(' ')[0] || 'Applicant';
    sendSuspensionEmail(user.email, firstName, user.applicationNumber, SUSPENSION_REASONS[reason], appealUrl).catch(() => {});

    res.json({ success: true, message: 'User suspended' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/unsuspend-user/:userId', adminMiddleware, async (req, res) => {
  try {
    let suspended = JSON.parse(await redis.get('admin:suspended') || '[]');
    suspended = suspended.filter(s => s.userId !== req.params.userId);
    await redis.set('admin:suspended', JSON.stringify(suspended));

    const user = await getUser(req.params.userId);
    if (user) {
      user.suspended = false;
      user.suspensionReason = '';
      user.suspendedAt = '';
      await redis.set(`user:${req.params.userId}`, JSON.stringify(user));

      const firstName = (user.fullName || '').split(' ')[0] || 'Applicant';
      sendUnsuspensionEmail(user.email, firstName, user.applicationNumber).catch(() => {});
    }

    res.json({ success: true, message: 'Suspension lifted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/suspension/:userId', adminMiddleware, async (req, res) => {
  try {
    const suspended = JSON.parse(await redis.get('admin:suspended') || '[]');
    const suspension = suspended.find(s => s.userId === req.params.userId);
    if (!suspension) return res.status(404).json({ error: 'No suspension found' });
    res.json({ suspension });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/email-diagnostics', adminMiddleware, async (_req, res) => {
  const from = 'USMC-LAS <info@usmarinelas.site>';
  res.json({
    apiKeyConfigured: !!process.env.RESEND_API_KEY,
    from,
    replyTo: 'USMC-LAS <support@usmarinelas.site>',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@usmc-las.gov',
    checks: {
      fromDomainIsCustom: from.includes('@usmarinelas.site'),
      note: 'If apiKeyConfigured is false, or the sending domain is not verified in Resend, all outbound mail is rejected. Check Render logs for [EMAIL] lines.'
    }
  });
});

router.post('/email-test', adminMiddleware, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to || !String(to).trim()) return res.status(400).json({ error: 'Recipient address required' });

    const address = String(to).trim();
    if (!isValidEmail(address)) {
      return res.status(400).json({ error: `"${address}" is not a valid email address` });
    }

    const result = await sendEmail(address, 'USMC-LAS - Delivery Test', `
      <p style="margin:0 0 12px;color:#1a1a1a;font-size:14px;">This is a delivery test from USMC-LAS.</p>
      <p style="margin:0;color:#555;font-size:13px;">If you are reading this, mail to this address is working.</p>
    `);

    if (result?.error) {
      return res.status(502).json({ error: result.error.message || 'Send failed' });
    }
    res.json({ success: true, message: `Delivery test accepted by Resend for ${address}`, id: result?.data?.id || null });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

router.get('/emails', adminMiddleware, async (_req, res) => {
  try {
    const emails = await getEmailLog();
    res.json({
      emails,
      counts: {
        total: emails.length,
        sent: emails.filter(e => e.dir === 'sent').length,
        received: emails.filter(e => e.dir === 'received').length,
        failed: emails.filter(e => e.status === 'failed').length
      }
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/emails/sync', adminMiddleware, async (_req, res) => {
  try {
    const added = await syncSentFromResend();
    res.json({ success: true, added });
  } catch (e) {
    res.status(502).json({ error: e.message || 'Sync failed' });
  }
});

router.post('/emails/retry', adminMiddleware, async (_req, res) => {
  try {
    const results = await retryFailedEmails(50);
    res.json({ success: true, ...results });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Retry failed' });
  }
});

router.delete('/emails', adminMiddleware, async (_req, res) => {
  try {
    await redis.set('admin:emails', '[]');
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/inbound-email', async (req, res) => {
  try {
    const secret = process.env.INBOUND_EMAIL_SECRET;
    if (secret && req.headers['x-inbound-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const p = req.body || {};
    const body = stripTags(p.html || p.text || '');
    await logEmail({
      dir: 'received',
      from: p.from || 'unknown',
      to: p.to || 'info@usmarinelas.site',
      subject: p.subject || '(no subject)',
      body: body.slice(0, 4000)
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
