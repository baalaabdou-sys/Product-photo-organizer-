import type { FamilyGraph } from './graph';
import { isDeceased } from './graph';
import type { FamilyData, ID, Person } from './types';
import { year, daysUntilAnniversary, isSameCalendarDay, formatDate, ageOf } from './dates';
import { firstName, fullName } from './relationships';

export interface FamilyStats {
  people: number;
  generations: number;
  living: number;
  remembered: number;
  surnames: string[];
  places: number;
  stories: number;
  photographs: number;
  earliestYear: number | null;
  latestYear: number | null;
  oldestAncestor: Person | undefined;
}

/** Everything on the home page is computed from the data — nothing is invented. */
export function familyStats(g: FamilyGraph, data: FamilyData): FamilyStats {
  const people = [...g.people.values()];
  const years = people
    .flatMap((p) => [year(p.birthDate), year(p.deathDate)])
    .filter((y): y is number => y !== null);

  const surnames = new Map<string, number>();
  for (const p of people) {
    if (!p.lastName) continue;
    surnames.set(p.lastName, (surnames.get(p.lastName) ?? 0) + 1);
  }

  const placeNames = new Set<string>();
  for (const p of people) {
    for (const pl of [p.birthPlace, p.deathPlace, p.burialPlace]) {
      if (pl?.name) placeNames.add(pl.name);
    }
  }
  for (const pl of data.places) placeNames.add(pl.name);

  return {
    people: people.length,
    generations: g.generations,
    living: people.filter((p) => !isDeceased(p)).length,
    remembered: people.filter(isDeceased).length,
    surnames: [...surnames.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s),
    places: placeNames.size,
    stories: data.stories.length,
    photographs: data.media.filter((m) => m.kind === 'photo').length,
    earliestYear: years.length ? Math.min(...years) : null,
    latestYear: years.length ? Math.max(...years) : null,
    oldestAncestor: g.oldestKnown(),
  };
}

export interface DayNote {
  id: string;
  personIds: ID[];
  headline: string;
  detail: string;
  kind: 'birthday' | 'anniversary' | 'memorial' | 'onThisDay';
}

/** "Today in our family" — real anniversaries only, never filler. */
export function todayNotes(g: FamilyGraph, data: FamilyData, now = new Date()): DayNote[] {
  const out: DayNote[] = [];
  const y = now.getFullYear();

  for (const p of g.people.values()) {
    if (isSameCalendarDay(p.birthDate, now)) {
      const by = year(p.birthDate);
      if (isDeceased(p)) {
        out.push({
          id: `b:${p.id}`, personIds: [p.id], kind: 'onThisDay',
          headline: `${firstName(p)} was born on this day`,
          detail: by ? `In ${by}${p.birthPlace ? `, in ${p.birthPlace.name}` : ''}.` : '',
        });
      } else {
        const age = ageOf(p.birthDate, undefined, now);
        out.push({
          id: `b:${p.id}`, personIds: [p.id], kind: 'birthday',
          headline: `${firstName(p)}'s birthday`,
          detail: age !== null ? `${age} today.` : 'Today.',
        });
      }
    }
    if (isSameCalendarDay(p.deathDate, now)) {
      const dy = year(p.deathDate);
      out.push({
        id: `d:${p.id}`, personIds: [p.id], kind: 'memorial',
        headline: `Remembering ${firstName(p)}`,
        detail: dy ? `${y - dy} years ago today.` : '',
      });
    }
  }

  for (const u of g.unions.values()) {
    if (!isSameCalendarDay(u.startDate, now)) continue;
    const a = g.person(u.personA), b = g.person(u.personB);
    if (!a || !b) continue;
    const my = year(u.startDate);
    out.push({
      id: `m:${u.id}`, personIds: [a.id, b.id], kind: 'anniversary',
      headline: `${firstName(a)} and ${firstName(b)} married`,
      detail: my ? `${y - my} years ago today${u.place ? `, in ${u.place.name}` : ''}.` : '',
    });
  }

  for (const e of data.events) {
    if (!isSameCalendarDay(e.date, now)) continue;
    const ey = year(e.date);
    out.push({
      id: `e:${e.id}`, personIds: e.personIds, kind: 'onThisDay',
      headline: e.title,
      detail: ey ? `On this day in ${ey}.` : '',
    });
  }

  return out;
}

export interface UpcomingItem {
  id: string;
  personIds: ID[];
  days: number;
  label: string;
  detail: string;
  kind: 'birthday' | 'anniversary' | 'memorial';
}

export function upcoming(g: FamilyGraph, withinDays = 90, limit = 8): UpcomingItem[] {
  const out: UpcomingItem[] = [];

  for (const p of g.people.values()) {
    if (isDeceased(p)) {
      const d = daysUntilAnniversary(p.deathDate);
      if (d !== null && d > 0 && d <= withinDays) {
        out.push({
          id: `m:${p.id}`, personIds: [p.id], days: d, kind: 'memorial',
          label: `Remembering ${firstName(p)}`,
          detail: formatDate(p.deathDate),
        });
      }
      continue;
    }
    const d = daysUntilAnniversary(p.birthDate);
    if (d !== null && d >= 0 && d <= withinDays) {
      const nextAge = (ageOf(p.birthDate) ?? 0) + (d === 0 ? 0 : 1);
      out.push({
        id: `b:${p.id}`, personIds: [p.id], days: d, kind: 'birthday',
        label: `${firstName(p)} ${p.lastName}`.trim(),
        detail: nextAge > 0 ? `Turns ${nextAge}` : 'Birthday',
      });
    }
  }

  for (const u of g.unions.values()) {
    if (u.type === 'divorced') continue;
    const d = daysUntilAnniversary(u.startDate);
    if (d === null || d < 0 || d > withinDays) continue;
    const a = g.person(u.personA), b = g.person(u.personB);
    if (!a || !b || isDeceased(a) || isDeceased(b)) continue;
    const my = year(u.startDate);
    out.push({
      id: `a:${u.id}`, personIds: [a.id, b.id], days: d, kind: 'anniversary',
      label: `${firstName(a)} and ${firstName(b)}`,
      detail: my ? `${new Date().getFullYear() - my} years married` : 'Anniversary',
    });
  }

  return out.sort((x, y2) => x.days - y2.days).slice(0, limit);
}

