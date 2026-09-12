import type { FamilyData, Person, ID } from '../domain/types';
import { emptyFamily } from '../domain/types';
import { parseGedcom } from './parse';
import { findDuplicates } from '../domain/validate';
import { reviewFamily, type DataIssue } from '../domain/validate';
import { fullName } from '../domain/relationships';
import { lifespan } from '../domain/dates';

export type ImportStrategy = 'replace' | 'merge';

export interface ImportPreview {
  format: 'gedcom' | 'json' | 'csv';
  incoming: FamilyData;
  /** Program that produced the file, when the header says. */
  source?: string;
  counts: { people: number; unions: number; parentage: number; events: number; media: number; stories: number };
  /** People in the incoming file matched to existing records. */
  matches: Array<{ existingId: ID; incomingId: ID; label: string; reason: string }>;
  /** Internal duplicates inside the incoming file itself. */
  internalDuplicates: Array<{ a: string; b: string; reason: string }>;
  newPeople: Person[];
  warnings: string[];
  issues: DataIssue[];
  /** How many current records would be affected by each strategy. */
  existingCount: number;
  demoCount: number;
}

/** Read a dropped file and build a preview. Nothing is written yet. */
export async function buildPreview(file: File, existing: FamilyData): Promise<ImportPreview> {
  const text = await file.text();
  const name = file.name.toLowerCase();

  let incoming: FamilyData;
  let format: ImportPreview['format'];
  let warnings: string[] = [];
  let source: string | undefined;

  if (name.endsWith('.json')) {
    format = 'json';
    ({ incoming, warnings } = parseJsonFamily(text));
  } else if (name.endsWith('.csv') || name.endsWith('.tsv')) {
    format = 'csv';
    ({ incoming, warnings } = parseCsvFamily(text, name.endsWith('.tsv') ? '\t' : ','));
  } else {
    format = 'gedcom';
    const report = parseGedcom(text);
    incoming = report.data;
    warnings = report.warnings;
    source = report.source;
  }

  // Match incoming people against what is already stored.
  const matches: ImportPreview['matches'] = [];
  const matchedIncoming = new Set<string>();

  const bySourceId = new Map<string, Person>();
  for (const p of existing.people) {
    if (p.metadata.sourceId) bySourceId.set(p.metadata.sourceId, p);
  }
  for (const p of incoming.people) {
    const sid = p.metadata.sourceId;
    if (sid && bySourceId.has(sid)) {
      const ex = bySourceId.get(sid)!;
      matches.push({
        existingId: ex.id, incomingId: p.id,
        label: fullName(p), reason: `Same original identifier (${sid})`,
      });
      matchedIncoming.add(p.id);
    }
  }

  // Then name + birth-year matching for anything still unmatched.
  const combined: FamilyData = {
    ...emptyFamily(),
    people: [...existing.people, ...incoming.people.filter((p) => !matchedIncoming.has(p.id))],
  };
  const existingIds = new Set(existing.people.map((p) => p.id));
  for (const dup of findDuplicates(combined)) {
    const aExisting = existingIds.has(dup.a);
    const bExisting = existingIds.has(dup.b);
    if (aExisting === bExisting) continue; // both sides same origin — not a merge match
    const existingId = aExisting ? dup.a : dup.b;
    const incomingId = aExisting ? dup.b : dup.a;
    if (matchedIncoming.has(incomingId)) continue;
    matchedIncoming.add(incomingId);
    const p = incoming.people.find((x) => x.id === incomingId);
    matches.push({
      existingId, incomingId,
      label: p ? fullName(p) : incomingId,
      reason: dup.reason,
    });
  }

  const internalDuplicates = findDuplicates(incoming)
    .filter((d) => d.score >= 0.9)
    .map((d) => {
      const a = incoming.people.find((p) => p.id === d.a);
      const b = incoming.people.find((p) => p.id === d.b);
      return {
        a: a ? `${fullName(a)} ${lifespan(a.birthDate, a.deathDate)}`.trim() : d.a,
        b: b ? `${fullName(b)} ${lifespan(b.birthDate, b.deathDate)}`.trim() : d.b,
        reason: d.reason,
      };
    });

  return {
    format,
    incoming,
    source,
    counts: {
      people: incoming.people.length,
      unions: incoming.unions.length,
      parentage: incoming.parentage.length,
      events: incoming.events.length,
      media: incoming.media.length,
      stories: incoming.stories.length,
    },
    matches,
    internalDuplicates,
    newPeople: incoming.people.filter((p) => !matchedIncoming.has(p.id)),
    warnings,
    issues: reviewFamily(incoming),
    existingCount: existing.people.length,
    demoCount: existing.people.filter((p) => p.metadata.demo).length,
  };
}

