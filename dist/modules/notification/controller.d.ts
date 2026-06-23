import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function getNotificationsHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getUnreadNotificationsHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getUnreadCountHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function markAsReadHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function markAllAsReadHandler(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function deleteNotificationHandler(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=controller.d.ts.map