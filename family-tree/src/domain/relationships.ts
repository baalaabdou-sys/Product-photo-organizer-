import { FamilyGraph } from './graph';
import type { ID, Person } from './types';

export type StepKind = 'parent' | 'child' | 'partner' | 'sibling';

export interface PathStep {
  from: ID;
  to: ID;
  kind: StepKind;
  /** "his mother", "her brother", "their son" */
  phrase: string;
}

export interface RelationshipResult {
  /** Short label for a node badge, e.g. "Grandfather", "Second cousin". */
  label: string;
  /** Full sentence, e.g. "Rachid is your first cousin once removed." */
  sentence: string;
  /** Chain from A to B, inclusive of both ends. */
  path: ID[];
  steps: PathStep[];
  /** Common ancestor when the relationship is a blood one. */
  commonAncestorId?: ID;
  /** True when connected only through marriage. */
  byMarriage: boolean;
  degree: 'self' | 'blood' | 'marriage' | 'step' | 'none';
}

const ORDINALS = ['zeroth','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
const ordinal = (n: number) => ORDINALS[n] ?? `${n}th`;
const Ordinal = (n: number) => cap(ordinal(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const greats = (n: number) => (n <= 0 ? '' : n === 1 ? 'great-' : `${ordinal(n)}-great-`);

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

function gendered(p: Person | undefined, male: string, female: string, neutral: string): string {
  if (p?.gender === 'male') return male;
  if (p?.gender === 'female') return female;
  return neutral;
}

/** Possessive for a step phrase: "his", "her", "their". */
function poss(p: Person | undefined): string {
  return gendered(p, 'his', 'her', 'their');
}

/**
 * Bidirectional BFS over parent / child / partner edges.
 * Returns the shortest chain of people linking A to B.
 */
export function findPath(g: FamilyGraph, aId: ID, bId: ID, maxNodes = 40000): ID[] | null {
  if (aId === bId) return [aId];
  if (!g.people.has(aId) || !g.people.has(bId)) return null;
  if (g.component(aId) !== g.component(bId)) return null;

  const prevA = new Map<ID, ID | null>([[aId, null]]);
  const prevB = new Map<ID, ID | null>([[bId, null]]);
  let frontA = [aId];
  let frontB = [bId];
  let visited = 2;

  const expand = (front: ID[], prev: Map<ID, ID | null>, other: Map<ID, ID | null>): ID | null => {
    const next: ID[] = [];
    for (const cur of front) {
      for (const nb of g.neighbours(cur)) {
        if (prev.has(nb)) continue;
        prev.set(nb, cur);
        visited++;
        if (other.has(nb)) return nb;
        next.push(nb);
      }
    }
    front.length = 0;
    front.push(...next);
    return null;
  };

  while (frontA.length && frontB.length && visited < maxNodes) {
    const meet = frontA.length <= frontB.length
      ? expand(frontA, prevA, prevB)
      : expand(frontB, prevB, prevA);
    if (meet) {
      const left: ID[] = [];
      for (let c: ID | null | undefined = meet; c != null; c = prevA.get(c)) left.push(c);
      left.reverse();
      const right: ID[] = [];
      for (let c: ID | null | undefined = prevB.get(meet); c != null; c = prevB.get(c)) right.push(c);
      return [...left, ...right];
    }
  }
  return null;
}

/** Annotate a raw path with the kind of each hop and a human phrase. */
export function annotatePath(g: FamilyGraph, path: ID[]): PathStep[] {
  const steps: PathStep[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i], to = path[i + 1];
    const fromP = g.person(from);
    const toP = g.person(to);
    let kind: StepKind = 'partner';
    if (g.parents(to).some((p) => p.id === from)) kind = 'child';
    else if (g.parents(from).some((p) => p.id === to)) kind = 'parent';
    else if (g.partners(from).some((p) => p.id === to)) kind = 'partner';
    else kind = 'sibling';

    const who = i === 0 ? 'your' : poss(fromP);
    const noun =
      kind === 'parent' ? gendered(toP, 'father', 'mother', 'parent')
      : kind === 'child' ? gendered(toP, 'son', 'daughter', 'child')
      : kind === 'partner' ? gendered(toP, 'husband', 'wife', 'partner')
      : gendered(toP, 'brother', 'sister', 'sibling');
    steps.push({ from, to, kind, phrase: `${who} ${noun}` });
  }
  return steps;
}

/** The blood common ancestor minimising total distance, if one exists. */
function lowestCommonAncestor(g: FamilyGraph, a: ID, b: ID):
  { id: ID; da: number; db: number } | null {
  const ancA = g.ancestors(a); ancA.set(a, 0);
  const ancB = g.ancestors(b); ancB.set(b, 0);
  let best: { id: ID; da: number; db: number } | null = null;
  for (const [id, da] of ancA) {
    const db = ancB.get(id);
    if (db === undefined) continue;
    const score = da + db;
    if (!best || score < best.da + best.db || (score === best.da + best.db && Math.abs(da - db) < Math.abs(best.da - best.db))) {
      best = { id, da, db };
    }
  }
  return best;
}

/** Name a blood relationship from the two distances to a common ancestor. */
function bloodLabel(subject: Person | undefined, da: number, db: number): string {
  // da = steps from A up to the common ancestor, db = from B up.
  if (da === 0 && db === 0) return 'Self';

  if (db === 0) {
    // B is A's ancestor.
    if (da === 1) return gendered(subject, 'Father', 'Mother', 'Parent');
    if (da === 2) return gendered(subject, 'Grandfather', 'Grandmother', 'Grandparent');
    return cap(greats(da - 2)) + gendered(subject, 'grandfather', 'grandmother', 'grandparent');
  }
  if (da === 0) {
    // B is A's descendant.
    if (db === 1) return gendered(subject, 'Son', 'Daughter', 'Child');
    if (db === 2) return gendered(subject, 'Grandson', 'Granddaughter', 'Grandchild');
    return cap(greats(db - 2)) + gendered(subject, 'grandson', 'granddaughter', 'grandchild');
  }
  if (da === 1 && db === 1) return gendered(subject, 'Brother', 'Sister', 'Sibling');

  if (db === 1) {
    // B is a sibling of one of A's ancestors → uncle/aunt.
    const base = gendered(subject, 'uncle', 'aunt', 'aunt or uncle');
    if (da === 2) return cap(base);
    return cap(greats(da - 2) + base);
  }
  if (da === 1) {
    const base = gendered(subject, 'nephew', 'niece', 'nibling');
    if (db === 2) return cap(base);
    return cap(greats(db - 2) + base);
  }

  const degree = Math.min(da, db) - 1;
  const removed = Math.abs(da - db);
  const core = `${Ordinal(degree)} cousin`;
  return removed === 0 ? core : `${core} ${times(removed)} removed`;
}

/**
 * Describe how B relates to A ("A is the viewer, B is the person on screen").
 * Blood relationships are preferred; marriage and step links are named as such.
 */
export function describeRelationship(g: FamilyGraph, aId: ID, bId: ID): RelationshipResult {
  const A = g.person(aId);
  const B = g.person(bId);
  const none: RelationshipResult = {
    label: 'No recorded connection',
    sentence: 'No recorded connection links these two people yet.',
    path: [], steps: [], byMarriage: false, degree: 'none',
  };
  if (!A || !B) return none;

  const path = findPath(g, aId, bId);
  if (!path) return none;
  const steps = annotatePath(g, path);

  if (aId === bId) {
    return { label: 'This is you', sentence: `${fullName(A)} — this is you.`, path, steps, byMarriage: false, degree: 'self' };
  }

  // 1. Direct partnership.
  if (g.partners(aId).some((p) => p.id === bId)) {
    const u = g.unionsFor(aId).find((x) => x.personA === bId || x.personB === bId);
    const divorced = u?.type === 'divorced';
    const label = divorced
      ? gendered(B, 'Former husband', 'Former wife', 'Former partner')
      : u?.type === 'engaged'
        ? gendered(B, 'Fiancé', 'Fiancée', 'Betrothed')
        : gendered(B, 'Husband', 'Wife', 'Partner');
    return {
      label,
      sentence: `${firstName(B)} is your ${label.toLowerCase()}.`,
      path, steps, byMarriage: true, degree: 'marriage',
    };
  }

  // 2. Blood relationship through a common ancestor.
  const lca = lowestCommonAncestor(g, aId, bId);
  if (lca) {
    const label = bloodLabel(B, lca.da, lca.db);
    return {
      label,
      sentence: bloodSentence(A, B, label, lca.da, lca.db),
      path, steps,
      commonAncestorId: lca.id,
      byMarriage: false,
      degree: 'blood',
    };
  }

  // 3. Through marriage: find the blood relative who bridges to B.
  const inLaw = findInLaw(g, aId, bId);
  if (inLaw) return { ...inLaw, path, steps };

  // 4. Fall back to a narrated chain.
  const via = steps.map((s) => s.phrase).join(' → ');
  return {
    label: 'Related by marriage',
    sentence: `${firstName(B)} is connected to you through ${via}.`,
    path, steps, byMarriage: true, degree: 'marriage',
  };
}

function bloodSentence(A: Person, B: Person, label: string, da: number, db: number): string {
  const l = label.toLowerCase();
  if (da === 0 && db === 0) return 'This is you.';
  if (l.includes('cousin')) {
    // "You and Ahmed are first cousins once removed."
    const plural = l.replace('cousin', 'cousins');
    return `${firstName(A)} and ${firstName(B)} are ${plural}.`;
  }
  return `${firstName(B)} is your ${l}.`;
}

/** Name the closest in-law relationship, e.g. "Brother-in-law". */
function findInLaw(g: FamilyGraph, aId: ID, bId: ID): RelationshipResult | null {
  const A = g.person(aId);
  const B = g.person(bId);
  if (!A || !B) return null;

  // B is the partner of a blood relative of A.
  for (const partner of g.partners(bId)) {
    const lca = lowestCommonAncestor(g, aId, partner.id);
    if (!lca) continue;
    const base = bloodLabel(partner, lca.da, lca.db).toLowerCase();
    const label = inLawName(B, base);
    if (label) {
      return {
        label: cap(label),
        sentence: `${firstName(B)} is your ${label} — married to your ${base}.`,
        path: [], steps: [], byMarriage: true, degree: 'marriage',
      };
    }
  }
  // B is a blood relative of A's partner.
  for (const myPartner of g.partners(aId)) {
    const lca = lowestCommonAncestor(g, myPartner.id, bId);
    if (!lca) continue;
    const base = bloodLabel(B, lca.da, lca.db).toLowerCase();
    const label = inLawName(B, base);
    if (label) {
      return {
        label: cap(label),
        sentence: `${firstName(B)} is your ${label} — ${myPartner.firstName}'s ${base}.`,
        path: [], steps: [], byMarriage: true, degree: 'marriage',
      };
    }
  }
  return null;
}

function inLawName(b: Person, base: string): string | null {
  if (/^(father|mother|parent)$/.test(base)) return `${base}-in-law`;
  if (/^(son|daughter|child)$/.test(base)) return `${base}-in-law`;
  if (/^(brother|sister|sibling)$/.test(base)) return `${base}-in-law`;
  if (/^(uncle|aunt)/.test(base)) return `${base} by marriage`;
  if (/cousin/.test(base)) return `${base} by marriage`;
  if (/grand/.test(base)) return `${base} by marriage`;
  if (/(nephew|niece)/.test(base)) return `${base} by marriage`;
  return gendered(b, 'relative by marriage', 'relative by marriage', 'relative by marriage');
}

export const fullName = (p: Person): string =>
  [p.firstName, p.middleNames, p.lastName].filter(Boolean).join(' ').trim();

export const firstName = (p: Person): string => p.nickname || p.firstName || p.lastName || 'Unknown';

export const initialsOf = (p: Person): string => {
  const a = (p.firstName || '').trim()[0] ?? '';
  const b = (p.lastName || '').trim()[0] ?? '';
  return (a + b).toUpperCase() || '·';
};
