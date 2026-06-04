import { getPrisma, parseBody, setupCors, parseToken } from './utils.js';

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

    // GET /api/notifications
    if (url === '/api/notifications' && method === 'GET') {
      const notifications = await db.notification.findMany({
        where: { userId: token.userId },
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).send(JSON.stringify({ notifications }));
      return;
    }

    // PUT /api/notifications/:id/read
    const notifMatch = url.match(/^\/api\/notifications\/([a-f0-9-]+)\/read$/i);
    if (notifMatch && method === 'PUT') {
      const notification = await db.notification.update({
        where: { id: notifMatch[1] },
        data: { isRead: true },
      });
      res.status(200).send(JSON.stringify({ notification }));
      return;
    }

    // PUT /api/notifications/read-all
    if (url === '/api/notifications/read-all' && method === 'PUT') {
      await db.notification.updateMany({
        where: { userId: token.userId },
        data: { isRead: true },
      });
      res.status(200).send(JSON.stringify({ message: 'All marked as read' }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Notification handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}