import { activateTrial, getFeatures } from './service.js';
import { prisma } from '../../config/prisma.js';
import { adminPricing } from '../admin/admin-pricing.service.js';
export async function activateTrialHandler(request, reply) {
    try {
        const result = await activateTrial(request.user.id);
        return reply.send(result);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Trial sudah pernah digunakan') {
            return reply.status(400).send({ success: false, message: error.message });
        }
        throw error;
    }
}
export async function getFeaturesHandler(request, reply) {
    const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: {
            subscriptionTier: true,
            trialEndsAt: true,
        },
    });
    if (!user) {
        return reply.status(404).send({ features: null });
    }
    const features = getFeatures(user);
    return reply.send({ features });
}
export async function getPublicPricingHandler(request, reply) {
    try {
        const pricings = await adminPricing.getPricings();
        return reply.send(pricings);
    }
    catch (error) {
        return reply.status(500).send({ error: 'Failed to get pricings' });
    }
}
