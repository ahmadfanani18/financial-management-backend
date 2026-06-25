import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUserData = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  password: null,
  avatar: null,
  role: 'MEMBER' as const,
  subscriptionTier: 'FREE' as const,
  trialStartedAt: null,
  trialEndsAt: null,
  subscriptionStartAt: null,
  subscriptionEndAt: null,
  lastReminderSentAt: null,
  preferences: {},
  aiQuotaUsed: 0,
  aiQuotaResetAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  emailVerifiedAt: null,
  emailVerificationToken: null,
};

const { mockFindUnique, mockUpdate, mockTransaction } = vi.hoisted(() => {
  return {
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(),
    mockTransaction: vi.fn((operations) => Promise.all(operations)),
  };
});

vi.mock('../config/prisma.js', () => ({
  prisma: {
    $transaction: mockTransaction,
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock('../subscription/service.js', () => ({
  getEffectiveTier: (user: { subscriptionTier: string; trialEndsAt: Date | null }) => {
    if (user.subscriptionTier === 'PRO') return 'PRO';
    if (user.subscriptionTier === 'TRIAL' && user.trialEndsAt && user.trialEndsAt > new Date()) return 'PRO';
    return 'FREE';
  },
}));

const { getQuota, checkQuota, incrementQuota, FREE_TIER_LIMIT, PREMIUM_LIMIT } = await import('../modules/ai/quota-service.js');

describe('quota-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getQuota', () => {
    it('should return FREE tier quota for free user', async () => {
      mockFindUnique.mockResolvedValue({
        ...mockUserData,
        aiQuotaUsed: 5000,
        aiQuotaResetAt: new Date(),
      });

      const quota = await getQuota('user-1');

      expect(quota.tier).toBe('FREE');
      expect(quota.limit).toBe(FREE_TIER_LIMIT);
      expect(quota.used).toBe(5000);
      expect(quota.usedPercentage).toBe(50);
    });

    it('should return PRO tier quota for pro user', async () => {
      mockFindUnique.mockResolvedValue({
        ...mockUserData,
        subscriptionTier: 'PRO',
        aiQuotaUsed: 50000,
        aiQuotaResetAt: new Date(),
      });

      const quota = await getQuota('user-1');

      expect(quota.tier).toBe('PRO');
      expect(quota.limit).toBe(PREMIUM_LIMIT);
    });

    it('should reset quota if past reset date', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      mockFindUnique.mockResolvedValue({
        ...mockUserData,
        aiQuotaUsed: 9000,
        aiQuotaResetAt: lastMonth,
      });

      mockUpdate.mockResolvedValue({});

      const quota = await getQuota('user-1');

      expect(quota.used).toBe(0);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          aiQuotaUsed: 0,
          aiQuotaResetAt: expect.any(Date),
        },
      });
    });
  });

  describe('checkQuota', () => {
    it('should allow request when under limit', async () => {
      mockFindUnique.mockResolvedValue({
        ...mockUserData,
        aiQuotaUsed: 5000,
        aiQuotaResetAt: new Date(),
      });

      const result = await checkQuota('user-1', 1000);

      expect(result.allowed).toBe(true);
      expect(result.quota.used).toBe(5000);
    });

    it('should deny request when over limit', async () => {
      mockFindUnique.mockResolvedValue({
        ...mockUserData,
        aiQuotaUsed: 9500,
        aiQuotaResetAt: new Date(),
      });

      const result = await checkQuota('user-1', 2000);

      expect(result.allowed).toBe(false);
    });
  });

  describe('incrementQuota', () => {
    it('should increment user quota', async () => {
      mockFindUnique.mockResolvedValue({
        ...mockUserData,
        aiQuotaUsed: 5000,
        aiQuotaResetAt: new Date(),
      });

      mockUpdate.mockResolvedValue({});

      await incrementQuota('user-1', 1500);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { aiQuotaUsed: 6500 },
      });
    });
  });
});
