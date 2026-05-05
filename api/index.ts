export default async function handler(req: unknown, res: unknown) {
  const vercelReq = req as { method: string; url: string; headers: Record<string, string | string[] | undefined> };
  const vercelRes = res as { status: (code: number) => typeof vercelRes; setHeader: (key: string, value: string) => void; send: (data: string) => void };

  const origin = vercelReq.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://financial-management-frontend.vercel.app'
  ];
  
  if (allowedOrigins.includes(origin as string)) {
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
  
  if (vercelReq.url === '/api/health') {
    vercelRes.status(200).send(JSON.stringify({ status: 'ok' }));
    return;
  }
  
  if (vercelReq.url?.startsWith('/api/auth/login')) {
    vercelRes.status(200).send(JSON.stringify({ message: 'login endpoint works' }));
    return;
  }
  
  vercelRes.status(404).send(JSON.stringify({ error: 'Not found', url: vercelReq.url }));
}