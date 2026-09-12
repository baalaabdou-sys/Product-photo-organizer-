import type { FamilyGraph } from '../domain/graph';
import type { ID } from '../domain/types';

export const NODE_W = 150;
export const NODE_H = 158;
export const SPOUSE_GAP = 22;
export const SIB_GAP = 34;
export const CLUSTER_GAP = 58;
export const GEN_H = 250;

export interface LaidNode {
  id: ID;
  x: number;   // left edge
  y: number;   // top edge
  gen: number;
  /** Number of descendants hidden beneath a collapsed node. */
  hidden: number;
  collapsed: boolean;
}

export interface LaidUnion {
  id: ID;
  a: ID;
  b: ID;
  /** Junction point between the two partners. */
  x: number;
  y: number;
  type: string;
}

export interface LaidLink {
  id: string;
  childId: ID;
  /** Where the line starts — a union junction or a single parent. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Horizontal bus line the siblings share. */
  busY: number;
  kind: 'biological' | 'adoptive' | 'step' | 'foster' | 'guardian' | 'unknown';
}

export interface TreeLayout {
  nodes: Map<ID, LaidNode>;
  order: LaidNode[];
  unions: LaidUnion[];
  links: LaidLink[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  generations: number;
}

export interface LayoutOptions {
  /** Nodes whose descendants are folded away. */
  collapsed?: Set<ID>;
  /** Limit to this person's ancestors + descendants, when set. */
  focusId?: ID | null;
  /** How many generations away from the focus to include. */
  radius?: number;
}

/**
 * A tidy layered layout.
 *
 * Couples sit side by side and share one junction; their children hang from a
 * single horizontal bus below it. That is what keeps connectors from turning
 * into spaghetti as the family grows — every sibling group has exactly one
 * vertical drop and one horizontal run.
 */
export function layoutFamily(g: FamilyGraph, opts: LayoutOptions = {}): TreeLayout {
  const collapsed = opts.collapsed ?? new Set<ID>();
  const include = visibleSet(g, opts);

  const nodes = new Map<ID, LaidNode>();
  const unions: LaidUnion[] = [];
  const links: LaidLink[] = [];
  const placed = new Set<ID>();
  const nextX: number[] = [];
  /** Every node placed at each generation, so a subtree can be shifted. */
  const subtreeOf = new Map<ID, ID[]>();

  const cursor = (gen: number) => nextX[gen] ?? 0;
  const bump = (gen: number, x: number) => { nextX[gen] = Math.max(nextX[gen] ?? 0, x); };

  const roots = pickRoots(g, include);

  for (const rootId of roots) {
    placeCluster(rootId);
    // Leave air between unrelated root families.
    const used = Math.max(...nextX.filter(Number.isFinite), 0);
    for (let i = 0; i < nextX.length; i++) nextX[i] = used + CLUSTER_GAP * 1.6;
  }

  // Anyone included but still unplaced (unusual graph shapes) goes in a tail row.
  for (const id of include) {
    if (placed.has(id)) continue;
    placeCluster(id);
  }

  const layout = finish();
  return layout;

  // ── placement ──────────────────────────────────────────
  function placeCluster(personId: ID): ID[] {
    if (placed.has(personId) || !include.has(personId)) return [];
    const gen = g.generation(personId);

    // The person plus any partners who have not been placed elsewhere.
    const cluster: ID[] = [personId];
    placed.add(personId);
    const myUnions = g.unionsFor(personId).filter((u) => {
      const other = u.personA === personId ? u.personB : u.personA;
      return include.has(other);
    });
    for (const u of myUnions) {
      const other = u.personA === personId ? u.personB : u.personA;
      if (placed.has(other)) continue;
      if (g.generation(other) !== gen) continue;
      placed.add(other);
      cluster.push(other);
    }

    const isCollapsed = collapsed.has(personId) || cluster.some((c) => collapsed.has(c));

    // Children first, so the couple can be centred over them.
    const childGroups: Array<{ unionId?: ID; parents: ID[]; children: ID[]; descendants: ID[] }> = [];
    let descendants: ID[] = [];
    if (!isCollapsed) {
      for (const u of myUnions) {
        const kids = g.childrenOfUnion(u.id).map((c) => c.id).filter((id) => include.has(id) && !placed.has(id));
        if (!kids.length) continue;
        const desc: ID[] = [];
        for (const kid of kids) desc.push(...placeCluster(kid));
        childGroups.push({
          unionId: u.id,
          parents: [u.personA, u.personB].filter((p) => cluster.includes(p) || include.has(p)),
          children: kids,
          descendants: desc,
        });
        descendants.push(...desc);
      }
      const sole = g.soleChildren(personId).map((c) => c.id).filter((id) => include.has(id) && !placed.has(id));
      if (sole.length) {
        const desc: ID[] = [];
        for (const kid of sole) desc.push(...placeCluster(kid));
        childGroups.push({ parents: [personId], children: sole, descendants: desc });
        descendants.push(...desc);
      }
    }

    const clusterWidth = cluster.length * NODE_W + (cluster.length - 1) * SPOUSE_GAP;

    // Desired position: centred over the children actually placed.
    const kidNodes = childGroups.flatMap((cg) => cg.children).map((id) => nodes.get(id)!).filter(Boolean);
    let x: number;
    if (kidNodes.length) {
      const left = Math.min(...kidNodes.map((n) => n.x));
      const right = Math.max(...kidNodes.map((n) => n.x + NODE_W));
      x = (left + right) / 2 - clusterWidth / 2;
    } else {
      x = cursor(gen);
    }
    const minX = cursor(gen);
    if (x < minX) {
      // Not enough room — push the whole subtree right instead of overlapping.
      const dx = minX - x;
      shift(descendants, dx);
      x = minX;
    }

    cluster.forEach((id, i) => {
      nodes.set(id, {
        id,
        x: x + i * (NODE_W + SPOUSE_GAP),
        y: gen * GEN_H,
        gen,
        hidden: isCollapsed ? countHidden(g, id, include) : 0,
        collapsed: isCollapsed,
      });
    });
    bump(gen, x + clusterWidth + CLUSTER_GAP);

    // Junctions and links, now that both ends have coordinates.
    for (const u of myUnions) {
      const A = nodes.get(u.personA), B = nodes.get(u.personB);
      if (!A || !B) continue;
      if (unions.some((x2) => x2.id === u.id)) continue;
      unions.push({
        id: u.id, a: u.personA, b: u.personB,
        x: (A.x + NODE_W / 2 + B.x + NODE_W / 2) / 2,
        y: A.y + NODE_H / 2,
        type: u.type,
      });
    }

    for (const cg of childGroups) {
      const anchor = cg.unionId
        ? unions.find((x2) => x2.id === cg.unionId)
        : undefined;
      const parentNode = nodes.get(cg.parents[0]);
      const from = anchor
        ? { x: anchor.x, y: gen * GEN_H + NODE_H }
        : parentNode
          ? { x: parentNode.x + NODE_W / 2, y: parentNode.y + NODE_H }
          : { x, y: gen * GEN_H + NODE_H };
      const busY = gen * GEN_H + NODE_H + (GEN_H - NODE_H) / 2;
      for (const kid of cg.children) {
        const kn = nodes.get(kid);
        if (!kn) continue;
        const link = g.parentLinks(kid).find((l) => cg.parents.includes(l.parentId));
        links.push({
          id: `${cg.unionId ?? cg.parents[0]}->${kid}`,
          childId: kid,
          from,
          to: { x: kn.x + NODE_W / 2, y: kn.y },
          busY,
          kind: link?.type ?? 'biological',
        });
      }
    }

    const all = [...cluster, ...descendants];
    subtreeOf.set(personId, all);
    return all;
  }

  function shift(ids: ID[], dx: number) {
    if (!dx) return;
    const touched = new Set<number>();
    for (const id of ids) {
      const n = nodes.get(id);
      if (!n) continue;
      n.x += dx;
      touched.add(n.gen);
    }
    for (const u of unions) if (ids.includes(u.a) || ids.includes(u.b)) u.x += dx;
    for (const l of links) {
      if (ids.includes(l.childId)) l.to.x += dx;
    }
    for (const gen of touched) {
      const inGen = [...nodes.values()].filter((n) => n.gen === gen);
      if (inGen.length) bump(gen, Math.max(...inGen.map((n) => n.x + NODE_W)) + CLUSTER_GAP);
    }
  }

  function finish(): TreeLayout {
    // Re-derive link sources so shifted unions stay attached.
    for (const l of links) {
      const u = unions.find((x2) => `${x2.id}->${l.childId}` === l.id);
      if (u) l.from = { x: u.x, y: u.y - NODE_H / 2 + NODE_H };
    }

    const list = [...nodes.values()];
    if (!list.length) {
      return {
        nodes, order: [], unions, links, generations: 0,
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
      };
    }
    const minX = Math.min(...list.map((n) => n.x)) - 40;
    const maxX = Math.max(...list.map((n) => n.x + NODE_W)) + 40;
    const minY = Math.min(...list.map((n) => n.y)) - 40;
    const maxY = Math.max(...list.map((n) => n.y + NODE_H)) + 40;
    return {
      nodes,
      order: list.sort((a, b) => a.gen - b.gen || a.x - b.x),
      unions,
      links,
      generations: Math.max(...list.map((n) => n.gen)) + 1,
      bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
    };
  }
}

/** Which people this layout should draw. */
function visibleSet(g: FamilyGraph, opts: LayoutOptions): Set<ID> {
  const all = new Set<ID>(g.people.keys());
  if (!opts.focusId || !g.people.has(opts.focusId)) return all;

  const radius = opts.radius ?? 3;
  const keep = new Set<ID>([opts.focusId]);
  for (const [id, d] of g.ancestors(opts.focusId, radius)) if (d <= radius) keep.add(id);
  for (const [id, d] of g.descendants(opts.focusId, radius)) if (d <= radius) keep.add(id);
  // Bring in siblings and partners of everyone kept, so families read whole.
  for (const id of [...keep]) {
    for (const s of g.siblings(id)) keep.add(s.id);
    for (const p of g.partners(id)) keep.add(p.id);
  }
  for (const id of [...keep]) for (const c of g.children(id)) if (keep.has(id)) keep.add(c.id);
  return keep;
}

/** Root people to start each family block from. */
function pickRoots(g: FamilyGraph, include: Set<ID>): ID[] {
  const candidates = g.roots().filter((p) => include.has(p.id));
  // Largest component first, then by birth year (already sorted by roots()).
  const sorted = candidates.sort((a, b) => g.component(a.id) - g.component(b.id));
  const seen = new Set<ID>();
  const out: ID[] = [];
  for (const p of sorted) {
    if (seen.has(p.id)) continue;
    out.push(p.id);
    seen.add(p.id);
    for (const partner of g.partners(p.id)) seen.add(partner.id);
  }
  return out;
}

function countHidden(g: FamilyGraph, id: ID, include: Set<ID>): number {
  let n = 0;
  for (const d of g.descendants(id).keys()) if (include.has(d)) n++;
  return n;
}

/** Orthogonal connector path: down, across the sibling bus, down again. */
export function linkPath(l: LaidLink): string {
  const r = 12;
  const { from, to, busY } = l;
  if (Math.abs(from.x - to.x) < 1) return `M${from.x},${from.y} L${to.x},${to.y}`;
  const dir = to.x > from.x ? 1 : -1;
  return [
    `M${from.x},${from.y}`,
    `L${from.x},${busY - r}`,
    `Q${from.x},${busY} ${from.x + r * dir},${busY}`,
    `L${to.x - r * dir},${busY}`,
    `Q${to.x},${busY} ${to.x},${busY + r}`,
    `L${to.x},${to.y}`,
  ].join(' ');
}
