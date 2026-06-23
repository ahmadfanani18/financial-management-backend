import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function getTransactionsHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getTransactionHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createTransactionHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function updateTransactionHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteTransactionHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getRecentTransactionsHandler(request: FastifyRequest<{
    Querystring: {
        limit?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getSummaryHandler(request: FastifyRequest<{
    Querystring: {
        startDate: string;
        endDate: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=controller.d.ts.map