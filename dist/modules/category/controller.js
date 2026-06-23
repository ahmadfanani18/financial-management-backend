import { categoryService } from './service.js';
import { createCategorySchema, updateCategorySchema, categoryIdSchema } from './schemas.js';
export async function getCategoriesHandler(request, reply) {
    const categories = await categoryService.getAll(request.user.id);
    return reply.send({ categories });
}
export async function getCategoryHandler(request, reply) {
    const { id } = categoryIdSchema.parse(request.params);
    const category = await categoryService.getById(id, request.user.id);
    return reply.send({ category });
}
export async function createCategoryHandler(request, reply) {
    const input = createCategorySchema.parse(request.body);
    const category = await categoryService.create(request.user.id, input);
    return reply.status(201).send({ category });
}
export async function updateCategoryHandler(request, reply) {
    const { id } = categoryIdSchema.parse(request.params);
    const input = updateCategorySchema.parse(request.body);
    const category = await categoryService.update(id, request.user.id, input);
    return reply.send({ category });
}
export async function deleteCategoryHandler(request, reply) {
    const { id } = categoryIdSchema.parse(request.params);
    await categoryService.delete(id, request.user.id);
    return reply.status(204).send();
}
