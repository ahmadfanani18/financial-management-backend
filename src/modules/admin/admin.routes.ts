import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { adminPricing, adminCoupon } from './admin-pricing.service.js';

interface PricingParams {
  id: string;
}

interface CreatePricingBody {
  app: string;
  amount: number;
  period: string;
}

interface UpdatePricingBody {
  amount?: number;
  isActive?: boolean;
}

interface CreateCouponBody {
  code: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minPurchase?: number;
  maxUses?: number;
  validFrom: string;
  validUntil: string;
}

interface UpdateCouponBody {
  description?: string;
  value?: number;
  minPurchase?: number;
  maxUses?: number;
  validFrom?: string;
  validUntil?: string;
  isActive?: boolean;
}

interface CouponParams {
  id: string;
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get('/pricing', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pricinigs = await adminPricing.getPricings();
      return reply.send(pricinigs);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get pricings' });
    }
  });

  fastify.post('/pricing', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Body: CreatePricingBody }>, reply: FastifyReply) => {
    try {
      const { app, amount, period } = request.body;
      const pricing = await adminPricing.createPricing({ app, amount, period });
      return reply.send(pricing);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create pricing';
      return reply.status(400).send({ error: message });
    }
  });

  fastify.patch('/pricing/:id', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: PricingParams; Body: UpdatePricingBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { amount, isActive } = request.body;
      const pricing = await adminPricing.updatePricing(id, { amount, isActive });
      return reply.send(pricing);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to update pricing' });
    }
  });

  fastify.delete('/pricing/:id', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: PricingParams }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      await adminPricing.deletePricing(id);
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to delete pricing' });
    }
  });

  fastify.get('/coupons', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const coupons = await adminCoupon.getCoupons();
      return reply.send(coupons);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get coupons' });
    }
  });

  fastify.post('/coupons', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Body: CreateCouponBody }>, reply: FastifyReply) => {
    try {
      const { code, description, type, value, minPurchase, maxUses, validFrom, validUntil } = request.body;
      const coupon = await adminCoupon.createCoupon({
        code,
        description,
        type,
        value,
        minPurchase,
        maxUses,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
      });
      return reply.send(coupon);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to create coupon' });
    }
  });

  fastify.patch('/coupons/:id', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: CouponParams; Body: UpdateCouponBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { description, value, minPurchase, maxUses, validFrom, validUntil, isActive } = request.body;
      const coupon = await adminCoupon.updateCoupon(id, {
        description,
        value,
        minPurchase,
        maxUses,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        isActive,
      });
      return reply.send(coupon);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to update coupon' });
    }
  });

  fastify.delete('/coupons/:id', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: CouponParams }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      await adminCoupon.deleteCoupon(id);
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to delete coupon' });
    }
  });
}