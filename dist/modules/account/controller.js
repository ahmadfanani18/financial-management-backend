import { accountService } from './service.js';
import { createAccountSchema, updateAccountSchema, accountIdSchema } from './schemas.js';
export async function getAccountsHandler(request, reply) {
    const accounts = await accountService.getAll(request.user.id);
    return reply.send({ accounts });
}
export async function getAccountHandler(request, reply) {
    const { id } = accountIdSchema.parse(request.params);
    const account = await accountService.getById(id, request.user.id);
    return reply.send({ account });
}
export async function createAccountHandler(request, reply) {
    const input = createAccountSchema.parse(request.body);
    const account = await accountService.create(request.user.id, input);
    return reply.status(201).send({ account });
}
export async function updateAccountHandler(request, reply) {
    const { id } = accountIdSchema.parse(request.params);
    const input = updateAccountSchema.parse(request.body);
    const account = await accountService.update(id, request.user.id, input);
    return reply.send({ account });
}
export async function deleteAccountHandler(request, reply) {
    const { id } = accountIdSchema.parse(request.params);
    await accountService.delete(id, request.user.id);
    return reply.status(204).send();
}
export async function getTotalBalanceHandler(request, reply) {
    const total = await accountService.getTotalBalance(request.user.id);
    return reply.send({ total });
}
