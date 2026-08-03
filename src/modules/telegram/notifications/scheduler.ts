import { prisma } from '../../../config/prisma.js';
import { getBot } from '../index.js';
import { sendBudgetAlert } from './budget-alert.js';
import { sendGoalProgress } from './goal-progress.js';
import { sendWeeklySummary } from './weekly-summary.js';
import { sendBillsDueReminder } from './bills-due.js';

interface NotificationPrefs {
  budgetAlert: boolean;
  goalProgress: boolean;
  weeklySummary: boolean;
  weeklySummaryDay: number;
  weeklySummaryTime: string;
  billsDue: boolean;
}

export function startNotificationScheduler(): void {
  console.log('[Notification] Scheduler starting...');
  
  // Run immediately for testing
  runNotificationCheck();
  
  // Check every 5 minutes
  setInterval(async () => {
    await runNotificationCheck();
  }, 5 * 60 * 1000);
}

async function runNotificationCheck(): Promise<void> {
  const bot = getBot();
  if (!bot) {
    console.log('[Notification] Bot not ready');
    return;
  }

  const settings = await prisma.telegramSettings.findMany({
    where: { isLinked: true, telegramChatId: { not: null } },
  });

  console.log(`[Notification] Checking ${settings.length} users at ${new Date().toISOString()}`);

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  for (const setting of settings) {
    const prefs = setting.notifications as unknown as NotificationPrefs;
    const chatId = setting.telegramChatId;
    if (!chatId) continue;

    const userId = setting.userId;
    console.log(`[Notification] User ${userId}: day=${currentDay} hour=${currentHour}, configured: day=${prefs.weeklySummaryDay} time=${prefs.weeklySummaryTime}`);

    if (prefs.budgetAlert) {
      await sendBudgetAlert(bot, chatId, userId);
    }

    if (prefs.goalProgress) {
      await sendGoalProgress(bot, chatId, userId);
    }

    if (prefs.billsDue) {
      const lastSent = setting.lastBillReminderSent;
      const canSend = !lastSent || (now.getTime() - lastSent.getTime() >= 24 * 60 * 60 * 1000);

      if (canSend) {
        await sendBillsDueReminder(bot, chatId, userId);
        await prisma.telegramSettings.update({
          where: { id: setting.id },
          data: { lastBillReminderSent: now },
        });
      }
    }

    if (prefs.weeklySummary) {
      const [summaryHour, summaryMinute] = prefs.weeklySummaryTime.split(':').map(Number);
      // Check if configured time has passed in current hour
      const timeHasPassed = currentHour > summaryHour || 
        (currentHour === summaryHour && now.getMinutes() >= summaryMinute);
      
      // Check if we already sent this week
      const lastSent = setting.lastWeeklySummarySent;
      const alreadySentThisWeek = lastSent && 
        lastSent.getDay() === currentDay && 
        lastSent.getHours() >= summaryHour;
      
      console.log(`[Notification] Weekly summary: day match=${currentDay === prefs.weeklySummaryDay}, time passed=${timeHasPassed}, alreadySent=${alreadySentThisWeek}`);
      
      if (currentDay === prefs.weeklySummaryDay && timeHasPassed && !alreadySentThisWeek) {
        await sendWeeklySummary(bot, chatId, userId);
        // Update last sent
        await prisma.telegramSettings.update({
          where: { id: setting.id },
          data: { lastWeeklySummarySent: now },
        });
      }
    }
  }
}
