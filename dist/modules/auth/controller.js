import { authService } from './service.js';
import { registerSchema, loginSchema } from './schemas.js';
export async function registerHandler(request, reply) {
    const input = registerSchema.parse(request.body);
    const user = await authService.register(input);
    const token = await reply.jwtSign({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    });
    return reply.status(201).send({ user, token });
}
export async function loginHandler(request, reply) {
    const input = loginSchema.parse(request.body);
    const loginResult = await authService.login(input);
    const userProfile = await authService.getProfile(loginResult.id);
    const user = JSON.parse(JSON.stringify({
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        role: userProfile.role,
        subscriptionTier: userProfile.subscriptionTier,
        trialStartedAt: userProfile.trialStartedAt,
        trialEndsAt: userProfile.trialEndsAt,
        subscriptionStartAt: userProfile.subscriptionStartAt,
        subscriptionEndAt: userProfile.subscriptionEndAt,
    }));
    const token = await reply.jwtSign({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    });
    return reply.send({ user, token });
}
export async function meHandler(request, reply) {
    const user = await authService.getProfile(request.user.id);
    const responseData = JSON.parse(JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        trialStartedAt: user.trialStartedAt,
        trialEndsAt: user.trialEndsAt,
        subscriptionStartAt: user.subscriptionStartAt,
        subscriptionEndAt: user.subscriptionEndAt,
    }));
    return reply.send({ user: responseData });
}
export async function changePasswordHandler(request, reply) {
    const { currentPassword, newPassword } = request.body;
    const result = await authService.changePassword(request.user.id, currentPassword, newPassword);
    return reply.send(result);
}
export async function forgotPasswordHandler(request, reply) {
    const { email } = request.body;
    const result = await authService.forgotPassword(email);
    return reply.send(result);
}
export async function resetPasswordHandler(request, reply) {
    const { token, password } = request.body;
    const result = await authService.resetPassword(token, password);
    return reply.send(result);
}
export async function verifyEmailHandler(request, reply) {
    const { token } = request.body;
    const result = await authService.verifyEmail(token);
    return reply.send(result);
}
export async function resendVerificationHandler(request, reply) {
    const { email } = request.body;
    const result = await authService.resendVerification(email);
    return reply.send(result);
}
//# sourceMappingURL=controller.js.map