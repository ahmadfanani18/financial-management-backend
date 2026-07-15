import { updateProfileSchema } from './schemas.js';
import { userService } from './service.js';
export async function getProfileHandler(request, reply) {
    const user = await userService.getProfile(request.user.id);
    return reply.send({ user });
}
export async function updateProfileHandler(request, reply) {
    const input = updateProfileSchema.parse(request.body);
    const user = await userService.updateProfile(request.user.id, input);
    return reply.send({ user });
}
export async function getNotificationPreferencesHandler(request, reply) {
    const prefs = await userService.getNotificationPreferences(request.user.id);
    return { preferences: prefs };
}
export async function updateNotificationPreferencesHandler(request, reply) {
    const prefs = await userService.updateNotificationPreferences(request.user.id, request.body);
    return { preferences: prefs };
}
//# sourceMappingURL=controller.js.map