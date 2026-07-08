import { billService } from '../modules/bill/service.js';
import { prisma } from '../config/prisma.js';

async function processAutoDeductBills() {
  const today = new Date().getDate();

  const bills = await billService.getBillsForExecution(today);

  for (const bill of bills) {
    const accountBalance = Number(bill.account.balance);
    const billAmount = Number(bill.amount);

    if (accountBalance >= billAmount) {
      const newBalance = (accountBalance - billAmount).toString();

      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            userId: bill.userId,
            accountId: bill.accountId,
            categoryId: bill.categoryId,
            type: 'EXPENSE',
            amount: bill.amount,
            description: `Tagihan: ${bill.name}`,
            date: new Date(),
            billId: bill.id,
          },
        }),
        prisma.account.update({
          where: { id: bill.accountId },
          data: { balance: newBalance },
        }),
        prisma.bill.update({
          where: { id: bill.id },
          data: { lastExecutedAt: new Date() },
        }),
      ]);

      await prisma.notification.create({
        data: {
          userId: bill.userId,
          title: 'Tagihan Berhasil',
          message: `Tagihan ${bill.name} sebesar Rp ${Number(bill.amount).toLocaleString('id-ID')} telah dipotong otomatis.`,
          type: 'BILL_SUCCESS',
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          userId: bill.userId,
          title: 'Tagihan Gagal',
          message: `Tagihan ${bill.name} gagal diproses. Saldo tidak mencukupi.`,
          type: 'BILL_FAILED',
        },
      });
    }
  }
}

async function checkOverdueBills() {
  const today = new Date().getDate();

  const reminderBills = await prisma.bill.findMany({
    where: {
      mode: 'REMINDER_ONLY',
      isActive: true,
      dueDate: today,
    },
  });

  for (const bill of reminderBills) {
    const hasPaid = await prisma.transaction.findFirst({
      where: {
        billId: bill.id,
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        },
      },
    });

    if (!hasPaid) {
      await prisma.notification.create({
        data: {
          userId: bill.userId,
          title: 'Tagihan Jatuh Tempo',
          message: `Tagihan ${bill.name} sudah jatuh tempo hari ini.`,
          type: 'BILL_OVERDUE',
        },
      });
    }
  }
}

async function sendReminderNotifications() {
  const today = new Date().getDate();

  const bills = await prisma.bill.findMany({
    where: { isActive: true },
  });

  for (const bill of bills) {
    const daysUntilDue = bill.dueDate - today;

    if (daysUntilDue === 7 || daysUntilDue === 3 || daysUntilDue === 1) {
      await prisma.notification.create({
        data: {
          userId: bill.userId,
          title: 'Pengingat Tagihan',
          message: `Tagihan ${bill.name} akan jatuh tempo dalam ${daysUntilDue} hari.`,
          type: 'BILL_REMINDER',
        },
      });
    }

    if (daysUntilDue === 7 && bill.amountType === 'VARIABLE') {
      await prisma.notification.create({
        data: {
          userId: bill.userId,
          title: 'Update Tagihan',
          message: `Tagihan ${bill.name} akan jatuh tempo. Jangan lupa update jumlah jika ada perubahan.`,
          type: 'BILL_AMOUNT_UPDATE',
        },
      });
    }
  }
}

export async function processBills() {
  console.log('[Bill Processor] Starting bill processing...');

  try {
    await processAutoDeductBills();
    await checkOverdueBills();
    await sendReminderNotifications();
    console.log('[Bill Processor] Bill processing completed');
  } catch (error) {
    console.error('[Bill Processor] Bill processing failed:', error);
  }
}

let billProcessorInterval: NodeJS.Timeout | null = null;

export function startBillProcessorJob() {
  if (billProcessorInterval) {
    console.log('[Bill Processor] Job already running');
    return;
  }

  processBills();

  billProcessorInterval = setInterval(processBills, 24 * 60 * 60 * 1000);
  console.log('[Bill Processor] Job started, processing daily');
}

export function stopBillProcessorJob() {
  if (billProcessorInterval) {
    clearInterval(billProcessorInterval);
    billProcessorInterval = null;
    console.log('[Bill Processor] Job stopped');
  }
}