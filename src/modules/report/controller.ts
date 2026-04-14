import type { FastifyRequest, FastifyReply } from 'fastify';
import { reportService } from './service.js';
import { reportQuerySchema, monthlyReportSchema, trendsSchema } from './schemas.js';

export async function getMonthlyReportHandler(
  request: FastifyRequest<{ Querystring: { year: string; month: string } }>,
  reply: FastifyReply
) {
  const { year, month } = monthlyReportSchema.parse(request.query);
  const report = await reportService.getMonthlyReport(request.user.id, Number(year), Number(month));
  return reply.send({ report });
}

export async function getCategoryBreakdownHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { startDate, endDate } = reportQuerySchema.parse(request.query);
  const breakdown = await reportService.getCategoryBreakdown(request.user.id, startDate, endDate);
  return reply.send(breakdown);
}

export async function getTrendsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { months } = trendsSchema.parse(request.query);
  const trends = await reportService.getTrends(request.user.id, Number(months));
  return reply.send(trends);
}

export async function getCashFlowHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { startDate, endDate } = reportQuerySchema.parse(request.query);
  const cashFlow = await reportService.getCashFlow(request.user.id, startDate, endDate);
  return reply.send(cashFlow);
}

export async function getNetWorthHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const netWorth = await reportService.getNetWorth(request.user.id);
  return reply.send(netWorth);
}

export async function exportTransactionsHandler(
  request: FastifyRequest<{ Querystring: { year: string; month: string } }>,
  reply: FastifyReply
) {
  const { year, month } = monthlyReportSchema.parse(request.query);
  const csv = await reportService.exportTransactions(
    request.user.id,
    Number(year),
    Number(month)
  );

  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header(
    'Content-Disposition',
    `attachment; filename="transaksi-${year}-${month}.csv"`
  );
  return reply.send(csv);
}
