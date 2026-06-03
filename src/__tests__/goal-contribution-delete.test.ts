import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../config/prisma.js';

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    goal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    goalContribution: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    transaction: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    planMilestone: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    budget: {
      createMany: vi.fn(),
    },
  },
}));

import { goalService } from '../service.js';

describe('Goal Contribution Delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteContribution', () => {
    it('should throw error when contribution not found', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        name: 'Test',
        currentAmount: 100,
        targetAmount: 1000,
        status: 'ACTIVE',
        deadline: new Date(),
        isLocked: false,
        initialBalance: 0,
      };

      vi.mocked(prisma.goal.findFirst).mockResolvedValue(mockGoal);
      vi.mocked(prisma.goalContribution.findFirst).mockResolvedValue(null);

      await expect(goalService.deleteContribution('g1', 'c1', 'u1')).rejects.toThrow('Contribution tidak ditemukan');
    });

    it('should throw error for INITIAL contribution', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        name: 'Test',
        currentAmount: 100,
        targetAmount: 1000,
        status: 'ACTIVE',
        deadline: new Date(),
        isLocked: false,
        initialBalance: 0,
      };
      const mockContrib = {
        id: 'c1',
        goalId: 'g1',
        amount: 100,
        type: 'INITIAL' as const,
        accountId: null,
        sourceTransactionId: null,
        date: new Date(),
        note: null,
      };

      vi.mocked(prisma.goal.findFirst).mockResolvedValue(mockGoal);
      vi.mocked(prisma.goalContribution.findFirst).mockResolvedValue(mockContrib);

      await expect(goalService.deleteContribution('g1', 'c1', 'u1')).rejects.toThrow('Contribution awal tidak bisa dihapus');
    });

    it('should throw error when goal not found', async () => {
      vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);

      await expect(goalService.deleteContribution('g1', 'c1', 'u1')).rejects.toThrow('Target tabungan tidak ditemukan');
    });

    it('should delete MANUAL contribution and decrement goal amount', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        name: 'Test',
        currentAmount: 200,
        targetAmount: 1000,
        status: 'ACTIVE',
        deadline: new Date(),
        isLocked: false,
        initialBalance: 0,
      };
      const mockContrib = {
        id: 'c1',
        goalId: 'g1',
        amount: 100,
        type: 'MANUAL' as const,
        accountId: null,
        sourceTransactionId: null,
        date: new Date(),
        note: 'Test contribution',
      };
      const updatedGoal = { ...mockGoal, currentAmount: 100, status: 'ACTIVE' };

      vi.mocked(prisma.goal.findFirst).mockResolvedValue(mockGoal);
      vi.mocked(prisma.goalContribution.findFirst).mockResolvedValue(mockContrib);
      vi.mocked(prisma.goal.update).mockResolvedValue(updatedGoal);
      vi.mocked(prisma.goal.findUnique).mockResolvedValue(updatedGoal);
      vi.mocked(prisma.goalContribution.delete).mockResolvedValue(mockContrib);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await goalService.deleteContribution('g1', 'c1', 'u1');
      expect(result.success).toBe(true);
      expect(prisma.goal.update).toHaveBeenCalled();
    });

    it('should reactivate COMPLETED goal when contribution is deleted', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        name: 'Test',
        currentAmount: 1000,
        targetAmount: 1000,
        status: 'COMPLETED' as const,
        deadline: new Date(),
        isLocked: false,
        initialBalance: 0,
      };
      const mockContrib = {
        id: 'c1',
        goalId: 'g1',
        amount: 100,
        type: 'MANUAL' as const,
        accountId: null,
        sourceTransactionId: null,
        date: new Date(),
        note: null,
      };
      const updatedGoal = { ...mockGoal, currentAmount: 900, status: 'ACTIVE' as const };

      vi.mocked(prisma.goal.findFirst).mockResolvedValue(mockGoal);
      vi.mocked(prisma.goalContribution.findFirst).mockResolvedValue(mockContrib);
      vi.mocked(prisma.goal.update).mockResolvedValue(updatedGoal);
      vi.mocked(prisma.goal.findUnique).mockResolvedValue(updatedGoal);
      vi.mocked(prisma.goalContribution.delete).mockResolvedValue(mockContrib);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await goalService.deleteContribution('g1', 'c1', 'u1');
      expect(result.success).toBe(true);
    });

    it('should refund account balance when contribution has accountId', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        name: 'Test',
        currentAmount: 200,
        targetAmount: 1000,
        status: 'ACTIVE',
        deadline: new Date(),
        isLocked: false,
        initialBalance: 0,
      };
      const mockContrib = {
        id: 'c1',
        goalId: 'g1',
        amount: 100,
        type: 'MANUAL' as const,
        accountId: 'acc1',
        sourceTransactionId: null,
        date: new Date(),
        note: null,
      };
      const updatedGoal = { ...mockGoal, currentAmount: 100 };

      vi.mocked(prisma.goal.findFirst).mockResolvedValue(mockGoal);
      vi.mocked(prisma.goalContribution.findFirst).mockResolvedValue(mockContrib);
      vi.mocked(prisma.goal.update).mockResolvedValue(updatedGoal);
      vi.mocked(prisma.goal.findUnique).mockResolvedValue(updatedGoal);
      vi.mocked(prisma.goalContribution.delete).mockResolvedValue(mockContrib);
      vi.mocked(prisma.account.update).mockResolvedValue({ id: 'acc1', balance: 1100 } as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await goalService.deleteContribution('g1', 'c1', 'u1');
      expect(result.success).toBe(true);
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc1' },
        data: { balance: { increment: 100 } },
      });
    });
  });
});
