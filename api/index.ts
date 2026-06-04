import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { getServerlessHandler } = await import('./_fastify-handler.js');
  
  try {
    const slsHandler = await getServerlessHandler();
    
    const event = {
      httpMethod: req.method || 'GET',
      path: req.url?.split('?')[0] || '/',
      headers: req.headers as Record<string, string>,
      queryStringParameters: req.query as Record<string, string>,
      body: req.body ? JSON.stringify(req.body) : null,
    };
    
    const result = await slsHandler(event, { callbackWaitsForEmptyEventLoop: false });
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    }
    
    res.status(result.statusCode || 200);
    
    if (result.body) {
      try {
        const body = JSON.parse(result.body);
        res.json(body);
      } catch {
        res.send(result.body);
      }
    } else {
      res.send({});
    }
  } catch (error: any) {
    console.error('Serverless handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    });
  }
}