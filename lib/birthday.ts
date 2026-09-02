export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const NON_SECRETARY_TYPE = 'Nhân viên Tiếp nhận và đăng ký khám bệnh';

export function todayInAppTimeZone(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
}

export function birthdayInYear(dateOfBirth: Date, year: number) {
  return new Date(Date.UTC(year, dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate()));
}

export function nextBirthday(dateOfBirth: Date, today: Date) {
  const thisYear = birthdayInYear(dateOfBirth, today.getUTCFullYear());
  return thisYear < today ? birthdayInYear(dateOfBirth, today.getUTCFullYear() + 1) : thisYear;
}

export function sameUtcDate(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}
