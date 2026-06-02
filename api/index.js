import authHandler from './auth.js';
import accountsHandler from './accounts.js';
import categoriesHandler from './categories.js';
import transactionsHandler from './transactions.js';
import budgetsHandler from './budgets.js';
import goalsHandler from './goals.js';
import plansHandler from './plans.js';
import reportsHandler from './reports.js';

export default async function handler(req, res) {
  const url = (req.url || '/').split('?')[0];
  
  // Route based on path
  if (url.startsWith('/api/auth')) {
    return authHandler(req, res);
  }
  if (url.startsWith('/api/accounts') || url.startsWith('/api/user')) {
    return accountsHandler(req, res);
  }
  if (url.startsWith('/api/categories')) {
    return categoriesHandler(req, res);
  }
  if (url.startsWith('/api/transactions')) {
    return transactionsHandler(req, res);
  }
  if (url.startsWith('/api/budgets')) {
    return budgetsHandler(req, res);
  }
  if (url.startsWith('/api/goals')) {
    return goalsHandler(req, res);
  }
  if (url.startsWith('/api/plans')) {
    return plansHandler(req, res);
  }
  if (url.startsWith('/api/') || url === '/api') {
    return reportsHandler(req, res);
  }
  
  res.status(404).send(JSON.stringify({ error: 'Not found', url }));
}