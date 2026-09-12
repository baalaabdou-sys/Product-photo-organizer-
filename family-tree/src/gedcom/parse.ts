import type {
  FamilyData, Person, Union, ParentChild, Gender, FamilyEvent, Place,
} from '../domain/types';
import { parseGedcomDate } from '../domain/dates';
import { emptyFamily } from '../domain/types';

interface GLine { level: number; xref?: string; tag: string; value: string }
interface GNode { tag: string; value: string; xref?: string; children: GNode[] }

/** Tokenise GEDCOM 5.5/5.5.1/7.0 lines, joining CONT/CONC continuations. */
function tokenize(text: string): GLine[] {
  const out: GLine[] = [];
  // Strip BOM, normalise line endings.
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const m = /^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s(.*))?$/.exec(line);
    if (!m) continue;
    out.push({ level: Number(m[1]), xref: m[2], tag: m[3].toUpperCase(), value: m[4] ?? '' });
  }
  return out;
}

/** Build the record tree from flat lines. */
function buildTree(lines: GLine[]): GNode[] {
  const roots: GNode[] = [];
  const stack: GNode[] = [];
  for (const l of lines) {
    const node: GNode = { tag: l.tag, value: l.value, xref: l.xref, children: [] };
    if (l.tag === 'CONT' || l.tag === 'CONC') {
      const parent = stack[l.level - 1];
      if (parent) parent.value += (l.tag === 'CONT' ? '\n' : '') + l.value;
      continue;
    }
    if (l.level === 0) { roots.push(node); stack.length = 0; stack[0] = node; }
    else {
      const parent = stack[l.level - 1];
      if (!parent) continue;
      parent.children.push(node);
      stack[l.level] = node;
      stack.length = l.level + 1;
    }
  }
  return roots;
}

const child = (n: GNode, tag: string) => n.children.find((c) => c.tag === tag);
const all = (n: GNode, tag: string) => n.children.filter((c) => c.tag === tag);
const val = (n: GNode | undefined, tag: string) => child(n ?? { tag: '', value: '', children: [] }, tag)?.value?.trim() ?? '';

export interface ParseReport {
  data: FamilyData;
  /** Source-id → generated id, so a second import can match records. */
  sourceMap: Record<string, string>;
  counts: { people: number; unions: number; parentage: number; events: number };
  warnings: string[];
  /** Header info: which program produced the file. */
  source?: string;
}

