import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function getPlansHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getPlanHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createPlanHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function updatePlanHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deletePlanHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function addMilestoneHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateMilestoneHandler(request: FastifyRequest<{
    Params: {
        planId: string;
        milestoneId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteMilestoneHandler(request: FastifyRequest<{
    Params: {
        planId: string;
        milestoneId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function completeMilestoneHandler(request: FastifyRequest<{
    Params: {
        planId: string;
        milestoneId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function reorderMilestonesHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function linkBudgetHandler(request: FastifyRequest<{
    Params: {
        id: string;
        budgetId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function linkGoalHandler(request: FastifyRequest<{
    Params: {
        id: string;
        goalId: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=controller.d.ts.map