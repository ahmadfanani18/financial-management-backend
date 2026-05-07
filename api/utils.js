const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://financial-management-frontend.vercel.app',
  'https://financial-management-frontend-seven.vercel.app'
];

function setupCors(res, origin) {
  if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH, OPTIONS');
  }
}

function simpleToken(userId, email) {
  return Buffer.from(JSON.stringify({ userId, email })).toString('base64');
}

function parseToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return JSON.parse(Buffer.from(authHeader.slice(7), 'base64').toString());
  } catch {
    return null;
  }
}

let prisma = null;

async function getPrisma() {
  if (!prisma) {
    const { PrismaClient } = await import('@prisma/client');
    const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    prisma = new PrismaClient({
      datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined
    });
  }
  return prisma;
}

function parseBody(body) {
  if (!body) return {};
  return typeof body === 'string' ? JSON.parse(body) : body;
}

async function hashPassword(password) {
  const crypto = await import('crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return salt + ':' + hash;
}

async function verifyPassword(password, hashedPassword) {
  const crypto = await import('crypto');
  const [salt, hash] = hashedPassword.split(':');
  const newHash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return hash === newHash;
}

export { simpleToken, parseToken, getPrisma, parseBody, setupCors, ALLOWED_ORIGINS, hashPassword, verifyPassword };