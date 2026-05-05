import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.error('Test handler called');
  console.error('req:', typeof req, req.url);
  console.error('res:', typeof res);
  
  res.status(200).json({ message: 'Hello from Vercel!' });
}