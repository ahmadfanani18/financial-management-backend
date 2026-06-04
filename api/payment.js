import { getPrisma, parseBody, setupCors, parseToken } from './utils.js';
import crypto from 'crypto';

const midtransConfig = {
  merchantId: process.env.MIDTRANS_MERCHANT_ID || '',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
  serverKey: process.env.MIDTRANS_SERVER_KEY || '',
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
};

function getMidtransBaseUrl() {
  return midtransConfig.isProduction
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';
}

function getAuthHeader() {
  const encoded = Buffer.from(`${midtransConfig.serverKey}:`).toString('base64');
  return `Basic ${encoded}`;
}

export default async function handler(req, res) {
  let db = null;
  try {
    const origin = req.headers.origin;
    setupCors(res, origin);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    const url = (req.url || '/').split('?')[0];
    const method = req.method;

    db = await getPrisma();

    // POST /api/payment/callback (public - from Midtrans)
    if (url === '/api/payment/callback' && method === 'POST') {
      const body = parseBody(req.body);
      const { order_id, transaction_status, transaction_id, ...callbackData } = body || {};

      const payment = await db.payment.findFirst({
        where: { midtransOrderId: order_id },
      });

      if (!payment) {
        res.status(404).send(JSON.stringify({ error: 'Payment not found' }));
        return;
      }

      let paymentStatus = 'PENDING';
      if (transaction_status === 'settlement' || transaction_status === 'capture') {
        paymentStatus = 'SUCCESS';
      } else if (transaction_status === 'expire') {
        paymentStatus = 'EXPIRED';
      } else if (transaction_status === 'deny' || transaction_status === 'cancel') {
        paymentStatus = 'FAILED';
      }

      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
          midtransTransactionId: transaction_id,
        },
      });

      if (paymentStatus === 'SUCCESS') {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        await db.user.update({
          where: { id: payment.userId },
          data: {
            subscriptionTier: 'PRO',
            subscriptionStartAt: startDate,
            subscriptionEndAt: endDate,
          },
        });

        await db.subscription.upsert({
          where: { id: payment.id },
          create: {
            id: payment.id,
            userId: payment.userId,
            app: payment.app,
            tier: 'PRO',
            startDate,
            endDate,
            status: 'ACTIVE',
          },
          update: {
            status: 'ACTIVE',
            startDate,
            endDate,
          },
        });
      }

      res.status(200).send(JSON.stringify({ success: true }));
      return;
    }

    const token = parseToken(req.headers.authorization);
    if (!token) {
      res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    // POST /api/payment/create
    if (url === '/api/payment/create' && method === 'POST') {
      const body = parseBody(req.body);
      const { app, paymentMethod, paymentProvider, paymentType, couponCode } = body || {};

      if (!app || !paymentMethod || !paymentType) {
        res.status(400).send(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }

      const appPrefix = app === 'FINANCIAL_MANAGEMENT' ? 'FM' : 'EO';
      const orderId = `${appPrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const pricing = await db.pricing.findFirst({
        where: { app, period: 'MONTHLY', isActive: true },
      });

      if (!pricing) {
        res.status(400).send(JSON.stringify({ error: 'Pricing not configured' }));
        return;
      }

      let amount = pricing.amount;
      let couponId = null;

      if (couponCode) {
        const coupon = await db.coupon.findUnique({ where: { code: couponCode } });
        if (coupon && coupon.isActive && new Date() <= coupon.validUntil && new Date() >= coupon.validFrom) {
          if (!coupon.maxUses || coupon.usedCount < coupon.maxUses) {
            couponId = coupon.id;
            if (coupon.type === 'PERCENTAGE') {
              amount = Math.floor(amount * (1 - coupon.value / 100));
            } else {
              amount = Math.max(0, amount - coupon.value);
            }
          }
        }
      }

      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) {
        res.status(404).send(JSON.stringify({ error: 'User not found' }));
        return;
      }

      const payment = await db.payment.create({
        data: {
          userId: token.userId,
          app,
          amount: pricing.amount,
          finalAmount: amount,
          paymentMethod,
          paymentProvider,
          paymentType,
          midtransOrderId: orderId,
          couponId,
          status: 'PENDING',
        },
      });

      let midtransToken = '';
      let redirectUrl = '';

      try {
        const baseUrl = getMidtransBaseUrl();
        const bankMap = { 'BCA_VA': 'bca', 'BRI_VA': 'bri', 'BNI_VA': 'bni', 'MANDIRI_VA': 'mandiri' };

        let payload = {};
        if (paymentMethod === 'VA_BANK') {
          const bankCode = bankMap[paymentProvider] || 'bca';
          payload = {
            payment_type: 'bank_transfer',
            transaction_details: { gross_amount: amount, order_id: orderId },
            customer_details: { first_name: user.name, email: user.email },
            bank_transfer: { bank: bankCode },
            expiry: { unit: 'hours', duration: 24 },
          };
        } else if (paymentMethod === 'E_WALLET') {
          payload = {
            payment_type: 'echannel',
            transaction_details: { gross_amount: amount, order_id: orderId },
            customer_details: { first_name: user.name, email: user.email },
          };
        }

        const response = await fetch(`${baseUrl}/v2/charge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: getAuthHeader(),
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          midtransToken = result.transaction_id || orderId;
          if (paymentMethod === 'VA_BANK' && result.va_numbers) {
            midtransToken = result.va_numbers[0]?.va_number || midtransToken;
          }
        }
      } catch (e) {
        console.error('Midtrans error:', e);
      }

      await db.payment.update({
        where: { id: payment.id },
        data: {
          midtransTransactionId: midtransToken || orderId,
          vaNumber: midtransToken,
        },
      });

      res.status(200).send(JSON.stringify({
        orderId: payment.midtransOrderId,
        token: midtransToken,
        redirectUrl,
      }));
      return;
    }

    // GET /api/payment/my
    if (url === '/api/payment/my' && method === 'GET') {
      const payments = await db.payment.findMany({
        where: { userId: token.userId },
        orderBy: { createdAt: 'desc' },
        include: { coupon: true },
      });
      res.status(200).send(JSON.stringify(payments));
      return;
    }

    // GET /api/payment/:id
    const paymentMatch = url.match(/^\/api\/payment\/([a-f0-9-]+)$/i);
    if (paymentMatch && method === 'GET') {
      const payment = await db.payment.findUnique({
        where: { id: paymentMatch[1] },
        include: { coupon: true },
      });

      if (!payment || payment.userId !== token.userId) {
        res.status(404).send(JSON.stringify({ error: 'Payment not found' }));
        return;
      }

      res.status(200).send(JSON.stringify(payment));
      return;
    }

    // GET /api/payment/snap/token
    if (url === '/api/payment/snap/token' && method === 'GET') {
      res.status(200).send(JSON.stringify({ clientKey: midtransConfig.clientKey }));
      return;
    }

    // GET /api/payment/order/:orderId
    const orderMatch = url.match(/^\/api\/payment\/order\/([^\/]+)$/i);
    if (orderMatch && method === 'GET') {
      const orderId = orderMatch[1];
      const payment = await db.payment.findFirst({
        where: { midtransOrderId: orderId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      if (!payment) {
        res.status(404).send(JSON.stringify({ error: 'Payment not found' }));
        return;
      }

      res.status(200).send(JSON.stringify({
        orderId: payment.midtransOrderId,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        paymentProvider: payment.paymentProvider,
        vaNumber: payment.vaNumber,
        amount: payment.finalAmount,
        expiredAt: payment.createdAt,
      }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Payment handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}