/**
 * Apply a previewed import. Pure — returns the new family data and never
 * mutates the input, so a caller can always keep the previous state.
 */
export function applyImport(
  existing: FamilyData,
  preview: ImportPreview,
  opts: { strategy: ImportStrategy; removeDemo: boolean },
): { data: FamilyData; summary: { added: number; updated: number; removed: number } } {
  const { incoming, matches } = preview;

  if (opts.strategy === 'replace') {
    return {
      data: clone(incoming),
      summary: { added: incoming.people.length, updated: 0, removed: existing.people.length },
    };
  }

  const base: FamilyData = clone(existing);
  let removed = 0;
  if (opts.removeDemo) {
    const demoIds = new Set(base.people.filter((p) => p.metadata.demo).map((p) => p.id));
    removed = demoIds.size;
    base.people = base.people.filter((p) => !demoIds.has(p.id));
    base.unions = base.unions.filter((u) => !demoIds.has(u.personA) && !demoIds.has(u.personB));
    base.parentage = base.parentage.filter((r) => !demoIds.has(r.parentId) && !demoIds.has(r.childId));
    base.stories = base.stories.filter((s) => !s.metadata.demo);
    base.media = base.media.filter((m) => !m.metadata.demo);
    base.events = base.events.filter((e) => !e.metadata.demo);
    base.branches = base.branches.filter((b) => !b.metadata.demo);
    base.places = base.places.filter((p) => !p.metadata.demo);
  }

  // Incoming id → the id it should take in the merged archive.
  const idMap = new Map<string, string>();
  for (const m of matches) {
    if (base.people.some((p) => p.id === m.existingId)) idMap.set(m.incomingId, m.existingId);
  }
  const taken = new Set(base.people.map((p) => p.id));
  for (const p of incoming.people) {
    if (idMap.has(p.id)) continue;
    let id = p.id;
    while (taken.has(id)) id = `${p.id}_${Math.random().toString(36).slice(2, 6)}`;
    taken.add(id);
    idMap.set(p.id, id);
  }

  let added = 0, updated = 0;
  for (const p of incoming.people) {
    const id = idMap.get(p.id)!;
    const idx = base.people.findIndex((x) => x.id === id);
    const next = { ...clone(p), id };
    if (idx >= 0) {
      // Merge field-by-field: existing values are never overwritten by blanks.
      base.people[idx] = mergePerson(base.people[idx], next);
      updated++;
    } else {
      base.people.push(next);
      added++;
    }
  }

  const unionKey = (a: string, b: string) => [a, b].sort().join('~');
  const existingUnions = new Set(base.unions.map((u) => unionKey(u.personA, u.personB)));
  for (const u of incoming.unions) {
    const a = idMap.get(u.personA), b = idMap.get(u.personB);
    if (!a || !b) continue;
    if (existingUnions.has(unionKey(a, b))) continue;
    existingUnions.add(unionKey(a, b));
    base.unions.push({ ...clone(u), id: uniq(u.id, base.unions.map((x) => x.id)), personA: a, personB: b });
  }

  const existingLinks = new Set(base.parentage.map((r) => `${r.parentId}>${r.childId}`));
  for (const r of incoming.parentage) {
    const parentId = idMap.get(r.parentId), childId = idMap.get(r.childId);
    if (!parentId || !childId) continue;
    const key = `${parentId}>${childId}`;
    if (existingLinks.has(key)) continue;
    existingLinks.add(key);
    base.parentage.push({ ...clone(r), id: `pc_${parentId}_${childId}`, parentId, childId });
  }

  for (const e of incoming.events) {
    base.events.push({
      ...clone(e),
      id: uniq(e.id, base.events.map((x) => x.id)),
      personIds: e.personIds.map((x) => idMap.get(x)).filter(Boolean) as ID[],
    });
  }
  for (const s of incoming.stories) {
    base.stories.push({
      ...clone(s),
      id: uniq(s.id, base.stories.map((x) => x.id)),
      personIds: s.personIds.map((x) => idMap.get(x)).filter(Boolean) as ID[],
    });
  }
  for (const m of incoming.media) {
    base.media.push({
      ...clone(m),
      id: uniq(m.id, base.media.map((x) => x.id)),
      tags: m.tags.map((t) => ({ ...t, personId: idMap.get(t.personId) ?? t.personId })),
    });
  }
  const placeNames = new Set(base.places.map((p) => p.name.toLowerCase()));
  for (const pl of incoming.places) {
    if (placeNames.has(pl.name.toLowerCase())) continue;
    placeNames.add(pl.name.toLowerCase());
    base.places.push(clone(pl));
  }

  return { data: base, summary: { added, updated, removed } };
}

