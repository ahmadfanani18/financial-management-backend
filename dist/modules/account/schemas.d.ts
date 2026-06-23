import { z } from 'zod';
export declare const createAccountSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["BANK", "EWALLET", "CASH", "CREDIT_CARD", "INVESTMENT"]>;
    balance: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    icon: z.ZodDefault<z.ZodString>;
    color: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "BANK" | "EWALLET" | "CASH" | "CREDIT_CARD" | "INVESTMENT";
    balance: number;
    currency: string;
    icon: string;
    color: string;
}, {
    name: string;
    type: "BANK" | "EWALLET" | "CASH" | "CREDIT_CARD" | "INVESTMENT";
    balance?: number | undefined;
    currency?: string | undefined;
    icon?: string | undefined;
    color?: string | undefined;
}>;
export declare const updateAccountSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["BANK", "EWALLET", "CASH", "CREDIT_CARD", "INVESTMENT"]>>;
    balance: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    icon: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    color: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    type?: "BANK" | "EWALLET" | "CASH" | "CREDIT_CARD" | "INVESTMENT" | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
    icon?: string | undefined;
    color?: string | undefined;
}, {
    name?: string | undefined;
    type?: "BANK" | "EWALLET" | "CASH" | "CREDIT_CARD" | "INVESTMENT" | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
    icon?: string | undefined;
    color?: string | undefined;
}>;
export declare const accountIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
//# sourceMappingURL=schemas.d.ts.map