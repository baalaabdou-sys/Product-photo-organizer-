import type { FamilyData, ID, Person, Union, ParentChild } from './types';
import { sortKey, year } from './dates';

/**
 * An indexed, read-only view over FamilyData.
 * Built once per data change; every query below is O(1)/O(degree).
 */
export class FamilyGraph {
  readonly people = new Map<ID, Person>();
  readonly unions = new Map<ID, Union>();

  private parentsOf = new Map<ID, ParentChild[]>();
  private childrenOf = new Map<ID, ParentChild[]>();
  private unionsOf = new Map<ID, ID[]>();
  private _generation = new Map<ID, number>();
  private _componentOf = new Map<ID, number>();
  private _childrenOfUnion = new Map<ID, ID[]>();

  constructor(readonly data: FamilyData) {
    for (const p of data.people) this.people.set(p.id, p);
    for (const u of data.unions) {
      if (!this.people.has(u.personA) || !this.people.has(u.personB)) continue;
      this.unions.set(u.id, u);
      push(this.unionsOf, u.personA, u.id);
      push(this.unionsOf, u.personB, u.id);
    }
    for (const pc of data.parentage) {
      if (!this.people.has(pc.parentId) || !this.people.has(pc.childId)) continue;
      if (pc.parentId === pc.childId) continue;
      push(this.parentsOf, pc.childId, pc);
      push(this.childrenOf, pc.parentId, pc);
      if (pc.unionId && this.unions.has(pc.unionId)) {
        const arr = this._childrenOfUnion.get(pc.unionId) ?? [];
        if (!arr.includes(pc.childId)) arr.push(pc.childId);
        this._childrenOfUnion.set(pc.unionId, arr);
      }
    }
    this.assignGenerations();
    this.assignComponents();
  }

  get size() { return this.people.size; }

  person(id: ID | null | undefined): Person | undefined {
    return id ? this.people.get(id) : undefined;
  }

  parents(id: ID): Person[] {
    return (this.parentsOf.get(id) ?? [])
      .map((pc) => this.people.get(pc.parentId)!)
      .filter(Boolean)
      .sort(byGenderThenAge);
  }

  parentLinks(id: ID): ParentChild[] { return this.parentsOf.get(id) ?? []; }

  children(id: ID): Person[] {
    const seen = new Set<ID>();
    const out: Person[] = [];
    for (const pc of this.childrenOf.get(id) ?? []) {
      if (seen.has(pc.childId)) continue;
      seen.add(pc.childId);
      const p = this.people.get(pc.childId);
      if (p) out.push(p);
    }
    return out.sort(byBirth);
  }

  /** Every union this person belongs to, oldest first. */
  unionsFor(id: ID): Union[] {
    return (this.unionsOf.get(id) ?? [])
      .map((uid) => this.unions.get(uid)!)
      .filter(Boolean)
      .sort((a, b) => sortKey(a.startDate) - sortKey(b.startDate));
  }

  partners(id: ID): Person[] {
    const out: Person[] = [];
    for (const u of this.unionsFor(id)) {
      const other = u.personA === id ? u.personB : u.personA;
      const p = this.people.get(other);
      if (p && !out.includes(p)) out.push(p);
    }
    return out;
  }

  childrenOfUnion(unionId: ID): Person[] {
    const explicit = this._childrenOfUnion.get(unionId);
    if (explicit?.length) {
      return explicit.map((id) => this.people.get(id)!).filter(Boolean).sort(byBirth);
    }
    // Fall back to children shared by both partners.
    const u = this.unions.get(unionId);
    if (!u) return [];
    const a = new Set(this.children(u.personA).map((p) => p.id));
    return this.children(u.personB).filter((c) => a.has(c.id));
  }

  /** Children with no recorded union — attached to a single parent. */
  soleChildren(id: ID): Person[] {
    const inUnion = new Set<ID>();
    for (const u of this.unionsFor(id)) for (const c of this.childrenOfUnion(u.id)) inUnion.add(c.id);
    return this.children(id).filter((c) => !inUnion.has(c.id));
  }

