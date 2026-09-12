import type { FuzzyDate } from './types';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const fd = (value: string, qualifier?: FuzzyDate['qualifier']): FuzzyDate =>
  qualifier ? { value, qualifier } : { value };

/** Year as a number, or null when unknown. */
export function year(d?: FuzzyDate | null): number | null {
  if (!d?.value) return null;
  const m = /^(-?\d{3,4})/.exec(d.value.trim());
  return m ? Number(m[1]) : null;
}

export function month(d?: FuzzyDate | null): number | null {
  if (!d?.value) return null;
  const m = /^-?\d{3,4}-(\d{2})/.exec(d.value);
  return m ? Number(m[1]) : null;
}

export function day(d?: FuzzyDate | null): number | null {
  if (!d?.value) return null;
  const m = /^-?\d{3,4}-\d{2}-(\d{2})/.exec(d.value);
  return m ? Number(m[1]) : null;
}

export function precision(d?: FuzzyDate | null): 'none' | 'year' | 'month' | 'day' {
  if (!d?.value) return 'none';
  if (day(d)) return 'day';
  if (month(d)) return 'month';
  if (year(d) !== null) return 'year';
  return 'none';
}

/** Sortable numeric key; unknown dates sort last. */
export function sortKey(d?: FuzzyDate | null): number {
  const y = year(d);
  if (y === null) return Number.POSITIVE_INFINITY;
  return y * 10000 + (month(d) ?? 0) * 100 + (day(d) ?? 0);
}

/** "17 March 1948" · "March 1948" · "about 1948" */
export function formatDate(d?: FuzzyDate | null, opts: { short?: boolean } = {}): string {
  if (!d?.value) return '';
  const y = year(d);
  if (y === null) return d.original ?? d.value;
  const mo = month(d);
  const dy = day(d);
  let out: string;
  if (dy && mo) out = opts.short ? `${dy}/${mo}/${y}` : `${dy} ${MONTH_NAMES[mo - 1]} ${y}`;
  else if (mo) out = opts.short ? `${mo}/${y}` : `${MONTH_NAMES[mo - 1]} ${y}`;
  else out = String(y);
  if (d.qualifier === 'about' || d.qualifier === 'estimated') out = `about ${out}`;
  if (d.qualifier === 'before') out = `before ${out}`;
  if (d.qualifier === 'after') out = `after ${out}`;
  return out;
}

/** "1948 — 2021" · "b. 1948" · "" */
export function lifespan(birth?: FuzzyDate, death?: FuzzyDate): string {
  const b = year(birth);
  const d = year(death);
  if (b && d) return `${b} — ${d}`;
  if (b) return `${b} —`;
  if (d) return `— ${d}`;
  return '';
}

/** Age at death, or current age. Null when it cannot be computed. */
export function ageOf(birth?: FuzzyDate, death?: FuzzyDate, now = new Date()): number | null {
  const b = year(birth);
  if (b === null) return null;
  const end = death ? year(death) : now.getFullYear();
  if (end === null) return null;
  let age = end - b;
  const bm = month(birth), bd = day(birth);
  if (!death && bm) {
    const nm = now.getMonth() + 1, nd = now.getDate();
    if (nm < bm || (nm === bm && bd && nd < bd)) age -= 1;
  }
  if (age < 0 || age > 130) return null;
  return age;
}

/** Day-of-year distance forward from today; null when no day/month known. */
export function daysUntilAnniversary(d?: FuzzyDate, now = new Date()): number | null {
  const mo = month(d), dy = day(d);
  if (!mo || !dy) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), mo - 1, dy);
  if (next < today) next = new Date(now.getFullYear() + 1, mo - 1, dy);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export function isSameCalendarDay(d: FuzzyDate | undefined, now = new Date()): boolean {
  return month(d) === now.getMonth() + 1 && day(d) === now.getDate();
}

/** "in 3 days" · "today" · "tomorrow" */
export function relativeDays(n: number): string {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return `In ${n} days`;
  if (n < 14) return 'Next week';
  if (n < 60) return `In ${Math.round(n / 7)} weeks`;
  return `In ${Math.round(n / 30)} months`;
}

/** GEDCOM date → FuzzyDate. Handles ABT/EST/BEF/AFT/BET and "17 MAR 1948". */
export function parseGedcomDate(raw: string): FuzzyDate | undefined {
  const original = raw.trim();
  if (!original) return undefined;
  let s = original.toUpperCase();
  let qualifier: FuzzyDate['qualifier'] | undefined;

  if (/^ABT\b/.test(s)) { qualifier = 'about'; s = s.replace(/^ABT\b/, ''); }
  else if (/^(EST|CAL)\b/.test(s)) { qualifier = 'estimated'; s = s.replace(/^(EST|CAL)\b/, ''); }
  else if (/^BEF\b/.test(s)) { qualifier = 'before'; s = s.replace(/^BEF\b/, ''); }
  else if (/^AFT\b/.test(s)) { qualifier = 'after'; s = s.replace(/^AFT\b/, ''); }
  else if (/^BET\b/.test(s)) { qualifier = 'about'; s = s.replace(/^BET\b/, '').split(/\bAND\b/)[0]; }
  else if (/^FROM\b/.test(s)) { qualifier = 'about'; s = s.replace(/^FROM\b/, '').split(/\bTO\b/)[0]; }

  s = s.trim();
  const dmy = /^(\d{1,2})\s+([A-Z]{3})\s+(-?\d{3,4})$/.exec(s);
  if (dmy) {
    const mi = MONTHS.indexOf(dmy[2]);
    if (mi >= 0) return { value: `${pad4(dmy[3])}-${pad2(mi + 1)}-${pad2(Number(dmy[1]))}`, qualifier, original };
  }
  const my = /^([A-Z]{3})\s+(-?\d{3,4})$/.exec(s);
  if (my) {
    const mi = MONTHS.indexOf(my[1]);
    if (mi >= 0) return { value: `${pad4(my[2])}-${pad2(mi + 1)}`, qualifier, original };
  }
  const iso = /^(-?\d{3,4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  if (iso) return { value: original, qualifier, original };
  const yonly = /(-?\d{3,4})/.exec(s);
  if (yonly) return { value: pad4(yonly[1]), qualifier, original };
  return { value: '', original };
}

/** FuzzyDate → GEDCOM date string. */
export function toGedcomDate(d?: FuzzyDate): string {
  if (!d?.value) return d?.original ?? '';
  const y = year(d), mo = month(d), dy = day(d);
  if (y === null) return d.original ?? '';
  let core = String(y);
  if (mo) core = `${MONTHS[mo - 1]} ${y}`;
  if (mo && dy) core = `${dy} ${MONTHS[mo - 1]} ${y}`;
  const q = d.qualifier === 'about' ? 'ABT ' : d.qualifier === 'estimated' ? 'EST '
    : d.qualifier === 'before' ? 'BEF ' : d.qualifier === 'after' ? 'AFT ' : '';
  return q + core;
}

const pad2 = (n: number | string) => String(n).padStart(2, '0');
const pad4 = (n: number | string) => {
  const s = String(n);
  return s.startsWith('-') ? s : s.padStart(4, '0');
};

/** The decade label a date falls in, e.g. "1950s". */
export function decadeOf(d?: FuzzyDate): string | null {
  const y = year(d);
  return y === null ? null : `${Math.floor(y / 10) * 10}s`;
}
