import { prisma } from '../../config/prisma.js';
export async function activateTrial(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            trialStartedAt: true,
            subscriptionTier: true,
        },
    });
    if (!user) {
        throw new Error('User not found');
    }
    if (user.trialStartedAt) {
        throw new Error('Trial sudah pernah digunakan');
    }
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await prisma.user.update({
        where: { id: userId },
        data: {
            subscriptionTier: 'TRIAL',
            trialStartedAt: now,
            trialEndsAt: trialEndsAt,
        },
    });
    return { success: true, message: 'Trial diaktifkan untuk 7 hari' };
}
export function getEffectiveTier(user) {
    if (user.subscriptionTier === 'PRO')
        return 'PRO';
    if (user.subscriptionTier === 'TRIAL' && user.trialEndsAt && user.trialEndsAt > new Date())
        return 'PRO';
    return 'FREE';
}
export function getFeatures(user) {
    const tier = getEffectiveTier(user);
    if (tier === 'PRO') {
        return {
            aiTips: true,
            reports: true,
            export: true,
            unlimitedTransactions: true,
            unlimitedGoals: true,
            unlimitedAccounts: true,
            maxAccounts: -1,
            maxTransactions: -1,
            maxGoals: -1,
        };
    }
    return {
        aiTips: false,
        reports: false,
        export: false,
        unlimitedTransactions: false,
        unlimitedGoals: false,
        unlimitedAccounts: false,
        maxAccounts: 1,
        maxTransactions: 5,
        maxGoals: 3,
    };
}