/** Existing values win; incoming fills only what is missing. */
function mergePerson(existing: Person, incoming: Person): Person {
  const out: Person = { ...existing };
  const keys = Object.keys(incoming) as Array<keyof Person>;
  for (const k of keys) {
    if (k === 'id' || k === 'metadata' || k === 'privacy') continue;
    const cur = out[k];
    const next = incoming[k];
    const empty = cur == null || cur === '' || (Array.isArray(cur) && cur.length === 0);
    if (empty && next != null && next !== '') (out as unknown as Record<string, unknown>)[k] = next;
  }
  out.metadata = {
    ...existing.metadata,
    sourceId: existing.metadata.sourceId ?? incoming.metadata.sourceId,
    updatedAt: Date.now(),
    demo: false,
  };
  return out;
}

function uniq(id: string, taken: string[]): string {
  if (!taken.includes(id)) return id;
  let i = 2;
  while (taken.includes(`${id}_${i}`)) i++;
  return `${id}_${i}`;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ── JSON ───────────────────────────────────────────────────
function parseJsonFamily(text: string): { incoming: FamilyData; warnings: string[] } {
  const warnings: string[] = [];
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('That file is not valid JSON.'); }

  const obj = parsed as { data?: FamilyData } & Partial<FamilyData>;
  const data = (obj.data ?? obj) as Partial<FamilyData>;
  if (!Array.isArray(data.people)) {
    throw new Error('This JSON has no "people" array — it does not look like a family archive.');
  }
  const now = Date.now();
  const incoming: FamilyData = {
    ...emptyFamily(),
    ...data,
    people: data.people.map((p) => ({
      ...p,
      privacy: p.privacy ?? { level: 'family' },
      metadata: { ...p.metadata, source: 'json', createdAt: p.metadata?.createdAt ?? now, updatedAt: now, demo: false },
    })),
  } as FamilyData;
  if (!incoming.parentage.length && incoming.people.length > 1) {
    warnings.push('No parent/child links were found in this file — people will be imported unconnected.');
  }
  return { incoming, warnings };
}

// ── CSV ────────────────────────────────────────────────────
/**
 * A pragmatic CSV shape: one row per person, with optional `father` /
 * `mother` / `spouse` columns referencing another row's `id` or full name.
 */