/** A relative worth meeting — favours people with something recorded about them. */
export function discoverPerson(g: FamilyGraph, data: FamilyData, exclude?: ID | null): Person | undefined {
  const people = [...g.people.values()].filter((p) => p.id !== exclude);
  if (!people.length) return undefined;
  const scored = people.map((p) => {
    let score = 1;
    if (p.biography) score += 4;
    if (p.profession) score += 2;
    if (p.birthPlace) score += 1;
    if (data.stories.some((s) => s.personIds.includes(p.id))) score += 5;
    if (isDeceased(p)) score += 2;
    return { p, score };
  });
  const total = scored.reduce((n, s) => n + s.score, 0);
  let r = Math.random() * total;
  for (const s of scored) {
    r -= s.score;
    if (r <= 0) return s.p;
  }
  return scored[scored.length - 1].p;
}

/** Every dated moment in the family, ready for the timeline. */
export interface TimelineEntry {
  id: string;
  sortYear: number;
  date: string;
  dateLabel: string;
  title: string;
  detail?: string;
  personIds: ID[];
  kind: 'birth' | 'death' | 'marriage' | 'event';
  mediaId?: ID;
}

export function buildTimeline(g: FamilyGraph, data: FamilyData): TimelineEntry[] {
  const out: TimelineEntry[] = [];

  for (const p of g.people.values()) {
    const by = year(p.birthDate);
    if (by !== null) {
      out.push({
        id: `tb:${p.id}`, sortYear: by, date: p.birthDate!.value,
        dateLabel: formatDate(p.birthDate),
        title: `${fullName(p)} was born`,
        detail: p.birthPlace?.name ? `In ${p.birthPlace.name}.` : undefined,
        personIds: [p.id], kind: 'birth', mediaId: p.photoId,
      });
    }
    const dy = year(p.deathDate);
    if (dy !== null) {
      const age = ageOf(p.birthDate, p.deathDate);
      out.push({
        id: `td:${p.id}`, sortYear: dy, date: p.deathDate!.value,
        dateLabel: formatDate(p.deathDate),
        title: `${fullName(p)} died`,
        detail: [p.deathPlace?.name ? `In ${p.deathPlace.name}` : null, age !== null ? `Aged ${age}` : null]
          .filter(Boolean).join(' · ') || undefined,
        personIds: [p.id], kind: 'death',
      });
    }
  }

  for (const u of g.unions.values()) {
    const my = year(u.startDate);
    if (my === null) continue;
    const a = g.person(u.personA), b = g.person(u.personB);
    if (!a || !b) continue;
    out.push({
      id: `tm:${u.id}`, sortYear: my, date: u.startDate!.value,
      dateLabel: formatDate(u.startDate),
      title: `${firstName(a)} married ${firstName(b)}`,
      detail: u.place?.name ? `In ${u.place.name}.` : undefined,
      personIds: [a.id, b.id], kind: 'marriage',
    });
  }

  for (const e of data.events) {
    const ey = year(e.date);
    if (ey === null) continue;
    out.push({
      id: `te:${e.id}`, sortYear: ey, date: e.date.value,
      dateLabel: formatDate(e.date),
      title: e.title,
      detail: e.description ?? (e.place?.name ? `In ${e.place.name}.` : undefined),
      personIds: e.personIds, kind: 'event', mediaId: e.mediaIds?.[0],
    });
  }

  for (const s of data.stories) {
    const sy = year(s.date);
    if (sy === null) continue;
    out.push({
      id: `ts:${s.id}`, sortYear: sy, date: s.date!.value,
      dateLabel: formatDate(s.date),
      title: s.title,
      detail: s.body.split('\n')[0].slice(0, 160),
      personIds: s.personIds, kind: 'event', mediaId: s.mediaIds[0],
    });
  }

  return out.sort((a, b) => a.sortYear - b.sortYear || a.date.localeCompare(b.date));
}

/** Generation bands with the real year ranges they cover. */
export interface GenerationBand {
  index: number;
  label: string;
  people: Person[];
  from: number | null;
  to: number | null;
}

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];

export function generationBands(g: FamilyGraph): GenerationBand[] {
  return g.byGeneration().map((people, index) => {
    const years = people.map((p) => year(p.birthDate)).filter((y): y is number => y !== null);
    return {
      index,
      label: `Generation ${ROMAN[index] ?? index + 1}`,
      people,
      from: years.length ? Math.min(...years) : null,
      to: years.length ? Math.max(...years) : null,
    };
  }).filter((b) => b.people.length > 0);
}
