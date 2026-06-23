import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function getAccountsHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getAccountHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createAccountHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function updateAccountHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteAccountHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getTotalBalanceHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=controller.d.ts.map