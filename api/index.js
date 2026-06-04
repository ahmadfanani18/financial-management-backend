import authHandler from './auth.js';
import accountsHandler from './accounts.js';
import categoriesHandler from './categories.js';
import transactionsHandler from './transactions.js';
import budgetsHandler from './budgets.js';
import goalsHandler from './goals.js';
import plansHandler from './plans.js';
import reportsHandler from './reports.js';
import aiHandler from './ai.js';
import searchHandler from './search.js';
import subscriptionHandler from './subscription.js';
import paymentHandler from './payment.js';
import adminHandler from './admin.js';
import userHandler from './user.js';
import notificationHandler from './notifications.js';

export default async function handler(req, res) {
  const url = (req.url || '/').split('?')[0];

  if (url.startsWith('/api/user/')) return userHandler(req, res);
  if (url.startsWith('/api/auth')) return authHandler(req, res);
  if (url.startsWith('/api/accounts')) return accountsHandler(req, res);
  if (url.startsWith('/api/categories')) return categoriesHandler(req, res);
  if (url.startsWith('/api/transactions')) return transactionsHandler(req, res);
  if (url.startsWith('/api/budgets')) return budgetsHandler(req, res);
  if (url.startsWith('/api/goals')) return goalsHandler(req, res);
  if (url.startsWith('/api/plans')) return plansHandler(req, res);
  if (url.startsWith('/api/ai')) return aiHandler(req, res);
  if (url.startsWith('/api/search')) return searchHandler(req, res);
  if (url.startsWith('/api/subscription')) return subscriptionHandler(req, res);
  if (url.startsWith('/api/payment')) return paymentHandler(req, res);
  if (url.startsWith('/api/admin')) return adminHandler(req, res);
  if (url.startsWith('/api/notifications')) return notificationHandler(req, res);
  if (url.startsWith('/api/reports')) return reportsHandler(req, res);

  res.status(404).send(JSON.stringify({ error: 'Not found', url }));
}