import { prisma } from '../../config/prisma.js';
import { getEffectiveTier } from '../subscription/service.js';
import { aiService, smartSaverService } from './service.js';
import { generatePlanSchema, predictSpendingSchema, smartSaverCalculateSchema } from './schemas.js';
async function requireProAccess(request, reply) {
    const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { subscriptionTier: true, trialEndsAt: true },
    });
    if (!user) {
        return reply.status(404).send({ error: 'User not found' });
    }
    const tier = getEffectiveTier(user);
    if (tier !== 'PRO') {
        return reply.status(403).send({ error: 'Fitur ini hanya untuk pengguna Pro. Upgrade untuk akses penuh.' });
    }
    return null;
}
export async function generatePlanHandler(request, reply) {
    const blocked = await requireProAccess(request, reply);
    if (blocked)
        return blocked;
    const input = generatePlanSchema.parse(request.body);
    const result = await aiService.generatePlan(request.user.id, input);
    return reply.send(result);
}
export async function predictSpendingHandler(request, reply) {
    const blocked = await requireProAccess(request, reply);
    if (blocked)
        return blocked;
    const input = predictSpendingSchema.parse(request.body);
    const result = await aiService.predictSpending(request.user.id, input);
    return reply.send(result);
}
export async function suggestSavingsHandler(request, reply) {
    const blocked = await requireProAccess(request, reply);
    if (blocked)
        return blocked;
    const result = await aiService.suggestSavings(request.user.id);
    return reply.send(result);
}
export async function generatePlanFromDataHandler(request, reply) {
    const blocked = await requireProAccess(request, reply);
    if (blocked)
        return blocked;
    const result = await aiService.generatePlanFromData(request.user.id);
    if (result.error) {
        return reply.status(400).send({
            error: true,
            message: result.message
        });
    }
    return {
        plan: result.plan,
        summary: result.summary,
    };
}
export async function smartSaverCalculateHandler(request, reply) {
    const blocked = await requireProAccess(request, reply);
    if (blocked)
        return blocked;
    const input = smartSaverCalculateSchema.parse(request.body);
    const result = await smartSaverService.calculate(request.user.id, input);
    return reply.send(result);
}
export async function smartSaverSuggestionsHandler(request, reply) {
    const blocked = await requireProAccess(request, reply);
    if (blocked)
        return blocked;
    const result = await smartSaverService.getSuggestions(request.user.id);
    return reply.send(result);
}
