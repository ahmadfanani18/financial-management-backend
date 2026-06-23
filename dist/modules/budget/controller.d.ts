import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function getBudgetsHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getBudgetSummaryHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getBudgetHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createBudgetHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function updateBudgetHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateBudgetSpentHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteBudgetHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=controller.d.ts.map