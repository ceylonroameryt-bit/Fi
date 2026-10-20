/** Calendar helpers for VAT periods. Dates are ISO strings (YYYY-MM-DD), no time zones involved. */

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function lastDayOfMonth(year: number, month1: number): number {
  // Day 0 of next month = last day of this month (UTC avoids DST edge cases).
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** The 3-month period that contains `year-month1` (month1 = 1..12), starting on `startMonth1`. */
function quarterContaining(year: number, month1: number, startMonth1: number): { y: number; m: number } {
  const offset = (((month1 - startMonth1) % 3) + 3) % 3;
  let m = month1 - offset;
  let y = year;
  if (m < 1) {
    m += 12;
    y -= 1;
  }
  return { y, m };
}

export function quarterRange(startYear: number, startMonth1: number): DateRange {
  let endMonth = startMonth1 + 2;
  let endYear = startYear;
  if (endMonth > 12) {
    endMonth -= 12;
    endYear += 1;
  }
  const from = `${startYear}-${pad(startMonth1)}-01`;
  const to = `${endYear}-${pad(endMonth)}-${pad(lastDayOfMonth(endYear, endMonth))}`;
  const label = `${MONTHS[startMonth1 - 1]} ${startYear !== endYear ? startYear + ' ' : ''}– ${MONTHS[endMonth - 1]} ${endYear}`;
  return { from, to, label };
}

/**
 * The most recent `count` VAT quarters ending on or before `today`'s quarter.
 * `staggerStartMonth` is the first month of any VAT quarter (1, 2 or 3 for HMRC's three staggers).
 */
export function recentQuarters(today: string, count = 6, staggerStartMonth = 1): DateRange[] {
  const [y, m] = today.split('-').map(Number);
  let { y: qy, m: qm } = quarterContaining(y, m, staggerStartMonth);
  const out: DateRange[] = [];
  for (let i = 0; i < count; i++) {
    out.push(quarterRange(qy, qm));
    qm -= 3;
    if (qm < 1) {
      qm += 12;
      qy -= 1;
    }
  }
  return out;
}

/** VAT returns are due one calendar month and seven days after the period ends. */
export function vatDueDate(periodEnd: string): string {
  const [y, m] = periodEnd.split('-').map(Number);
  let dm = m + 1;
  let dy = y;
  if (dm > 12) {
    dm = 1;
    dy += 1;
  }
  const last = lastDayOfMonth(dy, dm);
  const d = new Date(Date.UTC(dy, dm - 1, last));
  d.setUTCDate(d.getUTCDate() + 7);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
