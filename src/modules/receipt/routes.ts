import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { analyzeReceiptRequestSchema } from './schemas';
import { analyzeReceipt } from './analyzer';

export async function routes(fastify: FastifyInstance) {
  fastify.post('/analyze-receipt', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { image?: string };

    const parseResult = analyzeReceiptRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_IMAGE',
        message: parseResult.error.errors[0]?.message || 'Format gambar tidak valid',
      });
    }

    try {
      const result = await analyzeReceipt(parseResult.data.image);

      if (result.items.length === 0 && result.total === 0) {
        return reply.status(400).send({
          error: 'NO_TEXT_DETECTED',
          message: 'Tidak ada teks terdeteksi. Pastikan nota jelas.',
        });
      }

      return reply.send({
        items: result.items,
        total: result.total,
        rawText: result.rawText,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'AI_ERROR',
        message: 'Gagal membaca nota. Coba upload ulang atau input manual.',
      });
    }
  });
}
