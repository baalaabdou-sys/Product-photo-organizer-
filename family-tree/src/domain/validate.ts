import { FamilyGraph, isDeceased } from './graph';
import type { FamilyData, ID } from './types';
import { year, sortKey, formatDate } from './dates';
import { fullName } from './relationships';

export type IssueSeverity = 'error' | 'warning' | 'note';

export interface DataIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  personIds: ID[];
}

const MIN_PARENT_AGE = 12;
const MAX_PARENT_AGE = 75;
const MAX_LIFESPAN = 122;

/**
 * Non-destructive integrity review. Genealogy data is messy by nature, so
 * everything here is surfaced as a warning — nothing is ever auto-corrected.
 */
export function reviewFamily(data: FamilyData): DataIssue[] {
  const g = new FamilyGraph(data);
  const issues: DataIssue[] = [];
  const add = (i: DataIssue) => issues.push(i);

  // 1. Circular ancestry — someone is their own ancestor.
  for (const p of g.people.values()) {
    if (g.ancestors(p.id).has(p.id)) {
      add({
        id: `cycle:${p.id}`,
        severity: 'error',
        title: 'Circular ancestry',
        detail: `${fullName(p)} appears in their own line of ancestors. One of the parent links must be wrong.`,
        personIds: [p.id],
      });
    }
  }

  // 2. Dates that cannot be true.
  for (const p of g.people.values()) {
    const b = year(p.birthDate), d = year(p.deathDate);
    if (b !== null && d !== null) {
      if (d < b) {
        add({
          id: `death-before-birth:${p.id}`, severity: 'error',
          title: 'Died before being born',
          detail: `${fullName(p)} is recorded as dying in ${d}, before the birth year ${b}.`,
          personIds: [p.id],
        });
      } else if (d - b > MAX_LIFESPAN) {
        add({
          id: `lifespan:${p.id}`, severity: 'warning',
          title: 'Improbable lifespan',
          detail: `${fullName(p)} would have lived ${d - b} years.`,
          personIds: [p.id],
        });
      }
    }
    const burial = year(p.burialDate);
    if (burial !== null && d !== null && burial < d) {
      add({
        id: `burial:${p.id}`, severity: 'warning',
        title: 'Buried before death',
        detail: `${fullName(p)}'s burial (${burial}) is recorded before the death date (${d}).`,
        personIds: [p.id],
      });
    }
    if (b !== null && b > new Date().getFullYear()) {
      add({
        id: `future-birth:${p.id}`, severity: 'warning',
        title: 'Birth date in the future',
        detail: `${fullName(p)} is recorded as born in ${b}.`,
        personIds: [p.id],
      });
    }
  }

  // 3. Parent/child age plausibility.
  for (const pc of data.parentage) {
    const parent = g.person(pc.parentId), child = g.person(pc.childId);
    if (!parent || !child) continue;
    const pb = year(parent.birthDate), cb = year(child.birthDate);
    if (pb === null || cb === null) continue;
    const gap = cb - pb;
    if (gap < 0) {
      add({
        id: `child-older:${pc.id}`, severity: 'error',
        title: 'Child born before parent',
        detail: `${fullName(child)} (${cb}) is recorded as born before ${fullName(parent)} (${pb}).`,
        personIds: [parent.id, child.id],
      });
    } else if (gap < MIN_PARENT_AGE) {
      add({
        id: `young-parent:${pc.id}`, severity: 'warning',
        title: 'Implausibly young parent',
        detail: `${fullName(parent)} would have been ${gap} when ${fullName(child)} was born.`,
        personIds: [parent.id, child.id],
      });
    } else if (gap > MAX_PARENT_AGE && pc.type === 'biological') {
      add({
        id: `old-parent:${pc.id}`, severity: 'warning',
        title: 'Unusually late birth',
        detail: `${fullName(parent)} would have been ${gap} when ${fullName(child)} was born.`,
        personIds: [parent.id, child.id],
      });
    }
    const pd = year(parent.deathDate);
    if (pd !== null && cb - pd > 1) {
      add({
        id: `posthumous:${pc.id}`, severity: 'warning',
        title: 'Born after a parent died',
        detail: `${fullName(child)} was born in ${cb}, ${cb - pd} years after ${fullName(parent)} died.`,
        personIds: [parent.id, child.id],
      });
    }
  }

  // 4. More than two recorded parents.
  for (const p of g.people.values()) {
    const parents = g.parents(p.id);
    const biological = g.parentLinks(p.id).filter((l) => l.type === 'biological');
    if (biological.length > 2) {
      add({
        id: `many-parents:${p.id}`, severity: 'warning',
        title: 'More than two biological parents',
        detail: `${fullName(p)} has ${biological.length} biological parents recorded: ${parents.map(fullName).join(', ')}.`,
        personIds: [p.id, ...parents.map((x) => x.id)],
      });
    }
  }

  // 5. Marriage timing.
  for (const u of g.unions.values()) {
    const a = g.person(u.personA), b = g.person(u.personB);
    if (!a || !b) continue;
    const m = year(u.startDate);
    if (m === null) continue;
    for (const person of [a, b]) {
      const pb = year(person.birthDate);
      const pdy = year(person.deathDate);
      if (pb !== null && m - pb < MIN_PARENT_AGE) {
        add({
          id: `early-marriage:${u.id}:${person.id}`, severity: 'warning',
          title: 'Marriage before adulthood',
          detail: `${fullName(person)} would have been ${m - pb} at the time of this marriage (${m}).`,
          personIds: [a.id, b.id],
        });
      }
      if (pdy !== null && m > pdy) {
        add({
          id: `posthumous-marriage:${u.id}:${person.id}`, severity: 'error',
          title: 'Marriage recorded after death',
          detail: `${fullName(person)} died in ${pdy} but the marriage is dated ${m}.`,
          personIds: [a.id, b.id],
        });
      }
    }
    if (u.endDate && sortKey(u.endDate) < sortKey(u.startDate)) {
      add({
        id: `union-dates:${u.id}`, severity: 'warning',
        title: 'Union ends before it begins',
        detail: `Recorded ${formatDate(u.startDate)} – ${formatDate(u.endDate)}.`,
        personIds: [a.id, b.id],
      });
    }
    if (u.personA === u.personB) {
      add({
        id: `self-union:${u.id}`, severity: 'error',
        title: 'Person partnered with themselves',
        detail: `${fullName(a)} is recorded as their own partner.`,
        personIds: [a.id],
      });
    }
  }

  // 6. Likely duplicates.
  for (const dup of findDuplicates(data)) {
    add({
      id: `duplicate:${dup.a}:${dup.b}`, severity: 'warning',
      title: 'Possible duplicate record',
      detail: `${dup.reason} — they may be the same person recorded twice.`,
      personIds: [dup.a, dup.b],
    });
  }

  // 7. Disconnected people.
  if (g.componentCount > 1) {
    const stranded = [...g.people.values()].filter((p) => g.component(p.id) !== 0);
    const loners = stranded.filter((p) => g.neighbours(p.id).length === 0);
    if (loners.length) {
      add({
        id: 'disconnected', severity: 'note',
        title: `${loners.length} ${loners.length === 1 ? 'person is' : 'people are'} not connected to anyone`,
        detail: loners.slice(0, 8).map(fullName).join(', ') + (loners.length > 8 ? '…' : ''),
        personIds: loners.map((p) => p.id),
      });
    }
    const groups = g.componentCount - 1;
    if (groups > 0 && stranded.length > loners.length) {
      add({
        id: 'components', severity: 'note',
        title: `The archive holds ${g.componentCount} separate family groups`,
        detail: 'These groups have no recorded link to the main family. That may be correct, or a missing parent or marriage.',
        personIds: [],
      });
    }
  }

  // 8. A living person older than any plausible age.
  for (const p of g.people.values()) {
    const b = year(p.birthDate);
    if (b !== null && !isDeceased(p) && new Date().getFullYear() - b > 110) {
      add({
        id: `very-old:${p.id}`, severity: 'note',
        title: 'Recorded as living at an extreme age',
        detail: `${fullName(p)} was born in ${b} and has no death date recorded.`,
        personIds: [p.id],
      });
    }
  }

  const rank: Record<IssueSeverity, number> = { error: 0, warning: 1, note: 2 };
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export interface DuplicateCandidate { a: ID; b: ID; reason: string; score: number }

/** Name + date heuristics. Conservative on purpose — it only suggests. */
export function findDuplicates(data: FamilyData): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

  const buckets = new Map<string, typeof data.people>();
  for (const p of data.people) {
    const key = norm(p.firstName).slice(0, 4) + '|' + norm(p.lastName).slice(0, 4);
    const arr = buckets.get(key) ?? [];
    arr.push(p);
    buckets.set(key, arr);
  }

  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        const sameName = norm(a.firstName) === norm(b.firstName) && norm(a.lastName) === norm(b.lastName);
        if (!sameName) continue;
        const ay = year(a.birthDate), by = year(b.birthDate);
        let score = 0.6;
        let reason = `Two records named ${a.firstName} ${a.lastName}`;
        if (ay !== null && by !== null) {
          if (ay === by) { score = 0.95; reason += ` both born in ${ay}`; }
          else if (Math.abs(ay - by) <= 2) { score = 0.75; reason += ` born ${ay} and ${by}`; }
          else continue; // Different birth years → different people.
        }
        out.push({ a: a.id, b: b.id, reason, score });
      }
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
