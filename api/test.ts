export default function handler(req: { method: string }, res: { status: (code: number) => typeof res; json: (data: unknown) => void }) {
  res.status(200).json({ test: 'ok' });
}