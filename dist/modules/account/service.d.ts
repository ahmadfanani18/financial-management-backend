import type { CreateAccountInput, UpdateAccountInput } from './schemas.js';
export declare class AccountService {
    getAll(userId: string): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.AccountType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        balance: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        icon: string;
        color: string;
        userId: string;
        isArchived: boolean;
    }[]>;
    getById(id: string, userId: string): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.AccountType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        balance: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        icon: string;
        color: string;
        userId: string;
        isArchived: boolean;
    }>;
    create(userId: string, input: CreateAccountInput): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.AccountType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        balance: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        icon: string;
        color: string;
        userId: string;
        isArchived: boolean;
    }>;
    update(id: string, userId: string, input: UpdateAccountInput): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.AccountType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        balance: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        icon: string;
        color: string;
        userId: string;
        isArchived: boolean;
    }>;
    delete(id: string, userId: string): Promise<void>;
    getTotalBalance(userId: string): Promise<number>;
    archive(id: string, userId: string): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.AccountType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        balance: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        icon: string;
        color: string;
        userId: string;
        isArchived: boolean;
    }>;
}
export declare const accountService: AccountService;
//# sourceMappingURL=service.d.ts.map