import { prisma } from '../../config/prisma.js';
import { getEffectiveTier } from '../subscription/service.js';

const FREE_TIER_LIMIT = 10000;
const PREMIUM_LIMIT = 100000;

export interface QuotaStatus {
  used: number;
  limit: number;
  usedPercentage: number;
  resetsAt: Date;
  tier: 'FREE' | 'PRO';
}

export interface QuotaCheckResult {
  allowed: boolean;
  quota: QuotaStatus;
}

async function getQuota(userId: string): Promise<QuotaStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      trialEndsAt: true,
      aiQuotaUsed: true,
      aiQuotaResetAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const tier = getEffectiveTier(user);
  const limit = tier === 'PRO' ? PREMIUM_LIMIT : FREE_TIER_LIMIT;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let used = Number(user.aiQuotaUsed) || 0;
  const lastReset = user.aiQuotaResetAt ? new Date(user.aiQuotaResetAt) : null;

  if (!lastReset || lastReset < startOfMonth) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          aiQuotaUsed: 0,
          aiQuotaResetAt: startOfMonth,
        },
      }),
    ]);
    used = 0;
  }

  return {
    used,
    limit,
    usedPercentage: limit > 0 ? Math.round((used / limit) * 100) : 0,
    resetsAt,
    tier,
  };
}

async function checkQuota(
  userId: string,
  estimatedTokens?: number
): Promise<QuotaCheckResult> {
  const quota = await getQuota(userId);
  const tokensToUse = estimatedTokens || 1000;

  if (quota.used + tokensToUse > quota.limit) {
    return { allowed: false, quota };
  }

  return { allowed: true, quota };
}

async function incrementQuota(
  userId: string,
  tokensUsed: number
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiQuotaUsed: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const currentUsage = Number(user.aiQuotaUsed) || 0;
  await prisma.user.update({
    where: { id: userId },
    data: {
      aiQuotaUsed: currentUsage + tokensUsed,
    },
  });
}

export { getQuota, checkQuota, incrementQuota, FREE_TIER_LIMIT, PREMIUM_LIMIT };
