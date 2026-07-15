import { searchService } from './service.js';
import { searchQuerySchema } from './schemas.js';
export async function searchController(fastify) {
    fastify.get('/', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = request.user?.id;
        if (!userId) {
            return reply.status(401).send({ message: 'Unauthorized' });
        }
        const parsed = searchQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({
                message: 'Invalid query',
                errors: parsed.error.errors,
            });
        }
        const result = await searchService.search(parsed.data, userId);
        return reply.send(result);
    });
}
//# sourceMappingURL=controller.js.map