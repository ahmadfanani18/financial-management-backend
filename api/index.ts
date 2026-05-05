const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://financial-management-frontend.vercel.app'
];

const users: Array<{ id: number; email: string; password: string; name: string }> = [
  { id: 1, email: 'test@test.com', password: '$2a$10$fakehash', name: 'Test User' }
];

function simpleToken(userId: number, email: string): string {
  return Buffer.from(JSON.stringify({ userId, email })).toString('base64');
}

export default async function handler(req: unknown, res: unknown) {
  const vercelReq = req as { method: string; url: string; headers: Record<string, string | string[] | undefined>; body: unknown };
  const vercelRes = res as { status: (code: number) => typeof vercelRes; setHeader: (key: string, value: string) => void; send: (data: string) => void };

  const origin = vercelReq.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin as string)) {
    vercelRes.setHeader('Access-Control-Allow-Origin', origin as string);
    vercelRes.setHeader('Access-Control-Allow-Credentials', 'true');
    vercelRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    vercelRes.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH, OPTIONS');
  }

  if (vercelReq.method === 'OPTIONS') {
    vercelRes.status(204).send('');
    return;
  }

  vercelRes.setHeader('Content-Type', 'application/json');

  const url = vercelReq.url || '/';
  const method = vercelReq.method;
  
  if (url === '/api/health' && method === 'GET') {
    vercelRes.status(200).send(JSON.stringify({ status: 'ok' }));
    return;
  }
  
  if (url === '/api/auth/login' && method === 'POST') {
    const { email, password } = (vercelReq.body as { email?: string; password?: string }) || {};
    if (!email || !password) {
      vercelRes.status(400).send(JSON.stringify({ message: 'Email and password required' }));
      return;
    }
    const user = users.find(u => u.email === email);
    if (!user) {
      vercelRes.status(401).send(JSON.stringify({ message: 'Invalid credentials' }));
      return;
    }
    const token = simpleToken(user.id, user.email);
    vercelRes.status(200).send(JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }));
    return;
  }
  
  if (url === '/api/auth/register' && method === 'POST') {
    const { email, password, name } = (vercelReq.body as { email?: string; password?: string; name?: string }) || {};
    if (!email || !password) {
      vercelRes.status(400).send(JSON.stringify({ message: 'Email and password required' }));
      return;
    }
    if (users.find(u => u.email === email)) {
      vercelRes.status(400).send(JSON.stringify({ message: 'Email already exists' }));
      return;
    }
    const newUser = { id: users.length + 1, email, password, name: name || email.split('@')[0] };
    users.push(newUser);
    const token = simpleToken(newUser.id, newUser.email);
    vercelRes.status(201).send(JSON.stringify({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name } }));
    return;
  }
  
  vercelRes.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
}