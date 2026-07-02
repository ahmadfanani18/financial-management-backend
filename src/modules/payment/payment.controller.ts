import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as paymentService from './payment.service.js';

interface CreatePaymentBody {
  app: string;
  paymentMethod: string;
  paymentProvider?: string;
  paymentType: string;
  couponCode?: string;
  enableAutoRenewal?: boolean;
  pricingId?: string;
}

interface PaymentParams {
  id: string;
}

interface AuthUser {
  id: string;
}

export async function createPayment(
  request: FastifyRequest<{ Body: CreatePaymentBody }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as AuthUser | undefined;
    if (!user?.id) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { app, paymentMethod, paymentProvider, paymentType, couponCode, enableAutoRenewal, pricingId } = request.body;

    if (!app || !paymentMethod || !paymentType) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const result = await paymentService.createPayment({
      userId: user.id,
      app,
      paymentMethod,
      paymentProvider,
      paymentType,
      couponCode,
      enableAutoRenewal,
      pricingId,
    });

    return reply.send(result);
  } catch (error) {
    console.error('Create payment error:', error);
    return reply.status(500).send({ error: error instanceof Error ? error.message : 'Payment failed' });
  }
}

interface CallbackBody {
  order_id: string;
  transaction_status: string;
  transaction_id: string;
  [key: string]: unknown;
}

export async function handleCallback(
  request: FastifyRequest<{ Body: CallbackBody }>,
  reply: FastifyReply
) {
  try {
    const { order_id, transaction_status, transaction_id, ...callbackData } = request.body;

    await paymentService.handleMidtransCallback(
      order_id,
      transaction_status,
      transaction_id,
      callbackData
    );

    return reply.send({ success: true });
  } catch (error) {
    console.error('Callback error:', error);
    return reply.status(500).send({ error: 'Callback processing failed' });
  }
}

export async function getMyPayments(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const user = request.user as AuthUser | undefined;
    if (!user?.id) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const payments = await paymentService.getUserPayments(user.id);
    return reply.send(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    return reply.status(500).send({ error: 'Failed to get payments' });
  }
}

export async function getPaymentDetail(
  request: FastifyRequest<{ Params: PaymentParams }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as AuthUser | undefined;
    if (!user?.id) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    const payment = await paymentService.getPaymentById(id);

    if (!payment || payment.userId !== user.id) {
      return reply.status(404).send({ error: 'Payment not found' });
    }

    return reply.send(payment);
  } catch (error) {
    console.error('Get payment detail error:', error);
    return reply.status(500).send({ error: 'Failed to get payment' });
  }
}

export function getSnapToken(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.send({ clientKey: paymentService.getClientKey() });
}

export async function getPaymentByOrderId(
  request: FastifyRequest<{ Params: { orderId: string } }>,
  reply: FastifyReply
) {
  const { orderId } = request.params;

  const payment = await paymentService.getPaymentByOrderId(orderId);

  if (!payment) {
    return reply.status(404).send({ error: 'Payment not found' });
  }

  return payment;
}