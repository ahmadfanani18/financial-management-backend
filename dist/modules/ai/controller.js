import { prisma } from '../../config/prisma.js';
import { getEffectiveTier } from '../subscription/service.js';
import { aiService, smartSaverService } from './service.js';
import { generatePlanSchema, predictSpendingSchema, smartSaverCalculateSchema } from './schemas.js';
import { buildFinancialContext, buildSystemPrompt } from './context-builder.js';
import { createRouter, classifyQuery } from './router.js';
import { checkQuota, incrementQuota, getQuota } from './quota-service.js';
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
    return reply.send({
        plan: result.plan,
        summary: result.summary,
    });
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
export async function chatHandler(request, reply) {
    try {
        const userId = request.user.id;
        const { message, conversationId } = request.body;
        const quotaCheck = await checkQuota(userId, 2000);
        if (!quotaCheck.allowed) {
            return reply.status(429).send({
                error: 'Quota exceeded',
                message: `Kuota AI Anda sudah habis. Upgrade ke Pro untuk unlimited access.`,
                quota: quotaCheck.quota,
            });
        }
        const context = await buildFinancialContext(userId);
        const systemPrompt = buildSystemPrompt(context);
        const complexity = classifyQuery(message);
        const router = createRouter({});
        let convId = conversationId;
        if (!convId) {
            const conversation = await prisma.conversation.create({
                data: { userId },
            });
            convId = conversation.id;
        }
        const lastMessages = await prisma.message.findMany({
            where: { conversationId: convId },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        const messages = [
            { role: 'system', content: systemPrompt },
            ...lastMessages.reverse().map(m => ({
                role: m.role,
                content: m.content,
            })),
            { role: 'user', content: message },
        ];
        const result = await router.route(messages, complexity);
        await prisma.message.createMany({
            data: [
                { conversationId: convId, role: 'user', content: message },
                { conversationId: convId, role: 'assistant', content: result.content },
            ],
        });
        await incrementQuota(userId, result.tokensUsed);
        return reply.send({
            response: result.content,
            model: result.model,
            tokensUsed: result.tokensUsed,
            conversationId: convId,
        });
    }
    catch (error) {
        request.log.error(error);
        console.error('=== CHAT ERROR ===');
        console.error(error);
        console.error('==================');
        return reply.status(500).send({
            error: 'Internal server error',
            message: 'Terjadi kesalahan saat memproses pesan Anda.',
        });
    }
}
export async function quotaHandler(request, reply) {
    const quota = await getQuota(request.user.id);
    return reply.send(quota);
}
export async function clearHistoryHandler(request, reply) {
    const { conversationId } = request.body;
    const userId = request.user.id;
    const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
    });
    if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
    }
    await prisma.message.deleteMany({
        where: { conversationId },
    });
    return { success: true };
}
//# sourceMappingURL=controller.js.map