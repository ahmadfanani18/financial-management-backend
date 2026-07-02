import { prisma } from '../../config/prisma.js';
import * as midtrans from './midtrans.js';
import { midtransConfig, getMidtransBaseUrl } from './midtrans.js';

const APP_PREFIX = {
  FINANCIAL_MANAGEMENT: 'FM',
  EVENT_ORGANIZER: 'EO',
} as const;

export interface CreatePaymentParams {
  userId: string;
  app: 'FINANCIAL_MANAGEMENT' | 'EVENT_ORGANIZER';
  paymentMethod: 'VA_BANK' | 'E_WALLET' | 'CREDIT_CARD';
  paymentProvider?: string;
  paymentType: 'ONE_TIME' | 'SUBSCRIPTION';
  couponCode?: string;
  enableAutoRenewal?: boolean;
  pricingId?: string;
}

export interface PaymentResult {
  orderId: string;
  token?: string;
  redirectUrl?: string;
}

export async function createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
  const appPrefix = APP_PREFIX[params.app];
  const orderId = `${appPrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  let pricing;
  if (params.pricingId) {
    pricing = await prisma.pricing.findUnique({
      where: { id: params.pricingId, isActive: true },
    });
  } else {
    pricing = await prisma.pricing.findFirst({
      where: { app: params.app, period: 'MONTHLY', isActive: true },
    });
  }

  if (!pricing) {
    throw new Error('Pricing not configured. Contact admin.');
  }

  let amount = pricing.amount;
  let couponId: string | null = null;

  if (params.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: params.couponCode },
    });

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

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const payment = await prisma.payment.create({
    data: {
      userId: params.userId,
      app: params.app,
      amount: pricing.amount,
      finalAmount: amount,
      paymentMethod: params.paymentMethod,
      paymentProvider: params.paymentProvider as any,
      paymentType: params.paymentType,
      midtransOrderId: orderId,
      couponId,
      status: 'PENDING',
    },
  });

  try {
    let token: string | undefined;
    let redirectUrl: string | undefined;

    if (params.paymentMethod === 'CREDIT_CARD' && params.enableAutoRenewal) {
      const subscription = await midtrans.createSubscription(
        user.name,
        user.email,
        params.paymentProvider!,
        amount,
        orderId
      );

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          midtransToken: subscription.subscription_id,
        },
      });

      token = subscription.token;
    } else {
      const result = await midtrans.createMidtransTransaction({
        orderId,
        amount,
        customerName: user.name,
        customerEmail: user.email,
        paymentMethod: params.paymentMethod,
        paymentProvider: params.paymentProvider,
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          midtransTransactionId: result.transaction_id || orderId,
          vaNumber: result.vaNumber,
        },
      });

      token = result.transaction_id || orderId;
      redirectUrl = result.redirect_url;
    }

    return {
      orderId: payment.midtransOrderId,
      token,
      redirectUrl,
    };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

async function activateUserSubscription(payment: {
  userId: string;
  app: 'FINANCIAL_MANAGEMENT' | 'EVENT_ORGANIZER';
}) {
  const user = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { subscriptionTier: true, trialEndsAt: true },
  });

  if (!user) return;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const updateData: Record<string, unknown> = {
    subscriptionTier: 'PRO',
    subscriptionStartAt: startDate,
    subscriptionEndAt: endDate,
  };

  if (user.subscriptionTier === 'TRIAL') {
    updateData.trialStartedAt = null;
    updateData.trialEndsAt = null;
  }

  await prisma.user.update({
    where: { id: payment.userId },
    data: updateData,
  });

  const existingSub = await prisma.subscription.findFirst({
    where: { userId: payment.userId, app: payment.app, status: 'ACTIVE' },
  });

  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { startDate: startDate, endDate: endDate },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId: payment.userId,
        app: payment.app,
        tier: 'PRO',
        startDate: startDate,
        endDate: endDate,
        status: 'ACTIVE',
      },
    });
  }
}

export async function handleMidtransCallback(
  orderId: string,
  status: string,
  transactionId: string,
  callbackData: Record<string, unknown>
) {
  const payment = await prisma.payment.findFirst({
    where: { midtransOrderId: orderId },
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  let paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' = 'PENDING';

  if (status === 'settlement' || status === 'capture') {
    paymentStatus = 'SUCCESS';
  } else if (status === 'expire') {
    paymentStatus = 'EXPIRED';
  } else if (status === 'deny' || status === 'cancel') {
    paymentStatus = 'FAILED';
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: paymentStatus,
      midtransTransactionId: transactionId,
      callbackData: callbackData as any,
    },
  });

  if (paymentStatus === 'SUCCESS') {
    await activateUserSubscription(payment);
  }

  return { success: true };
}

export async function getUserPayments(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { coupon: true },
  });
}

export async function getPaymentById(paymentId: string) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: { coupon: true },
  });
}

export async function getPaymentByOrderId(orderId: string) {
  const payment = await prisma.payment.findFirst({
    where: { midtransOrderId: orderId },
    include: { coupon: true, user: { select: { id: true, name: true, email: true } } },
  });

  if (!payment) {
    return null;
  }

  if (payment.status === 'PENDING' && payment.midtransTransactionId) {
    try {
      const midtransData = await midtrans.getTransactionStatus(payment.midtransTransactionId);
      const midtransStatus = midtransData.transaction_status;

      let newStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' = 'PENDING';

      if (midtransStatus === 'settlement' || midtransStatus === 'capture') {
        newStatus = 'SUCCESS';
      } else if (midtransStatus === 'expire') {
        newStatus = 'EXPIRED';
      } else if (midtransStatus === 'deny' || midtransStatus === 'cancel') {
        newStatus = 'FAILED';
      }

      if (newStatus !== payment.status) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: newStatus },
        });
        payment.status = newStatus;

        if (newStatus === 'SUCCESS') {
          await activateUserSubscription(payment);
        }
      }
    } catch (e) {
      console.error('Failed to sync with Midtrans:', e);
    }
  }

  const now = new Date();
  const fifteenMinLater = new Date(payment.createdAt.getTime() + 15 * 60 * 1000);

  let status = payment.status;
  if (status === 'PENDING' && now > fifteenMinLater) {
    status = 'EXPIRED';
  }

  return {
    orderId: payment.midtransOrderId,
    status,
    paymentMethod: payment.paymentMethod,
    paymentProvider: payment.paymentProvider,
    vaNumber: payment.vaNumber,
    amount: payment.finalAmount,
    expiredAt: payment.createdAt,
    qrUrl: null,
  };
}

export function getClientKey() {
  return midtransConfig.clientKey;
}