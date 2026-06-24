import { z } from 'zod';

export type UserReportResponse = {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  trialUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  inactiveUsers: number;
  registrationTrend: Array<{ month: string; count: number }>;
};

export type SubscriptionReportResponse = {
  mrr: number;
  totalRevenue: number;
  churnRate: number;
  conversionRate: number;
  tierDistribution: Array<{ tier: string; count: number }>;
  expiringSoon: Array<{ userId: string; email: string; expiresAt: string }>;
  pendingPayments: number;
};

export type ActivityReportResponse = {
  activeUsersToday: number;
  activeUsersThisWeek: number;
  activeUsersThisMonth: number;
  loginFrequency: Array<{ date: string; logins: number }>;
  featureUsage: Array<{ feature: string; usageCount: number }>;
};
