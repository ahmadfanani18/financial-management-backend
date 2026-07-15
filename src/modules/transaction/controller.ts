import type { FastifyRequest, FastifyReply } from 'fastify';
import { transactionService } from './service.js';
import { createTransactionSchema, updateTransactionSchema, transactionIdSchema, transactionQuerySchema, importConfirmRequestSchema } from './schemas.js';

export async function getTemplateHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const templateData = await transactionService.getTemplateData(request.user.id);
  
  const categories = templateData.categories.map(c => c.name);
  const accounts = templateData.accounts.map(a => a.name);
  const types = ['income', 'expense', 'transfer'];
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Financial Management';
  workbook.created = new Date();
  
  const sheet = workbook.addWorksheet('Import Transaksi');
   
  const headers = ['date*', 'description*', 'type*', 'category**', 'account**', 'fromAccount', 'toAccount', 'amount*', 'adminFee'];
  const headerDesc = [
    '(YYYY-MM-DD / DD/MM/YYYY)',
    '(text)',
    '(income / expense / transfer)',
    '**(ISI untuk income/expense, KOSONGKAN untuk transfer)',
    '**(ISI untuk income/expense, KOSONGKAN untuk transfer)',
    '(ISI untuk transfer, KOSONGKAN untuk income/expense)',
    '(ISI untuk transfer, KOSONGKAN untuk income/expense)',
    '(angka positif)',
    '(opsional)'
  ];
  
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  
  const descRow = sheet.addRow(headerDesc);
  descRow.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
  descRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
  descRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
   
  headerRow.eachCell((cell, colNumber) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'double' },
      right: { style: 'thin' },
    };
  });
    
  const exampleRow = sheet.addRow(['2026-01-15', 'Contoh Gaji', 'income', categories[0] || 'Gaji', accounts[0] || 'Bank BCA', '-', '-', '15000000', '-']);
  exampleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
   
  const transferRow = sheet.addRow(['15/01/2026', 'Contoh Transfer', 'transfer', '', '', accounts[0] || 'Bank BCA', accounts[1] || 'Bank Mandiri', '5000000', '5000']);
  transferRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
   
   const hiddenStartRow = 100;
  sheet.addRow(['--- REFERENSI (Jangan Diubah) ---']);
  sheet.getCell(`Z${hiddenStartRow}`).font = { bold: true };
  
  const legendRow = hiddenStartRow + 1;
  sheet.getCell(`Z${legendRow}`).value = 'PETUNJUK:';
  sheet.getCell(`Z${legendRow}`).font = { bold: true, size: 10 };
  
  const guideRow1 = hiddenStartRow + 2;
  sheet.getCell(`Z${guideRow1}`).value = '• INCOME/EXPENSE: isi date, description, type, category, account, amount. Kosongkan fromAccount, toAccount, adminFee.';
  sheet.getCell(`Z${guideRow1}`).font = { size: 9 };
  
  const guideRow2 = hiddenStartRow + 3;
  sheet.getCell(`Z${guideRow2}`).value = '• TRANSFER: isi date, description, type, fromAccount, toAccount, amount. Kosongkan category, account, adminFee.';
  sheet.getCell(`Z${guideRow2}`).font = { size: 9 };
  
  const typeStartRow = legendRow + 2;
  types.forEach((t, i) => {
    sheet.getCell(`Z${typeStartRow + i}`).value = t;
  });
  const typeRange = `'Import Transaksi'!$Z$${typeStartRow}:$Z$${typeStartRow + types.length - 1}`;
  
  const categoryStartRow = typeStartRow + types.length + 2;
  sheet.getCell(`Z${categoryStartRow - 1}`).value = 'Categories:';
  categories.forEach((c, i) => {
    sheet.getCell(`Z${categoryStartRow + i}`).value = c;
  });
  const categoryRange = `'Import Transaksi'!$Z$${categoryStartRow}:$Z$${categoryStartRow + categories.length - 1}`;
  
  const accountStartRow = categoryStartRow + categories.length + 2;
  sheet.getCell(`Z${accountStartRow - 1}`).value = 'Accounts:';
  accounts.forEach((a, i) => {
    sheet.getCell(`Z${accountStartRow + i}`).value = a;
  });
  const accountRange = `'Import Transaksi'!$Z$${accountStartRow}:$Z$${accountStartRow + accounts.length - 1}`;
  
  sheet.dataValidations.add(`C2:C1000`, {
    type: 'list',
    allowBlank: true,
    formulae: [typeRange],
    showErrorMessage: true,
    errorTitle: 'Invalid Type',
    error: 'Pilih: income, expense, atau transfer'
  });
  
  sheet.dataValidations.add(`D2:D1000`, {
    type: 'list',
    allowBlank: true,
    formulae: [categoryRange],
    showErrorMessage: true,
    errorTitle: 'Invalid Category',
    error: 'Pilih kategori dari daftar'
  });
  
  sheet.dataValidations.add(`E2:E1000`, {
    type: 'list',
    allowBlank: true,
    formulae: [accountRange],
    showErrorMessage: true,
    errorTitle: 'Invalid Account',
    error: 'Pilih akun dari daftar'
  });
  
  sheet.dataValidations.add(`F2:F1000`, {
    type: 'list',
    allowBlank: true,
    formulae: [accountRange],
    showErrorMessage: true,
    errorTitle: 'Invalid Account',
    error: 'Pilih akun dari daftar'
  });
  
  sheet.dataValidations.add(`G2:G1000`, {
    type: 'list',
    allowBlank: true,
    formulae: [accountRange],
    showErrorMessage: true,
    errorTitle: 'Invalid Account',
    error: 'Pilih akun dari daftar'
  });
  
  headers.forEach((_, colIndex) => {
    const maxLength = Math.max(
      headers[colIndex].length,
      ...([exampleRow.getCell(colIndex + 1).text, transferRow.getCell(colIndex + 1).text].map(t => String(t).length))
    );
    sheet.getColumn(colIndex + 1).width = maxLength + 5;
  });
  
  sheet.getColumn(26).hidden = true;
   
  const buffer = await workbook.xlsx.writeBuffer();
  
  const headersResponse = {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="transaction-template.xlsx"',
  };
  
  return reply.headers(headersResponse).send(Buffer.from(buffer));
}

