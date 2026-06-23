import type { RegisterInput, LoginInput } from './schemas.js';
export declare class AuthService {
    register(input: RegisterInput): Promise<{
        email: string;
        name: string;
        id: string;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRole;
    }>;
    login(input: LoginInput): Promise<{
        id: string;
        email: string;
        name: string;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRole;
    }>;
    getProfile(userId: string): Promise<{
        email: string;
        name: string;
        id: string;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        preferences: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }>;
}
export declare const authService: AuthService;
//# sourceMappingURL=service.d.ts.map