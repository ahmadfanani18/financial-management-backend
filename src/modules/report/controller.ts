import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/prisma.js';
import { reportService } from './service.js';
import { reportQuerySchema, monthlyReportSchema, trendsSchema, mutationsQuerySchema } from './schemas.js';
import * as XLSX from 'xlsx';

export async function getMonthlyReportHandler(
  request: FastifyRequest<{ Querystring: { year: string; month: string; accountId?: string } }>,
  reply: FastifyReply
) {
  const { year, month, accountId } = monthlyReportSchema.parse(request.query);
  const report = await reportService.getMonthlyReport(request.user.id, Number(year), Number(month), accountId);
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
  const { months, accountId } = trendsSchema.parse(request.query);
  const trends = await reportService.getTrends(request.user.id, Number(months), accountId);
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

export async function getMutationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = mutationsQuerySchema.parse(request.query);
  const result = await reportService.getMutations(request.user.id, query);
  return reply.send(result);
}

export async function exportMutationsHandler(
  request: FastifyRequest<{ Querystring: { accountId: string; startDate: string; endDate: string } }>,
  reply: FastifyReply
) {
  const query = mutationsQuerySchema.parse(request.query);
  const result = await reportService.getMutationsForExport(request.user.id, query);

  const formatCurrency = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  const wb = XLSX.utils.book_new();

  const headerInfo = [
    ['Akun', result.account.name],
    ['Periode', `${new Date(query.startDate).toLocaleDateString('id-ID')} - ${new Date(query.endDate).toLocaleDateString('id-ID')}`],
  ];

  const headerRow = ['Tanggal', 'Deskripsi', 'Tipe', 'Jumlah', 'Biaya Admin', 'Kategori', 'Tujuan', 'Saldo'];

  const dataRows = result.transactions.map(t => [
    new Date(t.date).toLocaleDateString('id-ID'),
    t.description || '-',
    t.type,
    t.type === 'INCOME' ? `+${formatCurrency(t.amount)}` : `-${formatCurrency(t.amount)}`,
    t.adminFee ? formatCurrency(t.adminFee) : '-',
    t.category?.name || '-',
    t.toAccount?.name || '-',
    formatCurrency(t.runningBalance),
  ]);

  const summaryRows = [
    [],
    ['Ringkasan'],
    ['Total Pemasukan', formatCurrency(result.totalIncome)],
    ['Total Pengeluaran', formatCurrency(result.totalExpense)],
    ['Total Transfer', formatCurrency(result.totalTransfer)],
    ['Saldo Awal', formatCurrency(result.startingBalance)],
    ['Saldo Akhir', formatCurrency(result.endingBalance)],
  ];

  const wsData = [
    ...headerInfo,
    [],
    headerRow,
    ...dataRows,
    ...summaryRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = [
    { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
  ];
  ws['!cols'] = colWidths;

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 0; R <= range.e.r; ++R) {
    for (let C = 0; C <= range.e.c; ++C) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddr]) {
        ws[cellAddr] = { t: 's', v: '', w: '' };
      }
      const cell = ws[cellAddr];

      const isHeader = R === 2;
      const isSummarySection = R >= dataRows.length + 4;

      if (isHeader) {
        cell.s = {
          fill: { fgColor: { rgb: '4472C4' } },
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
          },
        };
      } else if (isSummarySection) {
        cell.s = {
          fill: { fgColor: { rgb: 'E2EFDA' } },
          font: { bold: R === dataRows.length + 4 },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
          },
        };
      } else {
        cell.s = {
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
          },
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Mutasi');

  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', `attachment; filename="mutasi_${result.account.name.replace(/[^a-zA-Z0-9]/g, '_')}_${query.startDate}_${query.endDate}.xlsx"`)
    .send(Buffer.from(xlsxBuffer));
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

export async function getInvestmentSummaryHandler(request: FastifyRequest<{ Querystring: { accountId?: string } }>, reply: FastifyReply) {
  const userId = request.user.id;
  const { accountId } = request.query;

  if (accountId) {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return reply.status(404).send({ error: 'Akun tidak ditemukan' });
  }

  const result = await reportService.getInvestmentSummary(userId, accountId);
  return reply.send(result);
}

export async function getInvestmentPerformanceHandler(request: FastifyRequest<{ Querystring: { months?: number; accountId?: string } }>, reply: FastifyReply) {
  const userId = request.user.id;
  const { months = 6, accountId } = request.query;

  if (accountId) {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return reply.status(404).send({ error: 'Akun tidak ditemukan' });
  }

  const result = await reportService.getInvestmentPerformance(userId, months, accountId);
  return reply.send(result);
}

export async function getInvestmentTransactionsHandler(request: FastifyRequest<{ Querystring: { accountId?: string; startDate?: string; endDate?: string; page?: number; limit?: number } }>, reply: FastifyReply) {
  const userId = request.user.id;
  const { accountId, startDate, endDate, page = 1, limit = 50 } = request.query;

  if (accountId) {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return reply.status(404).send({ error: 'Akun tidak ditemukan' });
  }

  const result = await reportService.getInvestmentTransactions(userId, {
    accountId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    page: Number(page),
    limit: Number(limit),
  });
  return reply.send(result);
}
