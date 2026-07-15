export async function authenticate(request, reply) {
    try {
        await request.jwtVerify();
    }
    catch (err) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
}
export async function requireAdmin(request, reply) {
    const user = request.user;
    if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Admin only' });
    }
}
//# sourceMappingURL=auth.js.map