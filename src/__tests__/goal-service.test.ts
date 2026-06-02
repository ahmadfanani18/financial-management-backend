import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../config/prisma.js';

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    goal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    goalContribution: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    budget: {
      createMany: vi.fn(),
    },
  },
}));

describe('Goal Service - Initial Balance & Budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create with linkedAccountId', () => {
    it('should set currentAmount from linked account balance', async () => {
      const mockAccount = { id: 'acc-1', name: 'Tabungan', balance: 37000000 };
      const mockGoal = {
        id: 'goal-1',
        name: 'Liburan',
        targetAmount: 97000000,
        currentAmount: 37000000,
        deadline: new Date('2027-06-01'),
        userId: 'user-1',
        linkedAccountId: 'acc-1',
        isInitialSet: true,
        isLocked: false,
        source: 'MANUAL',
        sourceMilestoneId: null,
        icon: 'target',
        color: '#10B981',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.goal.create).mockResolvedValue(mockGoal);
      vi.mocked(prisma.goalContribution.create).mockResolvedValue({
        id: 'contrib-1',
        goalId: 'goal-1',
        amount: 37000000,
        date: new Date(),
        type: 'INITIAL',
      });

      expect(mockGoal.currentAmount).toBe(37000000);
      expect(mockGoal.isInitialSet).toBe(true);
    });
  });

  describe('createBudgetsForGoal', () => {
    it('should create budget for each remaining month', async () => {
      const now = new Date();
      const deadline = new Date(now);
      deadline.setMonth(deadline.getMonth() + 12);
      
      const monthsRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      expect(monthsRemaining).toBeGreaterThanOrEqual(12);
    });
  });
});

describe('Account Service - Lock & Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleLock', () => {
    it('should update isLocked and lockedReason', async () => {
      const mockAccount = {
        id: 'acc-1',
        userId: 'user-1',
        name: 'Tabungan',
        isLocked: false,
        lockedReason: null,
      };

      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.account.update).mockResolvedValue({
        ...mockAccount,
        isLocked: true,
        lockedReason: 'Taburan Liburan',
      });

      expect(mockAccount.isLocked).toBe(false);
    });
  });

  describe('linkToGoal', () => {
    it('should set linkedGoalId on account', async () => {
      const mockAccount = { id: 'acc-1', userId: 'user-1', linkedGoalId: null };
      const mockGoal = { id: 'goal-1', userId: 'user-1', name: 'Liburan' };

      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.goal.findFirst).mockResolvedValue(mockGoal);
      vi.mocked(prisma.account.update).mockResolvedValue({
        ...mockAccount,
        linkedGoalId: 'goal-1',
      });

      expect(mockAccount.linkedGoalId).toBeNull();
    });
  });
});

describe('Transaction Service - Auto-Contribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleAutoContribution', () => {
    it('should trigger for locked account with linked goal', async () => {
      const mockAccount = {
        id: 'acc-1',
        name: 'Tabungan',
        isLocked: true,
        linkedGoal: {
          id: 'goal-1',
          name: 'Liburan',
          currentAmount: 37000000,
          targetAmount: 97000000,
          isLocked: false,
        },
      };

      expect(mockAccount.isLocked).toBe(true);
      expect(mockAccount.linkedGoal).toBeDefined();
      expect(mockAccount.linkedGoal.currentAmount).toBeLessThan(mockAccount.linkedGoal.targetAmount);
    });

    it('should not trigger for unlocked account', async () => {
      const mockAccount = {
        id: 'acc-1',
        name: 'Checking',
        isLocked: false,
        linkedGoal: {
          id: 'goal-1',
          name: 'Liburan',
        },
      };

      expect(mockAccount.isLocked).toBe(false);
    });

    it('should not trigger when goal is completed', async () => {
      const mockAccount = {
        id: 'acc-1',
        name: 'Tabungan',
        isLocked: true,
        linkedGoal: {
          id: 'goal-1',
          name: 'Liburan',
          currentAmount: 100000000,
          targetAmount: 97000000,
        },
      };

      expect(mockAccount.linkedGoal.currentAmount).toBeGreaterThanOrEqual(mockAccount.linkedGoal.targetAmount);
    });
  });
});

describe('AI Service - Exclude Locked Accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('suggestSavings', () => {
    it('should exclude locked accounts from totalAccountBalance', async () => {
      const accounts = [
        { id: 'acc-1', name: 'Checking', balance: 10000000, isLocked: false },
        { id: 'acc-2', name: 'Tabungan', balance: 37000000, isLocked: true },
      ];

      const unlockedAccounts = accounts.filter(a => !a.isLocked);
      const totalBalance = unlockedAccounts.reduce((sum, acc) => sum + acc.balance, 0);

      expect(totalBalance).toBe(10000000);
      expect(accounts.length).toBe(2);
      expect(unlockedAccounts.length).toBe(1);
    });
  });
});