import { getPrisma, parseBody, setupCors, parseToken } from './utils.js';

export default async function handler(req, res) {
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

  const db = await getPrisma();

  // GET all categories
  if (url === '/api/categories' && method === 'GET') {
    const categories = await db.category.findMany({ where: { userId: token.userId } });
    res.status(200).send(JSON.stringify({ categories }));
    return;
  }

  // POST create category
  if (url === '/api/categories' && method === 'POST') {
    const body = parseBody(req.body);
    const category = await db.category.create({
      data: {
        userId: token.userId,
        name: body.name,
        type: body.type || 'EXPENSE',
        icon: body.icon || 'tag',
        color: body.color || '#3B82F6',
        isDefault: false
      }
    });
    res.status(201).send(JSON.stringify({ category }));
    return;
  }

  // GET category by ID
  const categoryMatch = url.match(/^\/api\/categories\/([a-f0-9-]+)$/i);
  if (categoryMatch && method === 'GET') {
    const category = await db.category.findFirst({ where: { id: categoryMatch[1], userId: token.userId } });
    if (!category) {
      res.status(404).send(JSON.stringify({ message: 'Category not found' }));
      return;
    }
    res.status(200).send(JSON.stringify({ category }));
    return;
  }

  // PUT update category
  if (categoryMatch && method === 'PUT') {
    const body = parseBody(req.body);
    const category = await db.category.update({
      where: { id: categoryMatch[1] },
      data: body
    });
    res.status(200).send(JSON.stringify({ category }));
    return;
  }

  // DELETE category
  if (categoryMatch && method === 'DELETE') {
    await db.category.delete({ where: { id: categoryMatch[1] } });
    res.status(204).send(JSON.stringify({ message: 'Deleted' }));
    return;
  }

  res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
}