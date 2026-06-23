import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function getGoalsHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getGoalHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createGoalHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function updateGoalHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteGoalHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function addContributionHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function toggleLockHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteGoalWithTransactionHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
    Body: {
        accountId?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getContributionsHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function addContributionWithAccountHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=controller.d.ts.map