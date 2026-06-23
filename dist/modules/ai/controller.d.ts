import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function generatePlanHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function predictSpendingHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function suggestSavingsHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function generatePlanFromDataHandler(request: FastifyRequest, reply: FastifyReply): Promise<{
    plan: {
        name: string;
        description: string;
        startDate: string;
        endDate: string;
        status: "ACTIVE";
        milestones: {
            targetDate: string;
            id: string;
            isCompleted: boolean;
            order: number;
            title: string;
            description: string;
            targetAmount: number;
        }[];
    } | null;
    summary: {
        totalBalance: string;
        monthlyIncome: string;
        monthlyExpense: string;
        savings: string;
        topExpenses: {
            category: string;
            amount: number;
        }[];
    } | null;
}>;
//# sourceMappingURL=controller.d.ts.map