function parseCsvFamily(text: string, delim: string): { incoming: FamilyData; warnings: string[] } {
  const warnings: string[] = [];
  const rows = parseDelimited(text, delim);
  if (rows.length < 2) throw new Error('This file has no data rows.');

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n.toLowerCase().replace(/[\s_-]/g, ''));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iFirst = col('firstname', 'given', 'givenname', 'first');
  const iLast = col('lastname', 'surname', 'family', 'last');
  const iName = col('name', 'fullname');
  if (iFirst < 0 && iName < 0) {
    throw new Error('The CSV needs at least a "firstName" or "name" column.');
  }

  const idx = {
    id: col('id'), middle: col('middlenames', 'middle'), nickname: col('nickname'),
    gender: col('gender', 'sex'), birth: col('birthdate', 'born', 'birth'),
    birthPlace: col('birthplace', 'bornin'), death: col('deathdate', 'died', 'death'),
    deathPlace: col('deathplace', 'diedin'), profession: col('profession', 'occupation', 'job'),
    company: col('company', 'employer'), bio: col('biography', 'notes', 'story'),
    father: col('father', 'fatherid'), mother: col('mother', 'motherid'),
    spouse: col('spouse', 'partner', 'husband', 'wife'),
  };

  const now = Date.now();
  const incoming = emptyFamily();
  const keyOf = new Map<string, string>();

  rows.slice(1).forEach((r, n) => {
    if (r.every((c) => !c.trim())) return;
    let first = iFirst >= 0 ? r[iFirst]?.trim() ?? '' : '';
    let last = iLast >= 0 ? r[iLast]?.trim() ?? '' : '';
    if (!first && iName >= 0) {
      const parts = (r[iName] ?? '').trim().split(/\s+/);
      first = parts[0] ?? '';
      last = parts.slice(1).join(' ');
    }
    if (!first && !last) return;
    const rawId = idx.id >= 0 ? r[idx.id]?.trim() : '';
    const id = `p_csv_${rawId || n + 1}`;
    const g = (idx.gender >= 0 ? r[idx.gender] ?? '' : '').trim().toLowerCase();

    incoming.people.push({
      id, firstName: first, lastName: last,
      middleNames: cell(r, idx.middle), nickname: cell(r, idx.nickname),
      gender: /^m/.test(g) ? 'male' : /^f/.test(g) ? 'female' : /^o/.test(g) ? 'other' : 'unknown',
      birthDate: dateCell(r, idx.birth),
      birthPlace: placeCell(r, idx.birthPlace),
      deathDate: dateCell(r, idx.death),
      deathPlace: placeCell(r, idx.deathPlace),
      living: cell(r, idx.death) ? false : undefined,
      profession: cell(r, idx.profession), company: cell(r, idx.company),
      biography: cell(r, idx.bio),
      privacy: { level: 'family' },
      metadata: { sourceId: rawId || undefined, source: 'csv', createdAt: now, updatedAt: now },
    });
    if (rawId) keyOf.set(rawId.toLowerCase(), id);
    keyOf.set(`${first} ${last}`.trim().toLowerCase(), id);
  });

  const resolve = (ref?: string) => (ref ? keyOf.get(ref.trim().toLowerCase()) : undefined);

  rows.slice(1).forEach((r, n) => {
    const rawId = idx.id >= 0 ? r[idx.id]?.trim() : '';
    const childId = `p_csv_${rawId || n + 1}`;
    if (!incoming.people.some((p) => p.id === childId)) return;
    for (const key of ['father', 'mother'] as const) {
      const parentId = resolve(cell(r, idx[key]));
      if (!parentId) {
        const raw = cell(r, idx[key]);
        if (raw) warnings.push(`Row ${n + 2}: ${key} "${raw}" does not match any row in the file.`);
        continue;
      }
      incoming.parentage.push({
        id: `pc_${parentId}_${childId}`, parentId, childId,
        type: 'biological', metadata: { createdAt: now },
      });
    }
    const spouseId = resolve(cell(r, idx.spouse));
    if (spouseId && spouseId !== childId) {
      const exists = incoming.unions.some(
        (u) => (u.personA === childId && u.personB === spouseId) || (u.personA === spouseId && u.personB === childId),
      );
      if (!exists) {
        incoming.unions.push({
          id: `u_csv_${incoming.unions.length + 1}`, personA: childId, personB: spouseId,
          type: 'marriage', metadata: { createdAt: now, updatedAt: now },
        });
      }
    }
  });

  return { incoming, warnings };
}

const cell = (r: string[], i: number) => (i >= 0 ? r[i]?.trim() || undefined : undefined);
const dateCell = (r: string[], i: number) => {
  const v = cell(r, i);
  if (!v) return undefined;
  const iso = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(v);
  if (iso) return { value: v };
  const y = /(\d{4})/.exec(v);
  return y ? { value: y[1], original: v } : undefined;
};
const placeCell = (r: string[], i: number) => {
  const v = cell(r, i);
  return v ? { name: v } : undefined;
};

/** RFC4180-ish reader that tolerates quoted fields and embedded newlines. */
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
