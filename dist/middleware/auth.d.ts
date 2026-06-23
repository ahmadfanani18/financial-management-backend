import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: {
            id: string;
            email: string;
            name: string;
        };
        user: {
            id: string;
            email: string;
            name: string;
        };
    }
}
//# sourceMappingURL=auth.d.ts.map