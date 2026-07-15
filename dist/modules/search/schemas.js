import { z } from 'zod';
export const searchQuerySchema = z.object({
    q: z.string().min(1).max(100),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 5), z.number().min(1).max(10).default(5)),
});
//# sourceMappingURL=schemas.js.map