export async function importPreviewHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const data = await request.file();
  if (!data) {
    return reply.status(400).send({ error: 'File XLSX/CSV wajib diupload' });
  }
  
  const buffer = await data.toBuffer();
  const filename = data.filename.toLowerCase();
  
  let result;
  if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    result = await transactionService.parseAndValidateXlsx(request.user.id, buffer);
  } else {
    const csvContent = buffer.toString('utf-8');
    result = await transactionService.parseAndValidateCsv(request.user.id, csvContent);
  }
  
  return reply.send(result);
}

export async function importConfirmHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { transactions } = importConfirmRequestSchema.parse(request.body);
  const result = await transactionService.importTransactions(request.user.id, transactions);
  return reply.send(result);
}

export async function getTransactionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = transactionQuerySchema.parse(request.query);
  const result = await transactionService.getAll(request.user.id, query);
  return reply.send(result);
}

export async function getTransactionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = transactionIdSchema.parse(request.params);
  const transaction = await transactionService.getById(id, request.user.id);
  return reply.send({ transaction });
}

export async function createTransactionHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const input = createTransactionSchema.parse(request.body);
    const transaction = await transactionService.create(request.user.id, input);
    return reply.status(201).send({ transaction });
  } catch (error) {
    if (error instanceof Error) {
      return reply.status(400).send({ error: error.message });
    }
    return reply.status(500).send({ error: 'Terjadi kesalahan' });
  }
}

export async function updateTransactionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = transactionIdSchema.parse(request.params);
  const input = updateTransactionSchema.parse(request.body);
  const transaction = await transactionService.update(id, request.user.id, input);
  return reply.send({ transaction });
}

export async function deleteTransactionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = transactionIdSchema.parse(request.params);
  await transactionService.delete(id, request.user.id);
  return reply.status(204).send();
}

export async function getRecentTransactionsHandler(
  request: FastifyRequest<{ Querystring: { limit?: string } }>,
  reply: FastifyReply
) {
  const limit = parseInt(request.query.limit || '5', 10);
  const transactions = await transactionService.getRecent(request.user.id, limit);
  return reply.send({ transactions });
}

export async function getSummaryHandler(
  request: FastifyRequest<{ Querystring: { startDate: string; endDate: string } }>,
  reply: FastifyReply
) {
  const startDate = new Date(request.query.startDate);
  const endDate = new Date(request.query.endDate);
  const summary = await transactionService.getSummary(request.user.id, startDate, endDate);
  return reply.send(summary);
}
