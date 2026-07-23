import type { Account, Goal, Budget, Transaction } from '@prisma/client';
import { decrypt } from '../../../utils/encryption.js';

interface AccountWithBalance extends Account {
  balance: string;
}

interface GoalWithProgress {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: Date;
  icon: string;
  color: string;
}

interface BudgetWithUsage {
  id: string;
  categoryName?: string;
  amount: string;
  spent: string;
}

interface TransactionDisplay {
  id: string;
  type: string;
  amount: string;
  description: string;
  date: Date;
  categoryName?: string;
  accountName?: string;
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function decryptBalance(value: string | number): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  if (value.startsWith('$enc$')) {
    try {
      return parseFloat(decrypt(value)) || 0;
    } catch {
      return 0;
    }
  }
  return parseFloat(value) || 0;
}

export function formatAccountBalance(accounts: AccountWithBalance[]): string {
  if (!accounts.length) return 'Tidak ada akun.';

  let total = 0;
  const lines: string[] = [];

  for (const account of accounts) {
    const balance = decryptBalance(account.balance);
    total += balance;
    lines.push(`${account.icon} ${account.name}: ${formatCurrency(balance)}`);
  }

  lines.push('');
  lines.push(`💰 Total: ${formatCurrency(total)}`);

  return lines.join('\n');
}

export function formatGoalProgress(goals: GoalWithProgress[]): string {
  if (!goals.length) return 'Tidak ada goal.';

  const lines: string[] = [];

  for (const goal of goals) {
    const current = decryptBalance(goal.currentAmount);
    const target = decryptBalance(goal.targetAmount);
    const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

    lines.push(`${goal.icon} ${goal.name}`);
    lines.push(`${bar} ${progress.toFixed(1)}%`);
    lines.push(`${formatCurrency(current)} / ${formatCurrency(target)}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function formatBudgetUsage(budgets: BudgetWithUsage[]): string {
  if (!budgets.length) return 'Tidak ada budget.';

  const lines: string[] = [];

  for (const budget of budgets) {
    const spent = decryptBalance(budget.spent);
    const amount = decryptBalance(budget.amount);
    const percentage = amount > 0 ? Math.min((spent / amount) * 100, 100) : 0;
    const remaining = amount - spent;

    const emoji = percentage >= 100 ? '🔴' : percentage >= 80 ? '🟡' : '🟢';

    lines.push(`${emoji} ${budget.categoryName || 'Budget'}`);
    lines.push(`${formatCurrency(spent)} / ${formatCurrency(amount)} (${percentage.toFixed(1)}%)`);
    lines.push(`Sisa: ${formatCurrency(remaining)}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function formatTransactionList(transactions: TransactionDisplay[]): string {
  if (!transactions.length) return 'Tidak ada transaksi.';

  const lines: string[] = [];

  for (const tx of transactions.slice(0, 20)) {
    const typeIcon = tx.type === 'INCOME' ? '📥' : tx.type === 'EXPENSE' ? '📤' : '🔄';
    const dateStr = new Date(tx.date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
    });

    lines.push(`${typeIcon} ${dateStr} | ${formatCurrency(decryptBalance(tx.amount))}`);
    lines.push(`   ${tx.description}`);
    if (tx.categoryName) lines.push(`   📁 ${tx.categoryName}`);
    lines.push('');
  }

  if (transactions.length > 20) {
    lines.push(`...dan ${transactions.length - 20} transaksi lainnya`);
  }

  return lines.join('\n').trim();
}

interface WeeklySummaryData {
  period: string;
  income: string;
  expense: string;
  netChange: string;
  topCategories: Array<{ name: string; amount: string }>;
  accountBalances: Array<{ name: string; balance: string }>;
}

export function formatWeeklySummary(data: WeeklySummaryData): string {
  const income = decryptBalance(data.income);
  const expense = decryptBalance(data.expense);
  const net = decryptBalance(data.netChange);

  let summary = `📊 *Ringkasan ${data.period}*\n\n`;

  summary += `📥 Pemasukan: ${formatCurrency(income)}\n`;
  summary += `📤 Pengeluaran: ${formatCurrency(expense)}\n`;
  summary += `💰 Perubahan Bersih: ${formatCurrency(net)} ${net >= 0 ? '📈' : '📉'}\n`;

  if (data.topCategories.length) {
    summary += '\n🛍️ Top Kategori:\n';
    for (const cat of data.topCategories.slice(0, 3)) {
      summary += `  • ${cat.name}: ${formatCurrency(decryptBalance(cat.amount))}\n`;
    }
  }

  if (data.accountBalances.length) {
    summary += '\n💰 Saldo Akun:\n';
    for (const acc of data.accountBalances) {
      summary += `  • ${acc.name}: ${formatCurrency(decryptBalance(acc.balance))}\n`;
    }
  }

  return summary;
}
