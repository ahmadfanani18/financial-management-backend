import { transactionService } from './service.js';
import { createTransactionSchema, updateTransactionSchema, transactionIdSchema, transactionQuerySchema, importConfirmRequestSchema } from './schemas.js';
export async function getTemplateHandler(request, reply) {
    const templateData = await transactionService.getTemplateData(request.user.id);
    const headers = {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="transaction-template.csv"',
    };
    const categoryOptions = templateData.categories.map(c => c.name).join('|');
    const accountOptions = templateData.accounts.map(a => a.name).join('|');
    const csvContent = `date,description,category,account,amount,type
2026-01-15,Contoh Income,${categoryOptions.split('|')[0] || ''},${accountOptions.split('|')[0] || ''},15000000,income
2026-01-14,Contoh Expense,${categoryOptions.split('|')[0] || ''},${accountOptions.split('|')[0] || ''},50000,expense`;
    return reply.headers(headers).send(csvContent);
}
export async function importPreviewHandler(request, reply) {
    const data = await request.file();
    if (!data) {
        return reply.status(400).send({ error: 'File CSV wajib diupload' });
    }
    const csvContent = await data.toBuffer().toString('utf-8');
    const result = await transactionService.parseAndValidateCsv(request.user.id, csvContent);
    return reply.send(result);
}
export async function importConfirmHandler(request, reply) {
    const { transactions } = importConfirmRequestSchema.parse(request.body);
    const result = await transactionService.importTransactions(request.user.id, transactions);
    return reply.send(result);
}
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
//# sourceMappingURL=controller.js.map