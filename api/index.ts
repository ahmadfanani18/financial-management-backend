import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://financial-management-frontend.vercel.app'
];

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

function createToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'simulated-signature';
  return `${header}.${payloadEncoded}.${signature}`;
}

async function handleAuthLogin(req: { body: { email?: string; password?: string } }) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Email and password required' }) };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials' }) };
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials' }) };
  }
  const token = createToken({ userId: user.id, email: user.email });
  return { statusCode: 200, body: JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }) };
}

async function handleAuthRegister(req: { body: { email?: string; password?: string; name?: string } }) {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Email and password required' }) };
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Email already exists' }) };
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name: name || email.split('@')[0] }
  });
  const token = createToken({ userId: user.id, email: user.email });
  return { statusCode: 201, body: JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }) };
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
  
  try {
    if (url === '/api/health') {
      vercelRes.status(200).send(JSON.stringify({ status: 'ok' }));
      return;
    }
    
    if (url === '/api/auth/login' && vercelReq.method === 'POST') {
      const result = await handleAuthLogin(vercelReq as { body: { email?: string; password?: string } });
      vercelRes.status(result.statusCode).send(result.body);
      return;
    }
    
    if (url === '/api/auth/register' && vercelReq.method === 'POST') {
      const result = await handleAuthRegister(vercelReq as { body: { email?: string; password?: string; name?: string } });
      vercelRes.status(result.statusCode).send(result.body);
      return;
    }
    
    vercelRes.status(404).send(JSON.stringify({ error: 'Not found', url }));
  } catch (err) {
    console.error('Error:', err);
    vercelRes.status(500).send(JSON.stringify({ error: 'Internal server error' }));
  }
}