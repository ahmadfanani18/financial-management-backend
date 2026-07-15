import { prisma } from '../../config/prisma.js';
export const adminPricing = {
    async getPricings() {
        return prisma.pricing.findMany({ orderBy: { app: 'asc' } });
    },
    async getPricingByApp(app) {
        return prisma.pricing.findMany({ where: { app: app } });
    },
    async createPricing(data) {
        const period = data.period || 'MONTHLY';
        const existing = await prisma.pricing.findUnique({
            where: { app_period: { app: data.app, period } },
        });
        if (existing && existing.isActive) {
            throw new Error(`${period} pricing for ${data.app} already exists. Please update the existing one instead.`);
        }
        return prisma.pricing.upsert({
            where: { app_period: { app: data.app, period } },
            update: { amount: data.amount, isActive: true },
            create: { app: data.app, amount: data.amount, period },
        });
    },
    async updatePricing(id, data) {
        return prisma.pricing.update({ where: { id }, data });
    },
    async deletePricing(id) {
        return prisma.pricing.update({ where: { id }, data: { isActive: false } });
    },
};
export const adminCoupon = {
    async getCoupons() {
        return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    },
    async getCouponById(id) {
        return prisma.coupon.findUnique({ where: { id } });
    },
    async createCoupon(data) {
        return prisma.coupon.create({ data: { ...data, isActive: true } });
    },
    async updateCoupon(id, data) {
        return prisma.coupon.update({ where: { id }, data });
    },
    async deleteCoupon(id) {
        return prisma.coupon.update({ where: { id }, data: { isActive: false } });
    },
    async validateCoupon(code) {
        const coupon = await prisma.coupon.findUnique({ where: { code } });
        if (!coupon)
            return null;
        if (!coupon.isActive)
            return null;
        const now = new Date();
        if (now < coupon.validFrom || now > coupon.validUntil)
            return null;
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
            return null;
        return coupon;
    },
};
//# sourceMappingURL=admin-pricing.service.js.map