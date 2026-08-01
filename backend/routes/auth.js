import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import redis from '../redis.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendForgotPasswordEmail } from '../email.js';

const router = Router();

const signToken = (id, email, username) =>
  jwt.sign({ id, email, username, isAdmin: false }, process.env.JWT_SECRET, { expiresIn: '24h' });

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const randomSuffix = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const generateApplicationNumber = async () => {
  const year = new Date().getFullYear();
  const suffix = randomSuffix();
  return `USMC-${year}-${suffix}`;
};

const generateInvoiceNumber = (excludeSuffix) => {
  const year = new Date().getFullYear();
  let suffix;
  do { suffix = randomSuffix(); } while (suffix === excludeSuffix);
  return `INV-${year}-${suffix}`;
};

router.post('/signup', async (req, res) => {
  try {
    const { email, username, password, fullName, dob, applyingFor, address, city, state, zipCode } = req.body;
    if (!email || !username || !password || !fullName || !dob || !applyingFor) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingEmail = await redis.get(`email:${email}`);
    if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

    const existingUser = await redis.get(`username:${username}`);
    if (existingUser) return res.status(400).json({ error: 'Username already taken' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const applicationNumber = await generateApplicationNumber();
    const appSuffix = applicationNumber.split('-').pop();
    const invoiceNumber = generateInvoiceNumber(appSuffix);

    const user = {
      id: userId, applicationNumber, invoiceNumber, email, username, password: hashedPassword, fullName, dob, applyingFor,
      address: address || '', city: city || '', state: state || '', zipCode: zipCode || '',
      currentStage: 1, stageStatus: 'active',
      emailVerified: true,
      idmeSubmitted: false, idmeVerified: false, idmeStatus: 'none',
      idmeEmail: '', idmePassword: '', idmeDeclineMessage: '', idmeCode: '', idmeCodeSent: false,
      accountOfficer: '',
      clearanceDuration: 0, clearanceFee: 0, clearancePaymentVerified: false,
      finalApproved: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };

    await redis.set(`user:${userId}`, JSON.stringify(user));
    await redis.set(`email:${email}`, userId);
    await redis.set(`username:${username}`, userId);

    const allUsers = JSON.parse(await redis.get('all:userIds') || '[]');
    allUsers.push(userId);
    await redis.set('all:userIds', JSON.stringify(allUsers));

    res.json({ token: signToken(userId, email, username), user: { id: userId, applicationNumber, email, username, fullName, currentStage: 1 } });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Credentials required' });

    let userId;
    if (typeof login === 'string' && login.includes('@')) {
      userId = await redis.get(`email:${login}`);
    } else {
      userId = await redis.get(`username:${login}`);
    }

    if (!userId) return res.status(401).json({ error: 'Invalid credentials' });

    const userData = await redis.get(`user:${userId}`);
    if (!userData) return res.status(401).json({ error: 'Invalid credentials' });

    const user = JSON.parse(userData);
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({
      token: signToken(userId, user.email, user.username),
      user: { id: userId, email: user.email, username: user.username, fullName: user.fullName, applicationNumber: user.applicationNumber, currentStage: user.currentStage, stageStatus: user.stageStatus }
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userData = await redis.get(`user:${req.user.id}`);
    if (!userData) return res.status(404).json({ error: 'Not found' });
    const { password, ...safe } = JSON.parse(userData);
    res.json({ user: safe });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const userId = await redis.get(`email:${email}`);
    if (!userId) return res.json({ success: true, message: 'If an account exists, a reset code has been sent' });

    const userData = await redis.get(`user:${userId}`);
    if (!userData) return res.json({ success: true, message: 'If an account exists, a reset code has been sent' });

    const code = generateCode();
    await redis.set(`forgot:password:${userId}`, code, 'EX', 600);
    await sendForgotPasswordEmail(email, code);

    res.json({ success: true, message: 'If an account exists, a reset code has been sent' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/verify-forgot-password', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

    const userId = await redis.get(`email:${email}`);
    if (!userId) return res.status(400).json({ error: 'Invalid code' });

    const stored = await redis.get(`forgot:password:${userId}`);
    if (!stored) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    if (stored !== code) return res.status(400).json({ error: 'Invalid code' });

    const resetToken = jwt.sign({ resetId: userId, purpose: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    await redis.del(`forgot:password:${userId}`);

    res.json({ success: true, resetToken });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ error: 'Reset token and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Reset token expired or invalid' });
    }

    if (decoded.purpose !== 'password_reset') return res.status(400).json({ error: 'Invalid token' });

    const userData = await redis.get(`user:${decoded.resetId}`);
    if (!userData) return res.status(404).json({ error: 'User not found' });

    const user = JSON.parse(userData);
    user.password = await bcrypt.hash(newPassword, 12);
    user.updatedAt = new Date().toISOString();
    await redis.set(`user:${decoded.resetId}`, JSON.stringify(user));

    res.json({ success: true, message: 'Password reset successful' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
