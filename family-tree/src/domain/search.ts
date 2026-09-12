import type { FamilyGraph } from './graph';
import type { Person, Story, FamilyEvent, ID } from './types';
import { year, formatDate, lifespan } from './dates';
import { fullName } from './relationships';

export interface SearchHit {
  id: string;
  kind: 'person' | 'story' | 'event' | 'place';
  personId?: ID;
  title: string;
  subtitle: string;
  score: number;
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Search that understands more than names: a year, a place, an occupation,
 * or "born in Casablanca" all find the right people.
 */
export function search(
  q: string,
  graph: FamilyGraph,
  stories: Story[],
  events: FamilyEvent[],
  limit = 24,
): SearchHit[] {
  const query = norm(q.trim());
  if (!query) return [];

  const terms = query.split(/\s+/).filter((t) => t.length > 0 && !STOPWORDS.has(t));
  const yearTerm = /(^|\s)(\d{4})(\s|$)/.exec(query)?.[2];
  const hits: SearchHit[] = [];

  for (const p of graph.people.values()) {
    let score = 0;
    const name = norm(fullName(p));
    const nick = norm(p.nickname ?? '');
    const places = norm([p.birthPlace?.name, p.deathPlace?.name, p.burialPlace?.name].filter(Boolean).join(' '));
    const work = norm([p.profession, p.company, ...(p.interests ?? []), ...(p.activities ?? [])].filter(Boolean).join(' '));
    const bio = norm(p.biography ?? '');

    if (name === query) score += 120;
    if (name.startsWith(query)) score += 70;

    for (const t of terms) {
      if (norm(p.firstName).startsWith(t)) score += 46;
      else if (name.includes(t)) score += 26;
      if (nick.includes(t)) score += 24;
      if (places.includes(t)) score += 18;
      if (work.includes(t)) score += 16;
      if (bio.includes(t)) score += 6;
    }

    if (yearTerm) {
      const y = Number(yearTerm);
      if (year(p.birthDate) === y || year(p.deathDate) === y) score += 40;
      else {
        const b = year(p.birthDate), d = year(p.deathDate);
        // Alive during that year.
        if (b !== null && b <= y && (d === null || d >= y)) score += 9;
      }
    }

    if (score > 0) {
      hits.push({
        id: `person:${p.id}`,
        kind: 'person',
        personId: p.id,
        title: fullName(p),
        subtitle: describePerson(p),
        score,
      });
    }
  }

  for (const s of stories) {
    let score = 0;
    const t = norm(s.title), b = norm(s.body);
    for (const term of terms) {
      if (t.includes(term)) score += 34;
      else if (b.includes(term)) score += 10;
      if (norm(s.place?.name ?? '').includes(term)) score += 12;
    }
    if (yearTerm && s.date?.value.startsWith(yearTerm)) score += 22;
    if (score > 0) {
      hits.push({
        id: `story:${s.id}`,
        kind: 'story',
        personId: s.personIds[0],
        title: s.title,
        subtitle: [formatDate(s.date), s.place?.name].filter(Boolean).join(' · ') || 'A family story',
        score,
      });
    }
  }

  for (const e of events) {
    let score = 0;
    for (const term of terms) {
      if (norm(e.title).includes(term)) score += 26;
      if (norm(e.place?.name ?? '').includes(term)) score += 14;
    }
    if (yearTerm && e.date.value.startsWith(yearTerm)) score += 30;
    if (score > 0) {
      hits.push({
        id: `event:${e.id}`,
        kind: 'event',
        personId: e.personIds[0],
        title: e.title,
        subtitle: [formatDate(e.date), e.place?.name].filter(Boolean).join(' · '),
        score,
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function describePerson(p: Person): string {
  const bits = [
    lifespan(p.birthDate, p.deathDate),
    p.profession,
    p.birthPlace?.name,
  ].filter(Boolean);
  return bits.join(' · ') || p.lastName || 'No details recorded';
}

const STOPWORDS = new Set([
  'in', 'at', 'the', 'a', 'an', 'of', 'and', 'born', 'died', 'from', 'to', 'who', 'was', 'is',
]);
