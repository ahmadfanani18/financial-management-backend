import { prisma } from '../../config/prisma.js';

export const adminPricing = {
  async getPricings() {
    return prisma.pricing.findMany({ orderBy: { app: 'asc' } });
  },

  async getPricingByApp(app: string) {
    return prisma.pricing.findMany({ where: { app: app as any } });
  },

  async createPricing(data: { app: string; amount: number; period?: string }) {
    const period = data.period || 'MONTHLY';
    const existing = await prisma.pricing.findUnique({
      where: { app_period: { app: data.app as any, period } },
    });

    if (existing && existing.isActive) {
      throw new Error(`${period} pricing for ${data.app} already exists. Please update the existing one instead.`);
    }

    return prisma.pricing.upsert({
      where: { app_period: { app: data.app as any, period } },
      update: { amount: data.amount, isActive: true },
      create: { app: data.app as any, amount: data.amount, period },
    });
  },

  async updatePricing(id: string, data: { amount?: number; isActive?: boolean }) {
    return prisma.pricing.update({ where: { id }, data });
  },

  async deletePricing(id: string) {
    return prisma.pricing.update({ where: { id }, data: { isActive: false } });
  },
};

export const adminCoupon = {
  async getCoupons() {
    return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  },

  async getCouponById(id: string) {
    return prisma.coupon.findUnique({ where: { id } });
  },

  async createCoupon(data: {
    code: string;
    description?: string;
    type: 'PERCENTAGE' | 'FIXED';
    value: number;
    minPurchase?: number;
    maxUses?: number;
    validFrom: Date;
    validUntil: Date;
  }) {
    return prisma.coupon.create({ data: { ...data, isActive: true } });
  },

  async updateCoupon(id: string, data: Partial<{
    description: string;
    value: number;
    minPurchase: number;
    maxUses: number;
    validFrom: Date;
    validUntil: Date;
    isActive: boolean;
  }>) {
    return prisma.coupon.update({ where: { id }, data });
  },

  async deleteCoupon(id: string) {
    return prisma.coupon.update({ where: { id }, data: { isActive: false } });
  },

  async validateCoupon(code: string) {
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) return null;
    if (!coupon.isActive) return null;
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) return null;
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return null;
    return coupon;
  },
};