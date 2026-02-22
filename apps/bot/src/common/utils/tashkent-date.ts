import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const TASHKENT_TZ = 'Asia/Tashkent';

export function nowTashkent(): dayjs.Dayjs {
  return dayjs().tz(TASHKENT_TZ);
}

export function todayTashkent(): string {
  return nowTashkent().format('YYYY-MM-DD');
}

export function formatDateTime(date: Date | string): string {
  return dayjs(date).tz(TASHKENT_TZ).format('DD.MM.YYYY HH:mm');
}
