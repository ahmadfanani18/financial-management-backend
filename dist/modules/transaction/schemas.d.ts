import { z } from 'zod';
export declare const createTransactionSchema: z.ZodObject<{
    accountId: z.ZodString;
    categoryId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["INCOME", "EXPENSE", "TRANSFER"]>;
    amount: z.ZodNumber;
    description: z.ZodDefault<z.ZodString>;
    date: z.ZodDate;
    receiptUrl: z.ZodOptional<z.ZodString>;
    fromAccountId: z.ZodOptional<z.ZodString>;
    toAccountId: z.ZodOptional<z.ZodString>;
    isRecurring: z.ZodDefault<z.ZodBoolean>;
    recurringPattern: z.ZodOptional<z.ZodObject<{
        frequency: z.ZodEnum<["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]>;
        interval: z.ZodNumber;
        endDate: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        endDate?: Date | undefined;
    }, {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        endDate?: Date | undefined;
    }>>;
    tagIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    date: Date;
    accountId: string;
    amount: number;
    description: string;
    isRecurring: boolean;
    categoryId?: string | undefined;
    receiptUrl?: string | undefined;
    fromAccountId?: string | undefined;
    toAccountId?: string | undefined;
    recurringPattern?: {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        endDate?: Date | undefined;
    } | undefined;
    tagIds?: string[] | undefined;
}, {
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    date: Date;
    accountId: string;
    amount: number;
    categoryId?: string | undefined;
    description?: string | undefined;
    receiptUrl?: string | undefined;
    fromAccountId?: string | undefined;
    toAccountId?: string | undefined;
    isRecurring?: boolean | undefined;
    recurringPattern?: {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        endDate?: Date | undefined;
    } | undefined;
    tagIds?: string[] | undefined;
}>;
export declare const updateTransactionSchema: z.ZodObject<{
    accountId: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    type: z.ZodOptional<z.ZodEnum<["INCOME", "EXPENSE", "TRANSFER"]>>;
    amount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    date: z.ZodOptional<z.ZodDate>;
    receiptUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    fromAccountId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    toAccountId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isRecurring: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    recurringPattern: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        frequency: z.ZodEnum<["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]>;
        interval: z.ZodNumber;
        endDate: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        endDate?: Date | undefined;
    }, {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        endDate?: Date | undefined;
    }>>>;
    tagIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    type?: "INCOME" | "EXPENSE" | "TRANSFER" | undefined;
    date?: Date | undefined;
    accountId?: string | undefined;
    categoryId?: string | undefined;
    amount?: number | undefined;
    description?: string | undefined;
    receiptUrl?: string | undefined;
    fromAccountId?: string | undefined;
    toAccountId?: string | undefined;
    isRecurring?: boolean | undefined;
    recurringPattern?: {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        endDate?: Date | undefined;
    } | undefined;
    tagIds?: string[] | undefined;
}, {
    type?: "INCOME" | "EXPENSE" | "TRANSFER" | undefined;
    date?: Date | undefined;
    accountId?: string | undefined;
    categoryId?: string | undefined;
    amount?: number | undefined;
    description?: string | undefined;
    receiptUrl?: string | undefined;
    fromAccountId?: string | undefined;
    toAccountId?: string | undefined;
    isRecurring?: boolean | undefined;
    recurringPattern?: {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        endDate?: Date | undefined;
    } | undefined;
    tagIds?: string[] | undefined;
}>;
export declare const transactionIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const transactionQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    accountId: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["INCOME", "EXPENSE", "TRANSFER"]>>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    minAmount: z.ZodOptional<z.ZodNumber>;
    maxAmount: z.ZodOptional<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    search?: string | undefined;
    type?: "INCOME" | "EXPENSE" | "TRANSFER" | undefined;
    accountId?: string | undefined;
    categoryId?: string | undefined;
    endDate?: Date | undefined;
    startDate?: Date | undefined;
    minAmount?: number | undefined;
    maxAmount?: number | undefined;
}, {
    search?: string | undefined;
    type?: "INCOME" | "EXPENSE" | "TRANSFER" | undefined;
    accountId?: string | undefined;
    categoryId?: string | undefined;
    endDate?: Date | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    startDate?: Date | undefined;
    minAmount?: number | undefined;
    maxAmount?: number | undefined;
}>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
//# sourceMappingURL=schemas.d.ts.map