export function parseGedcom(text: string): ParseReport {
  const nodes = buildTree(tokenize(text));
  const data: FamilyData = emptyFamily();
  const warnings: string[] = [];
  const sourceMap: Record<string, string> = {};
  const now = Date.now();

  const head = nodes.find((n) => n.tag === 'HEAD');
  const sourceProgram = head ? (val(child(head, 'SOUR') ?? head, 'NAME') || child(head, 'SOUR')?.value || '') : '';

  const placeIds = new Map<string, string>();
  const placeRef = (name: string) => {
    const clean = name.trim();
    if (!clean) return undefined;
    let id = placeIds.get(clean.toLowerCase());
    if (!id) {
      id = `pl_${placeIds.size + 1}`;
      placeIds.set(clean.toLowerCase(), id);
      const place: Place = {
        id, name: clean,
        country: clean.split(',').map((s) => s.trim()).pop(),
        metadata: {},
      };
      data.places.push(place);
    }
    return { name: clean, placeId: id };
  };

  // ── Individuals ──────────────────────────────────────────
  const indiNodes = nodes.filter((n) => n.tag === 'INDI' && n.xref);
  for (const n of indiNodes) {
    const xref = n.xref!;
    const id = `p_${xref.replace(/@/g, '')}`;
    sourceMap[xref] = id;

    const nameNode = child(n, 'NAME');
    const { first, middle, last } = splitName(nameNode);

    const sexRaw = val(n, 'SEX').toUpperCase();
    const gender: Gender = sexRaw === 'M' ? 'male' : sexRaw === 'F' ? 'female' : sexRaw === 'X' ? 'other' : 'unknown';

    const birth = child(n, 'BIRT');
    const death = child(n, 'DEAT');
    const burial = child(n, 'BURI');
    const occu = child(n, 'OCCU');

    const notes = all(n, 'NOTE').map((x) => x.value).filter(Boolean).join('\n\n');

    const person: Person = {
      id,
      firstName: first,
      middleNames: middle || undefined,
      lastName: last,
      nickname: val(nameNode ?? n, 'NICK') || undefined,
      birthSurname: val(nameNode ?? n, 'SURN') && val(nameNode ?? n, 'SURN') !== last ? val(nameNode ?? n, 'SURN') : undefined,
      gender,
      birthDate: birth ? parseGedcomDate(val(birth, 'DATE')) : undefined,
      birthPlace: birth ? placeRef(val(birth, 'PLAC')) : undefined,
      deathDate: death ? parseGedcomDate(val(death, 'DATE')) : undefined,
      deathPlace: death ? placeRef(val(death, 'PLAC')) : undefined,
      burialDate: burial ? parseGedcomDate(val(burial, 'DATE')) : undefined,
      burialPlace: burial ? placeRef(val(burial, 'PLAC')) : undefined,
      living: death || burial ? false : undefined,
      profession: occu ? (occu.value.trim() || val(occu, 'TYPE') || undefined) : undefined,
      company: occu ? val(occu, 'CORP') || val(occu, 'AGNC') || undefined : undefined,
      biography: notes || undefined,
      // Imported records default to family-only visibility. Nothing is
      // exposed more widely than the file already implied.
      privacy: { level: 'family' },
      metadata: { sourceId: xref, source: 'gedcom', createdAt: now, updatedAt: now },
    };
    if (!person.firstName && !person.lastName) {
      person.firstName = 'Unknown';
      warnings.push(`Record ${xref} has no name and was imported as "Unknown".`);
    }
    data.people.push(person);

    // Additional dated events on the individual.
    for (const ev of n.children) {
      const kindMap: Record<string, FamilyEvent['kind']> = {
        GRAD: 'graduation', RESI: 'move', IMMI: 'move', EMIG: 'move',
        CENS: 'other', EVEN: 'other', RETI: 'career',
      };
      const kind = kindMap[ev.tag];
      if (!kind) continue;
      const date = parseGedcomDate(val(ev, 'DATE'));
      if (!date?.value) continue;
      data.events.push({
        id: `e_${xref.replace(/@/g, '')}_${ev.tag}_${data.events.length}`,
        kind,
        title: ev.value?.trim() || val(ev, 'TYPE') || titleFor(ev.tag),
        date,
        place: placeRef(val(ev, 'PLAC')),
        personIds: [id],
        privacy: 'family',
        metadata: { createdAt: now },
      });
    }
  }

  // ── Families ─────────────────────────────────────────────
  const famNodes = nodes.filter((n) => n.tag === 'FAM' && n.xref);
  for (const n of famNodes) {
    const xref = n.xref!;
    const husb = sourceMap[val(n, 'HUSB')];
    const wife = sourceMap[val(n, 'WIFE')];
    const marr = child(n, 'MARR');
    const div = child(n, 'DIV');
    const unionId = `u_${xref.replace(/@/g, '')}`;

    if (husb && wife) {
      const union: Union = {
        id: unionId,
        personA: husb,
        personB: wife,
        type: div ? 'divorced' : marr ? 'marriage' : 'partnership',
        startDate: marr ? parseGedcomDate(val(marr, 'DATE')) : undefined,
        endDate: div ? parseGedcomDate(val(div, 'DATE')) : undefined,
        place: marr ? placeRef(val(marr, 'PLAC')) : undefined,
        metadata: { sourceId: xref, createdAt: now, updatedAt: now },
      };
      data.unions.push(union);
      sourceMap[xref] = unionId;
    } else if (husb || wife) {
      // A one-parent family record: no union, children still attach below.
    } else {
      warnings.push(`Family ${xref} references no known individuals and was skipped.`);
    }

    for (const c of all(n, 'CHIL')) {
      const childId = sourceMap[c.value.trim()];
      if (!childId) {
        warnings.push(`Family ${xref} lists child ${c.value} which is not in the file.`);
        continue;
      }
      // PEDI on the child's FAMC link tells us adoptive/foster.
      for (const parentId of [husb, wife].filter(Boolean) as string[]) {
        const link: ParentChild = {
          id: `pc_${parentId}_${childId}`,
          parentId,
          childId,
          type: pediType(indiNodes, childId, sourceMap, xref),
          unionId: husb && wife ? unionId : undefined,
          metadata: { createdAt: now },
        };
        if (!data.parentage.some((x) => x.id === link.id)) data.parentage.push(link);
      }
    }
  }

  // Derived birth/marriage/death events power the timeline.
  return {
    data,
    sourceMap,
    counts: {
      people: data.people.length,
      unions: data.unions.length,
      parentage: data.parentage.length,
      events: data.events.length,
    },
    warnings,
    source: sourceProgram || undefined,
  };
}

function pediType(
  indiNodes: GNode[], childId: string, sourceMap: Record<string, string>, famXref: string,
): ParentChild['type'] {
  const node = indiNodes.find((n) => n.xref && sourceMap[n.xref] === childId);
  if (!node) return 'biological';
  for (const famc of all(node, 'FAMC')) {
    if (famc.value.trim() !== famXref) continue;
    const pedi = val(famc, 'PEDI').toLowerCase();
    if (pedi === 'adopted') return 'adoptive';
    if (pedi === 'foster') return 'foster';
    if (pedi === 'step') return 'step';
    if (pedi === 'birth') return 'biological';
  }
  return 'biological';
}

/** "Mohamed /Abderrahmane/" → first / middle / last. */
function splitName(node?: GNode): { first: string; middle: string; last: string } {
  if (!node) return { first: '', middle: '', last: '' };
  const given = val(node, 'GIVN');
  const surn = val(node, 'SURN');
  if (given || surn) {
    const parts = given.split(/\s+/).filter(Boolean);
    return { first: parts[0] ?? '', middle: parts.slice(1).join(' '), last: surn };
  }
  const raw = node.value ?? '';
  const m = /^([^/]*)\/([^/]*)\/?(.*)$/.exec(raw);
  if (m) {
    const parts = m[1].trim().split(/\s+/).filter(Boolean);
    return { first: parts[0] ?? '', middle: parts.slice(1).join(' '), last: m[2].trim() };
  }
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', middle: '', last: '' };
  return { first: parts[0], middle: parts.slice(1, -1).join(' '), last: parts[parts.length - 1] };
}

function titleFor(tag: string): string {
  const map: Record<string, string> = {
    GRAD: 'Graduated', RESI: 'Lived at', IMMI: 'Immigrated',
    EMIG: 'Emigrated', CENS: 'Recorded in a census', RETI: 'Retired', EVEN: 'Event',
  };
  return map[tag] ?? 'Event';
}
