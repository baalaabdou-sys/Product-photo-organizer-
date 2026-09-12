import type { FamilyData, Person, Union } from '../domain/types';
import { toGedcomDate } from '../domain/dates';
import { FamilyGraph } from '../domain/graph';

/** Export the archive as GEDCOM 5.5.1 — the format every genealogy tool reads. */
export function toGedcom(data: FamilyData, opts: { includePrivate?: boolean } = {}): string {
  const g = new FamilyGraph(data);
  const L: string[] = [];
  const xrefOf = new Map<string, string>();
  data.people.forEach((p, i) => xrefOf.set(p.id, `@I${i + 1}@`));

  const line = (level: number, tag: string, value?: string) => {
    if (value === undefined || value === '') { L.push(`${level} ${tag}`); return; }
    const parts = String(value).split('\n');
    L.push(`${level} ${tag} ${parts[0]}`);
    for (const extra of parts.slice(1)) L.push(`${level + 1} CONT ${extra}`);
  };

  const now = new Date();
  const stamp = `${now.getDate()} ${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][now.getMonth()]} ${now.getFullYear()}`;

  L.push('0 HEAD');
  line(1, 'SOUR', 'ABDERRAHMANE_FAMILY_TREE');
  line(2, 'NAME', 'Abderrahmane Family Tree');
  line(2, 'VERS', '1.0');
  line(1, 'DATE', stamp);
  line(2, 'TIME', now.toTimeString().slice(0, 8));
  line(1, 'GEDC');
  line(2, 'VERS', '5.5.1');
  line(2, 'FORM', 'LINEAGE-LINKED');
  line(1, 'CHAR', 'UTF-8');
  line(1, 'SUBM', '@SUB1@');

  // ── Individuals ──────────────────────────────────────────
  for (const p of data.people) {
    const xref = xrefOf.get(p.id)!;
    L.push(`0 ${xref} INDI`);
    const given = [p.firstName, p.middleNames].filter(Boolean).join(' ');
    line(1, 'NAME', `${given} /${p.lastName ?? ''}/`);
    if (given) line(2, 'GIVN', given);
    if (p.lastName) line(2, 'SURN', p.lastName);
    if (p.nickname) line(2, 'NICK', p.nickname);
    if (p.gender !== 'unknown') {
      line(1, 'SEX', p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'X');
    }
    emitEvent(line, 'BIRT', toGedcomDate(p.birthDate), p.birthPlace?.name);
    emitEvent(line, 'DEAT', toGedcomDate(p.deathDate), p.deathPlace?.name);
    emitEvent(line, 'BURI', toGedcomDate(p.burialDate), p.burialPlace?.name);
    if (p.profession) {
      line(1, 'OCCU', p.profession);
      if (p.company) line(2, 'CORP', p.company);
    }
    if (p.biography && (opts.includePrivate || p.privacy.level !== 'private')) {
      line(1, 'NOTE', p.biography);
    }

    // FAMC / FAMS links.
    for (const u of g.unionsFor(p.id)) line(1, 'FAMS', famXref(u, data));
    const parentUnions = new Set<string>();
    for (const link of g.parentLinks(p.id)) {
      if (link.unionId) parentUnions.add(link.unionId);
    }
    for (const uid of parentUnions) {
      const u = data.unions.find((x) => x.id === uid);
      if (u) line(1, 'FAMC', famXref(u, data));
    }
  }

  // ── Families ─────────────────────────────────────────────
  for (const u of data.unions) {
    L.push(`0 ${famXref(u, data)} FAM`);
    const a = data.people.find((p) => p.id === u.personA);
    const b = data.people.find((p) => p.id === u.personB);
    const husband = a?.gender === 'female' ? b : a;
    const wife = husband === a ? b : a;
    if (husband) line(1, 'HUSB', xrefOf.get(husband.id)!);
    if (wife) line(1, 'WIFE', xrefOf.get(wife.id)!);
    for (const c of g.childrenOfUnion(u.id)) line(1, 'CHIL', xrefOf.get(c.id)!);
    if (u.type !== 'partnership') {
      line(1, 'MARR');
      if (u.startDate) line(2, 'DATE', toGedcomDate(u.startDate));
      if (u.place?.name) line(2, 'PLAC', u.place.name);
    }
    if (u.type === 'divorced') {
      line(1, 'DIV');
      if (u.endDate) line(2, 'DATE', toGedcomDate(u.endDate));
    }
  }

  // Children with a single recorded parent still need a FAM record.
  let extra = 0;
  for (const p of data.people) {
    const sole = g.soleChildren(p.id);
    if (!sole.length) continue;
    extra += 1;
    const fx = `@F9${extra}@`;
    L.push(`0 ${fx} FAM`);
    line(1, p.gender === 'female' ? 'WIFE' : 'HUSB', xrefOf.get(p.id)!);
    for (const c of sole) line(1, 'CHIL', xrefOf.get(c.id)!);
  }

  L.push('0 @SUB1@ SUBM');
  line(1, 'NAME', 'Abderrahmane Family');
  L.push('0 TRLR');
  return L.join('\n') + '\n';
}

function emitEvent(
  line: (l: number, t: string, v?: string) => void,
  tag: string, date: string, place?: string,
) {
  if (!date && !place) return;
  line(1, tag);
  if (date) line(2, 'DATE', date);
  if (place) line(2, 'PLAC', place);
}

function famXref(u: Union, data: FamilyData): string {
  const idx = data.unions.indexOf(u);
  return `@F${idx + 1}@`;
}

/** JSON export — lossless, the format to use for backups. */
export function toJson(data: FamilyData): string {
  return JSON.stringify(
    { format: 'abderrahmane-family-tree', version: 1, exportedAt: new Date().toISOString(), data },
    null, 2,
  );
}

/** A flat CSV of people, for spreadsheets. Relationships are not representable. */
export function toCsv(data: FamilyData): string {
  const g = new FamilyGraph(data);
  const cols = [
    'id','firstName','middleNames','lastName','birthSurname','nickname','gender',
    'birthDate','birthPlace','deathDate','deathPlace','profession','company',
    'father','mother','partners','children',
  ];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const name = (p: Person) => [p.firstName, p.lastName].filter(Boolean).join(' ');
  const rows = data.people.map((p) => {
    const parents = g.parents(p.id);
    return [
      p.id, p.firstName, p.middleNames ?? '', p.lastName, p.birthSurname ?? '', p.nickname ?? '', p.gender,
      p.birthDate?.value ?? '', p.birthPlace?.name ?? '',
      p.deathDate?.value ?? '', p.deathPlace?.name ?? '',
      p.profession ?? '', p.company ?? '',
      parents.find((x) => x.gender === 'male')?.id ?? '',
      parents.find((x) => x.gender === 'female')?.id ?? '',
      g.partners(p.id).map(name).join('; '),
      g.children(p.id).map(name).join('; '),
    ].map(esc).join(',');
  });
  return [cols.join(','), ...rows].join('\n') + '\n';
}
