import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function getMonthlyReportHandler(request: FastifyRequest<{
    Querystring: {
        year: string;
        month: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getCategoryBreakdownHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getTrendsHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getCashFlowHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getNetWorthHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function exportTransactionsHandler(request: FastifyRequest<{
    Querystring: {
        year: string;
        month: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=controller.d.ts.map