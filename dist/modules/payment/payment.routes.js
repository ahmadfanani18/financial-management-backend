import * as paymentController from './payment.controller.js';
import { authenticate } from '../../middleware/auth.js';
export async function paymentRoutes(fastify) {
    fastify.post('/create', {
        preHandler: authenticate,
    }, paymentController.createPayment);
    fastify.post('/callback', paymentController.handleCallback);
    fastify.get('/my', {
        preHandler: authenticate,
    }, paymentController.getMyPayments);
    fastify.get('/:id', {
        preHandler: authenticate,
    }, paymentController.getPaymentDetail);
    fastify.get('/snap/token', {
        preHandler: authenticate,
    }, paymentController.getSnapToken);
    fastify.get('/order/:orderId', paymentController.getPaymentByOrderId);
}
//# sourceMappingURL=payment.routes.js.map