  siblings(id: ID, kind: 'all' | 'full' | 'half' = 'all'): Person[] {
    const mine = new Set(this.parents(id).map((p) => p.id));
    if (!mine.size) return [];
    const counts = new Map<ID, number>();
    for (const parentId of mine) {
      for (const c of this.children(parentId)) {
        if (c.id === id) continue;
        counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
      }
    }
    const out: Person[] = [];
    for (const [cid, shared] of counts) {
      const full = shared >= 2 && mine.size >= 2;
      if (kind === 'full' && !full) continue;
      if (kind === 'half' && full) continue;
      const p = this.people.get(cid);
      if (p) out.push(p);
    }
    return out.sort(byBirth);
  }

  /**
   * Generation index. 0 is the oldest known layer; larger numbers are younger.
   * Computed by relaxation so that partners share a layer where possible.
   */
  generation(id: ID): number { return this._generation.get(id) ?? 0; }
  get generations(): number {
    let max = 0;
    for (const g of this._generation.values()) max = Math.max(max, g);
    return this._generation.size ? max + 1 : 0;
  }

  /** People grouped by generation index, each sorted by birth. */
  byGeneration(): Person[][] {
    const out: Person[][] = Array.from({ length: this.generations }, () => []);
    for (const p of this.people.values()) {
      const g = this.generation(p.id);
      if (out[g]) out[g].push(p);
    }
    return out.map((g) => g.sort(byBirth));
  }

  /** Disconnected sub-families; index 0 is the largest. */
  component(id: ID): number { return this._componentOf.get(id) ?? 0; }
  get componentCount(): number {
    return new Set(this._componentOf.values()).size;
  }

  /** Everyone reachable by any relationship edge. */
  neighbours(id: ID): ID[] {
    const out = new Set<ID>();
    for (const p of this.parents(id)) out.add(p.id);
    for (const c of this.children(id)) out.add(c.id);
    for (const s of this.partners(id)) out.add(s.id);
    return [...out];
  }

  /** Ancestors as a map of id → distance, cycle-safe. */
  ancestors(id: ID, maxDepth = 64): Map<ID, number> {
    return this.walk(id, (x) => this.parents(x).map((p) => p.id), maxDepth);
  }

  descendants(id: ID, maxDepth = 64): Map<ID, number> {
    return this.walk(id, (x) => this.children(x).map((p) => p.id), maxDepth);
  }

  /**
   * Breadth-first walk returning id → distance.
   *
   * The origin is deliberately not pre-marked as visited, so that a broken
   * graph in which someone is their own ancestor reports itself here — that
   * is how the integrity review detects circular ancestry. Expansion is
   * tracked separately, so a cycle still terminates.
   */
  private walk(id: ID, next: (x: ID) => ID[], maxDepth: number): Map<ID, number> {
    const dist = new Map<ID, number>();
    const expanded = new Set<ID>([id]);
    let frontier = [id];
    let d = 0;
    while (frontier.length && d < maxDepth) {
      d += 1;
      const nextFrontier: ID[] = [];
      for (const cur of frontier) {
        for (const n of next(cur)) {
          if (dist.has(n)) continue;
          dist.set(n, d);
          if (expanded.has(n)) continue;
          expanded.add(n);
          nextFrontier.push(n);
        }
      }
      frontier = nextFrontier;
    }
    return dist;
  }

  /** True when making `parentId` a parent of `childId` would create a cycle. */
  wouldCreateCycle(parentId: ID, childId: ID): boolean {
    if (parentId === childId) return true;
    return this.descendants(childId).has(parentId);
  }

  /** Oldest known ancestor(s) by birth year, across the whole family. */
  oldestKnown(): Person | undefined {
    let best: Person | undefined;
    let bestY = Number.POSITIVE_INFINITY;
    for (const p of this.people.values()) {
      const y = year(p.birthDate);
      if (y !== null && y < bestY) { bestY = y; best = p; }
    }
    return best;
  }

  /** Root people of each component — those without recorded parents. */
  roots(): Person[] {
    return [...this.people.values()]
      .filter((p) => !(this.parentsOf.get(p.id)?.length))
      .sort((a, b) => sortKey(a.birthDate) - sortKey(b.birthDate));
  }

