import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getCategoriesHandler,
  getCategoryHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from './controller.js';

export async function categoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', getCategoriesHandler);
  fastify.get('/:id', getCategoryHandler);
  fastify.post('/', createCategoryHandler);
  fastify.put('/:id', updateCategoryHandler);
  fastify.delete('/:id', deleteCategoryHandler);
}
