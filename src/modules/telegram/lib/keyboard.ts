import type { InlineKeyboardMarkup } from 'node-telegram-bot-api';

interface NotificationSettings {
  budgetAlert: boolean;
  goalProgress: boolean;
  weeklySummary: boolean;
  weeklySummaryDay: number;
  weeklySummaryTime: string;
  billsDue: boolean;
}

export function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '💰 Saldo', callback_data: 'menu:saldo' }],
      [{ text: '📊 Mutasi', callback_data: 'menu:mutasi' }],
      [{ text: '💳 Transaksi', callback_data: 'menu:transaksi' }],
      [{ text: '🎯 Goals', callback_data: 'menu:goals' }],
      [{ text: '📋 Budget', callback_data: 'menu:budget' }],
      [{ text: '📝 Tanya AI', callback_data: 'menu:ask' }],
      [{ text: '📈 Ringkasan Mingguan', callback_data: 'menu:summary' }],
      [{ text: '⚙️ Pengaturan', callback_data: 'menu:settings' }],
    ],
  };
}

export function accountSelectionKeyboard(accounts: Array<{ id: string; name: string }>): InlineKeyboardMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const account of accounts.slice(0, 10)) {
    rows.push([{ text: account.name, callback_data: `account:${account.id}` }]);
  }

  rows.push([{ text: '◀️ Kembali', callback_data: 'menu:back' }]);

  return { inline_keyboard: rows };
}

export function periodSelectionKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: 'Hari Ini', callback_data: 'period:today' }],
      [{ text: 'Minggu Ini', callback_data: 'period:week' }],
      [{ text: 'Bulan Ini', callback_data: 'period:month' }],
      [{ text: 'Bulan Lalu', callback_data: 'period:last_month' }],
      [{ text: '📅 Custom', callback_data: 'period:custom' }],
      [{ text: '◀️ Kembali', callback_data: 'menu:back' }],
    ],
  };
}

export function confirmUnlinkKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '✅ Ya, Putuskan', callback_data: 'unlink:confirm' }],
      [{ text: '❌ Batal', callback_data: 'settings:show' }],
    ],
  };
}

export function yesNoKeyboard(prefix: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Ya', callback_data: `${prefix}:yes` },
        { text: '❌ Tidak', callback_data: `${prefix}:no` },
      ],
    ],
  };
}

export function backToMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '◀️ Kembali ke Menu', callback_data: 'menu:main' }],
    ],
  };
}

export function settingsKeyboard(isLinked: boolean): InlineKeyboardMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  rows.push([{ text: '🔔 Notifikasi', callback_data: 'settings:notifications' }]);

  if (isLinked) {
    rows.push([{ text: '🔗 Putuskan Telegram', callback_data: 'settings:unlink' }]);
  }

  rows.push([{ text: '◀️ Kembali', callback_data: 'menu:main' }]);

  return { inline_keyboard: rows };
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function notificationSettingsKeyboard(settings: NotificationSettings): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: `Budget Alert: ${settings.budgetAlert ? '🔔' : '🔕'}`,
          callback_data: 'notif:budgetAlert',
        },
      ],
      [
        {
          text: `Goal Progress: ${settings.goalProgress ? '🔔' : '🔕'}`,
          callback_data: 'notif:goalProgress',
        },
      ],
      [
        {
          text: `Weekly Summary: ${settings.weeklySummary ? '🔔' : '🔕'}`,
          callback_data: 'notif:weeklySummary',
        },
      ],
      [
        {
          text: `📅 Hari: ${DAYS[settings.weeklySummaryDay] || 'Min'}`,
          callback_data: 'notif:summaryDay',
        },
      ],
      [
        {
          text: `🕐 Waktu: ${settings.weeklySummaryTime || '09:00'}`,
          callback_data: 'notif:summaryTime',
        },
      ],
      [
        {
          text: `Bills Due: ${settings.billsDue ? '🔔' : '🔕'}`,
          callback_data: 'notif:billsDue',
        },
      ],
      [{ text: '◀️ Kembali', callback_data: 'settings:show' }],
    ],
  };
}

export function daySelectionKeyboard(currentDay: number): InlineKeyboardMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  
  for (let i = 0; i < DAYS.length; i += 3) {
    const row: Array<{ text: string; callback_data: string }> = [];
    for (let j = i; j < Math.min(i + 3, DAYS.length); j++) {
      const emoji = j === currentDay ? '✅' : '';
      row.push({
        text: `${emoji} ${DAYS[j]}`,
        callback_data: `notif:day_${j}`,
      });
    }
    rows.push(row);
  }
  
  rows.push([{ text: '◀️ Kembali', callback_data: 'settings:notifications' }]);
  
  return { inline_keyboard: rows };
}

export function timeSelectionKeyboard(currentTime: string): InlineKeyboardMarkup {
  const times = ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '18:00', '20:00'];
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  
  for (let i = 0; i < times.length; i += 4) {
    const row: Array<{ text: string; callback_data: string }> = [];
    for (let j = i; j < Math.min(i + 4, times.length); j++) {
      const emoji = times[j] === currentTime ? '✅' : '';
      row.push({
        text: `${emoji} ${times[j]}`,
        callback_data: `notif:time_${times[j]}`,
      });
    }
    rows.push(row);
  }
  
  rows.push([{ text: '◀️ Kembali', callback_data: 'settings:notifications' }]);
  
  return { inline_keyboard: rows };
}
