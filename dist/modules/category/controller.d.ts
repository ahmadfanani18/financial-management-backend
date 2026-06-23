import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function getCategoriesHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getCategoryHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createCategoryHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function updateCategoryHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteCategoryHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=controller.d.ts.map