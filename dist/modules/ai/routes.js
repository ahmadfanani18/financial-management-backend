import { authenticate } from '../../middleware/auth.js';
import { generatePlanHandler, predictSpendingHandler, suggestSavingsHandler, generatePlanFromDataHandler, smartSaverCalculateHandler, smartSaverSuggestionsHandler, } from './controller.js';
export async function aiRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);
    fastify.post('/generate-plan', {
        schema: {
            body: {
                type: 'object',
                required: ['monthlyIncome'],
                properties: {
                    monthlyIncome: { type: 'number' },
                    currency: { type: 'string', default: 'IDR' },
                },
            },
        },
    }, generatePlanHandler);
    fastify.post('/generate-plan-from-data', generatePlanFromDataHandler);
    fastify.post('/predict-spending', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    months: { type: 'number', minimum: 1, maximum: 12, default: 3 },
                },
            },
        },
    }, predictSpendingHandler);
    fastify.post('/suggest-savings', suggestSavingsHandler);
    fastify.post('/smart-saver/calculate', {
        schema: {
            body: {
                type: 'object',
                required: ['targetPrice'],
                properties: {
                    itemName: { type: 'string' },
                    targetPrice: { type: 'number' },
                    monthlyBudget: { type: 'number' },
                },
            },
        },
    }, smartSaverCalculateHandler);
    fastify.get('/smart-saver/suggestions', smartSaverSuggestionsHandler);
}
