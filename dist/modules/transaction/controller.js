import { transactionService } from './service.js';
import { createTransactionSchema, updateTransactionSchema, transactionIdSchema, transactionQuerySchema } from './schemas.js';
export async function getTransactionsHandler(request, reply) {
    const query = transactionQuerySchema.parse(request.query);
    const result = await transactionService.getAll(request.user.id, query);
    return reply.send(result);
}
export async function getTransactionHandler(request, reply) {
    const { id } = transactionIdSchema.parse(request.params);
    const transaction = await transactionService.getById(id, request.user.id);
    return reply.send({ transaction });
}
export async function createTransactionHandler(request, reply) {
    try {
        const input = createTransactionSchema.parse(request.body);
        const transaction = await transactionService.create(request.user.id, input);
        return reply.status(201).send({ transaction });
    }
    catch (error) {
        if (error instanceof Error) {
            return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Terjadi kesalahan' });
    }
}
export async function updateTransactionHandler(request, reply) {
    const { id } = transactionIdSchema.parse(request.params);
    const input = updateTransactionSchema.parse(request.body);
    const transaction = await transactionService.update(id, request.user.id, input);
    return reply.send({ transaction });
}
export async function deleteTransactionHandler(request, reply) {
    const { id } = transactionIdSchema.parse(request.params);
    await transactionService.delete(id, request.user.id);
    return reply.status(204).send();
}
export async function getRecentTransactionsHandler(request, reply) {
    const limit = parseInt(request.query.limit || '5', 10);
    const transactions = await transactionService.getRecent(request.user.id, limit);
    return reply.send({ transactions });
}
export async function getSummaryHandler(request, reply) {
    const startDate = new Date(request.query.startDate);
    const endDate = new Date(request.query.endDate);
    const summary = await transactionService.getSummary(request.user.id, startDate, endDate);
    return reply.send(summary);
}
