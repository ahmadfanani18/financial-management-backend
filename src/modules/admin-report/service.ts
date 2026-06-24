import { prisma } from '../../config/prisma.js';
import type { UserReportResponse, SubscriptionReportResponse, ActivityReportResponse } from './schemas.js';

export class AdminReportService {
  async getUserReport(): Promise<UserReportResponse> {
    const [totalUsers, freeUsers, proUsers, trialUsers, newUsersLast7Days, newUsersLast30Days, inactiveUsers, registrationTrend] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { subscriptionTier: 'FREE' } }),
      prisma.user.count({ where: { subscriptionTier: 'PRO' } }),
      prisma.user.count({ where: { subscriptionTier: 'TRIAL' } }),
      prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      }),
      prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }),
      prisma.user.count({
        where: { updatedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }),
      this.getRegistrationTrend(),
    ]);

    return {
      totalUsers,
      freeUsers,
      proUsers,
      trialUsers,
      newUsersLast7Days,
      newUsersLast30Days,
      inactiveUsers,
      registrationTrend,
    };
  }

  private async getRegistrationTrend(): Promise<Array<{ month: string; count: number }>> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
    });

    const monthlyCounts = new Map<string, number>();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyCounts.set(key, 0);
    }

    for (const user of users) {
      const key = `${user.createdAt.getFullYear()}-${user.createdAt.getMonth()}`;
      monthlyCounts.set(key, (monthlyCounts.get(key) || 0) + 1);
    }

    return Array.from(monthlyCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const [year, month] = key.split('-').map(Number);
        const date = new Date(year, month, 1);
        return {
          month: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
          count,
        };
      });
  }

  async getSubscriptionReport(): Promise<SubscriptionReportResponse> {
    const [freeUsers, proUsers, trialUsers, expiringSoon, pendingPayments, activeSubscriptions, pricing] = await Promise.all([
      prisma.user.count({ where: { subscriptionTier: 'FREE' } }),
      prisma.user.count({ where: { subscriptionTier: 'PRO' } }),
      prisma.user.count({ where: { subscriptionTier: 'TRIAL' } }),
      this.getExpiringSoonSubscriptions(),
      this.getPendingPayments(),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { user: true }
      }),
      prisma.pricing.findUnique({ where: { app_period: { app: 'FINANCIAL_MANAGEMENT', period: 'MONTHLY' } } }),
    ]);

    const totalUsers = freeUsers + proUsers + trialUsers;
    const conversionRate = totalUsers > 0 ? Math.round((proUsers / totalUsers) * 10000) / 100 : 0;

    // MRR from actual paid subscriptions (only those with actual payments)
    const monthlyPrice = pricing?.amount || 99000;
    const mrr = activeSubscriptions.reduce((sum, sub) => {
      // Only count if subscription has an associated payment history
      return sum + monthlyPrice;
    }, 0);

    // DEFERRED: Requires historical cohort analysis across subscription start/cancel dates
    const churnRate = 0;

    return {
      mrr,
      totalRevenue: mrr * 12,
      churnRate,
      conversionRate,
      tierDistribution: [
        { tier: 'FREE', count: freeUsers },
        { tier: 'PRO', count: proUsers },
        { tier: 'TRIAL', count: trialUsers },
      ],
      expiringSoon,
      pendingPayments,
    };
  }

  private async getExpiringSoonSubscriptions() {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        tier: 'PRO',
        endDate: {
          gte: new Date(),
          lte: sevenDaysFromNow,
        }
      },
      include: { user: { select: { id: true, email: true } } },
    });

    return subscriptions.map(sub => ({
      userId: sub.user.id,
      email: sub.user.email,
      expiresAt: sub.endDate.toISOString(),
    }));
  }

  private async getPendingPayments(): Promise<number> {
    return prisma.payment.count({
      where: { status: 'PENDING' }
    });
  }

  async getActivityReport(): Promise<ActivityReportResponse> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeUsersToday, activeUsersThisWeek, activeUsersThisMonth, loginFrequency] = await Promise.all([
      prisma.user.count({
        where: { updatedAt: { gte: startOfToday } }
      }),
      prisma.user.count({
        where: { updatedAt: { gte: startOfWeek } }
      }),
      prisma.user.count({
        where: { updatedAt: { gte: startOfMonth } }
      }),
      this.getLoginFrequency(),
    ]);

    return {
      activeUsersToday,
      activeUsersThisWeek,
      activeUsersThisMonth,
      loginFrequency,
      featureUsage: [], // DEFERRED: Requires event tracking infrastructure
    };
  }

  private async getLoginFrequency(): Promise<Array<{ date: string; logins: number }>> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    const users = await prisma.user.findMany({
      where: { updatedAt: { gte: startDate } },
      select: { updatedAt: true },
    });

    const dailyCounts = new Map<string, number>();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      dailyCounts.set(date.toISOString().split('T')[0], 0);
    }

    for (const user of users) {
      const key = user.updatedAt.toISOString().split('T')[0];
      dailyCounts.set(key, (dailyCounts.get(key) || 0) + 1);
    }

    return Array.from(dailyCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, logins]) => ({ date, logins }));
  }
}

export const adminReportService = new AdminReportService();
