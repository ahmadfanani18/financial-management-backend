import { getPrisma, setupCors, parseToken } from './utils.js';

export default async function handler(req, res) {
  let db = null;
  try {
    const origin = req.headers.origin;
  setupCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  const url = (req.url || '/').split('?')[0];
  const method = req.method;

  const token = parseToken(req.headers.authorization);
  if (!token) {
    res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
    return;
  }

  db = await getPrisma();

  // GET general reports
  if (url === '/api/reports' && method === 'GET') {
    const transactions = await db.transaction.findMany({ where: { userId: token.userId } });
    const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    res.status(200).send(JSON.stringify({ income, expenses, savings: income - expenses, byCategory: [] }));
    return;
  }

  // GET monthly report
  if (url === '/api/reports/monthly' && method === 'GET') {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const year = parseInt(params.get('year') || new Date().getFullYear());
    const month = parseInt(params.get('month') || (new Date().getMonth() + 1));
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0).toISOString();
    const transactions = await db.transaction.findMany({
      where: { userId: token.userId, date: { gte: startDate, lte: endDate } }
    });
    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    res.status(200).send(JSON.stringify({
      report: {
        period: { year, month, label: `${month}/${year}` },
        summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense },
        incomeByCategory: [],
        expenseByCategory: [],
        transactions
      }
    }));
    return;
  }

  // GET trends
  if (url === '/api/reports/trends' && method === 'GET') {
    res.status(200).send(JSON.stringify({ trends: [] }));
    return;
  }

  // GET net worth
  if (url === '/api/reports/net-worth' && method === 'GET') {
    const accounts = await db.account.findMany({ where: { userId: token.userId, isArchived: false } });
    const totalAssets = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    res.status(200).send(JSON.stringify({ totalAssets, totalLiabilities: 0, investments: 0, netWorth: totalAssets }));
    return;
  }

  // GET cash flow
  if (url === '/api/reports/cash-flow' && method === 'GET') {
    res.status(200).send(JSON.stringify({ dailyFlow: [] }));
    return;
  }

  // GET category breakdown
  if (url === '/api/reports/category-breakdown' && method === 'GET') {
    res.status(200).send(JSON.stringify({ total: 0, categories: [] }));
    return;
  }

  // GET notifications
  if (url === '/api/notifications' && method === 'GET') {
    const notifications = await db.notification.findMany({ where: { userId: token.userId }, orderBy: { createdAt: 'desc' } });
    res.status(200).send(JSON.stringify({ notifications }));
    return;
  }

  // Mark notification as read
  const notificationReadMatch = url.match(/^\/api\/notifications\/([a-f0-9-]+)\/read$/i);
  if (notificationReadMatch && method === 'PUT') {
    const notification = await db.notification.update({
      where: { id: notificationReadMatch[1] },
      data: { isRead: true }
    });
    res.status(200).send(JSON.stringify({ notification }));
    return;
  }

  // Mark all notifications as read
  if (url === '/api/notifications/read-all' && method === 'PUT') {
    await db.notification.updateMany({
      where: { userId: token.userId },
      data: { isRead: true }
    });
    res.status(200).send(JSON.stringify({ message: 'All marked as read' }));
    return;
  }

  // POST ai ask
  if (url === '/api/ai/ask' && method === 'POST') {
    res.status(200).send(JSON.stringify({ answer: 'Fitur AI sedang dalam pengembangan.' }));
    return;
  }

  // GET ai suggestions
  if (url === '/api/ai/suggestions' && method === 'GET') {
    res.status(200).send(JSON.stringify({ suggestions: [] }));
    return;
  }

  // GET ai advice
  if (url === '/api/ai/advice' && method === 'GET') {
    res.status(200).send(JSON.stringify({ advice: 'Pertahankan kebiasaan menabung yang baik!' }));
    return;
  }

  // GET ai analyze spending
  if (url.match(/^\/api\/ai\/analyze-spending/i) && method === 'GET') {
    res.status(200).send(JSON.stringify({ analysis: { message: 'Analisis spending belum tersedia' } }));
    return;
  }

  // POST ai generate plan
  if (url === '/api/ai/generate-plan-from-data' && method === 'POST') {
    res.status(200).send(JSON.stringify({
      plan: { name: 'Rencana Keuangan', description: 'Plan generated by AI', status: 'ACTIVE', milestones: [] },
      summary: { totalBalance: '0', monthlyIncome: '0', monthlyExpense: '0', savings: '0', topExpenses: [] }
    }));
    return;
  }

  res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Reports handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}