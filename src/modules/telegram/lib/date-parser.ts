import {
  parseISO,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  isValid,
  format,
  addDays,
} from 'date-fns';
import { id } from 'date-fns/locale';

export interface DateRange {
  start: Date;
  end: Date;
}

const indonesianDateMap: Record<string, () => DateRange> = {
  kemarin: () => {
    const yesterday = addDays(new Date(), -1);
    return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
  },
  'hari ini': () => {
    const today = new Date();
    return { start: startOfDay(today), end: endOfDay(today) };
  },
  'minggu ini': () => {
    const today = new Date();
    return { start: startOfWeek(today, { locale: id }), end: endOfWeek(today, { locale: id }) };
  },
  'bulan ini': () => {
    const today = new Date();
    return { start: startOfMonth(today), end: endOfMonth(today) };
  },
  'bulan lalu': () => {
    const today = subMonths(new Date(), 1);
    return { start: startOfMonth(today), end: endOfMonth(today) };
  },
};

const monthYearRegex = /^(\w+)\s+(\d{4})$/i;

export function parseDate(input: string): DateRange | null {
  const normalized = input.toLowerCase().trim();

  if (indonesianDateMap[normalized]) {
    return indonesianDateMap[normalized]();
  }

  const monthYearMatch = normalized.match(monthYearRegex);
  if (monthYearMatch) {
    const monthName = monthYearMatch[1];
    const year = parseInt(monthYearMatch[2], 10);
    const monthIndex = getMonthIndex(monthName);
    if (monthIndex !== -1) {
      const date = new Date(year, monthIndex, 1);
      return { start: startOfMonth(date), end: endOfMonth(date) };
    }
  }

  const rangeMatch = normalized.match(/(.+)\s*(?:sampai|-)\s*(.+)/);
  if (rangeMatch) {
    const startDate = parseSingleDate(rangeMatch[1].trim());
    const endDate = parseSingleDate(rangeMatch[2].trim());
    if (startDate && endDate) {
      return { start: startOfDay(startDate), end: endOfDay(endDate) };
    }
  }

  const singleDate = parseSingleDate(normalized);
  if (singleDate && isValid(singleDate)) {
    return { start: startOfDay(singleDate), end: endOfDay(singleDate) };
  }

  return null;
}

function parseSingleDate(input: string): Date | null {
  const isoDate = parseISO(input);
  if (isValid(isoDate)) {
    return isoDate;
  }

  const parts = input.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [day, month, year] = parts.map(p => parseInt(p, 10));
    if (month >= 1 && month <= 12) {
      const date = new Date(year > 100 ? year : 2000 + year, month - 1, day);
      if (isValid(date)) return date;
    }
    const date2 = new Date(day > 100 ? day : 2000 + day, month - 1, year);
    if (isValid(date2)) return date2;
  }

  return null;
}

function getMonthIndex(monthName: string): number {
  const months = [
    'januari', 'februari', 'maret', 'april', 'mei', 'juni',
    'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const index = months.indexOf(monthName.toLowerCase());
  return index !== -1 ? index % 12 : -1;
}

export function formatDateRange(range: DateRange): string {
  const formatOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const startStr = format(range.start, 'd MMMM yyyy', { locale: id });
  const endStr = format(range.end, 'd MMMM yyyy', { locale: id });
  if (startStr === endStr) return startStr;
  return `${startStr} - ${endStr}`;
}