  // ── internals ────────────────────────────────────────────
  private assignGenerations() {
    // Seed: everyone at 0. Relax child = max(parent)+1 and partners level.
    const gen = this._generation;
    for (const p of this.people.values()) gen.set(p.id, 0);

    const order = this.topoOrder();
    for (let pass = 0; pass < 12; pass++) {
      let changed = false;
      for (const id of order) {
        let g = gen.get(id)!;
        for (const par of this.parents(id)) {
          const cand = gen.get(par.id)! + 1;
          if (cand > g) { g = cand; changed = true; }
        }
        gen.set(id, g);
      }
      // Level partners to the deeper of the two — keeps couples on one line.
      for (const u of this.unions.values()) {
        const a = gen.get(u.personA)!, b = gen.get(u.personB)!;
        if (a !== b) {
          const m = Math.max(a, b);
          // Never pull a partner below their own parents.
          if (canSit(this, u.personA, m, gen) && canSit(this, u.personB, m, gen)) {
            gen.set(u.personA, m); gen.set(u.personB, m); changed = true;
          }
        }
      }
      // A couple with no recorded parents floats to the top by default. When
      // one of their children married into a deeper line, that would leave
      // the rest of their children a generation too high — so pull such a
      // root down to sit directly above its deepest child, and let the
      // relaxation above carry everyone below them down with it.
      for (const p of this.people.values()) {
        if (this.parents(p.id).length) continue;
        const kids = this.children(p.id);
        if (!kids.length) continue;
        const target = Math.max(...kids.map((k) => gen.get(k.id)!)) - 1;
        if (target > gen.get(p.id)!) { gen.set(p.id, target); changed = true; }
      }
      if (!changed) break;
    }

    // Normalise so the shallowest generation is 0.
    let min = Infinity;
    for (const g of gen.values()) min = Math.min(min, g);
    if (min !== 0 && Number.isFinite(min)) for (const [k, v] of gen) gen.set(k, v - min);
  }

  /** Kahn topological order over parent→child edges; cycles appended last. */
  private topoOrder(): ID[] {
    const indeg = new Map<ID, number>();
    for (const p of this.people.values()) indeg.set(p.id, this.parents(p.id).length);
    const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
    const out: ID[] = [];
    const seen = new Set<ID>();
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      for (const c of this.children(id)) {
        const d = (indeg.get(c.id) ?? 1) - 1;
        indeg.set(c.id, d);
        if (d <= 0) queue.push(c.id);
      }
    }
    for (const p of this.people.values()) if (!seen.has(p.id)) out.push(p.id);
    return out;
  }

  private assignComponents() {
    let c = 0;
    const sizes: number[] = [];
    for (const p of this.people.values()) {
      if (this._componentOf.has(p.id)) continue;
      const stack = [p.id];
      let n = 0;
      this._componentOf.set(p.id, c);
      while (stack.length) {
        const cur = stack.pop()!;
        n++;
        for (const nb of this.neighbours(cur)) {
          if (!this._componentOf.has(nb)) { this._componentOf.set(nb, c); stack.push(nb); }
        }
      }
      sizes[c] = n;
      c++;
    }
    // Renumber so component 0 is the largest family cluster.
    const ranking = sizes.map((n, i) => ({ n, i })).sort((a, b) => b.n - a.n).map((x) => x.i);
    const remap = new Map(ranking.map((old, rank) => [old, rank]));
    for (const [id, comp] of this._componentOf) this._componentOf.set(id, remap.get(comp) ?? comp);
  }
}

function canSit(g: FamilyGraph, id: ID, level: number, gen: Map<ID, number>): boolean {
  for (const p of g.parents(id)) if ((gen.get(p.id) ?? 0) >= level) return false;
  return true;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k);
  if (arr) arr.push(v); else m.set(k, [v]);
}

const byBirth = (a: Person, b: Person) => sortKey(a.birthDate) - sortKey(b.birthDate);
const byGenderThenAge = (a: Person, b: Person) => {
  const rank = (p: Person) => (p.gender === 'male' ? 0 : p.gender === 'female' ? 1 : 2);
  return rank(a) - rank(b) || byBirth(a, b);
};

export const isDeceased = (p: Person): boolean =>
  p.living === false || Boolean(p.deathDate?.value);

export const isLiving = (p: Person): boolean => {
  if (p.living === true) return true;
  if (isDeceased(p)) return false;
  const y = year(p.birthDate);
  // Unknown birth date → assume living, the privacy-safe default.
  if (y === null) return true;
  return new Date().getFullYear() - y < 110;
};
