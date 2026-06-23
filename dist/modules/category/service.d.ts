import type { CreateCategoryInput, UpdateCategoryInput } from './schemas.js';
export declare class CategoryService {
    getAll(userId: string): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.CategoryType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        icon: string;
        color: string;
        userId: string;
        isDefault: boolean;
    }[]>;
    getById(id: string, userId: string): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.CategoryType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        icon: string;
        color: string;
        userId: string;
        isDefault: boolean;
    }>;
    create(userId: string, input: CreateCategoryInput): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.CategoryType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        icon: string;
        color: string;
        userId: string;
        isDefault: boolean;
    }>;
    update(id: string, userId: string, input: UpdateCategoryInput): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.CategoryType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        icon: string;
        color: string;
        userId: string;
        isDefault: boolean;
    }>;
    delete(id: string, userId: string): Promise<void>;
    getByType(userId: string, type: 'INCOME' | 'EXPENSE'): Promise<{
        name: string;
        type: import("@prisma/client").$Enums.CategoryType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        icon: string;
        color: string;
        userId: string;
        isDefault: boolean;
    }[]>;
}
export declare const categoryService: CategoryService;
//# sourceMappingURL=service.d.ts.map