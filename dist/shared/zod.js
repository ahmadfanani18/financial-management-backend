import { z } from 'zod';
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
export const dateRangeSchema = z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
}).refine(data => data.startDate <= data.endDate, {
    message: 'Start date must be before end date',
});
//# sourceMappingURL=zod.js.map