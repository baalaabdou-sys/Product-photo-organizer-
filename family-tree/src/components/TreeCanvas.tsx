import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useArchive } from '../data/store';
import { layoutFamily, linkPath, NODE_W, NODE_H, GEN_H } from '../layout/treeLayout';
import type { TreeLayout } from '../layout/treeLayout';
import { useViewport } from '../hooks/useViewport';
import { TreeNode, type NodeTone } from './TreeNode';
import { describeRelationship } from '../domain/relationships';
import { haptic } from '../lib/haptics';
import type { ID } from '../domain/types';
import { BranchLoader } from './BranchLoader';
import { useIsCoarse } from '../hooks/useMedia';

/** How far outside the viewport nodes are still rendered, in world units. */
const OVERSCAN = 420;

/**
 * The zoom below which node text stops being worth reading. The first view of
 * the tree never opens below this, however large the family gets.
 */
const LEGIBLE_MIN = 0.58;

export function TreeCanvas({ onOpenPerson }: { onOpenPerson: (id: ID) => void }) {
  const graph = useArchive((s) => s.graph);
  const selectedId = useArchive((s) => s.selectedId);
  const meId = useArchive((s) => s.meId);
  const highlightPath = useArchive((s) => s.highlightPath);
  const branchFilter = useArchive((s) => s.branchFilter);
  const branches = useArchive((s) => s.data.branches);
  const select = useArchive((s) => s.select);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<ID>>(new Set());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { camera, fitTo, centerOn, zoomBy, interacting } = useViewport(wrapRef);
  const [ready, setReady] = useState(false);

  const layout: TreeLayout = useMemo(
    () => layoutFamily(graph, { collapsed }),
    [graph, collapsed],
  );

  // ── Container measurement ────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── First framing ────────────────────────────────────────
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !size.w || !layout.order.length) return;
    framed.current = true;
    // Arriving with someone already chosen (from search, home, a story) means
    // the camera should land on them.
    const node = selectedId ? layout.nodes.get(selectedId) : undefined;
    if (node) {
      centerOn(node.x + NODE_W / 2, node.y + NODE_H / 2, 0.92, 0);
      const t0 = setTimeout(() => setReady(true), 60);
      return () => clearTimeout(t0);
    }

    // Otherwise show the family whole — but only while that stays readable.
    // On a phone, fitting a large tree would shrink names past legibility, so
    // below the floor we open beside a person instead of on a field of dots.
    const pad = 72;
    const fitScale = Math.min(
      (size.w - pad * 2) / Math.max(1, layout.bounds.width),
      (size.h - pad * 2) / Math.max(1, layout.bounds.height),
    );
    if (fitScale >= LEGIBLE_MIN) {
      fitTo(
        { x: layout.bounds.minX, y: layout.bounds.minY, width: layout.bounds.width, height: layout.bounds.height },
        pad, 0,
      );
    } else {
      const anchorId = meId ?? layout.order[0]?.id;
      const anchor = anchorId ? layout.nodes.get(anchorId) : undefined;
      if (anchor) centerOn(anchor.x + NODE_W / 2, anchor.y + NODE_H / 2, LEGIBLE_MIN + 0.1, 0);
      else fitTo(
        { x: layout.bounds.minX, y: layout.bounds.minY, width: layout.bounds.width, height: layout.bounds.height },
        pad, 0,
      );
    }
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, [size.w, size.h, layout, selectedId, meId, centerOn, fitTo]);

  // ── Camera actions exposed to the toolbar ────────────────
  const fitAll = useCallback(() => {
    fitTo({ x: layout.bounds.minX, y: layout.bounds.minY, width: layout.bounds.width, height: layout.bounds.height }, 72);
  }, [fitTo, layout.bounds]);

  const flyTo = useCallback((id: ID, zoom = 1) => {
    const n = layout.nodes.get(id);
    if (!n) return;
    centerOn(n.x + NODE_W / 2, n.y + NODE_H / 2, zoom, 760);
  }, [centerOn, layout.nodes]);

  // Fly to whatever the app selects, wherever the selection came from.
  const lastFlown = useRef<ID | null>(null);
  useEffect(() => {
    if (!selectedId || !ready) return;
    if (lastFlown.current === selectedId) return;
    lastFlown.current = selectedId;
    flyTo(selectedId, Math.max(camera.k, 0.85));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  // Frame the whole highlighted relationship chain.
  useEffect(() => {
    if (!highlightPath?.length) return;
    const ns = highlightPath.map((id) => layout.nodes.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof layout.nodes.get>>[];
    if (ns.length < 2) return;
    const minX = Math.min(...ns.map((n) => n.x));
    const maxX = Math.max(...ns.map((n) => n.x + NODE_W));
    const minY = Math.min(...ns.map((n) => n.y));
    const maxY = Math.max(...ns.map((n) => n.y + NODE_H));
    // Extend the frame upward so the relationship banner, which sits over the
    // top of the canvas, never covers the first person in the chain.
    const headroom = 170;
    fitTo(
      { x: minX, y: minY - headroom, width: maxX - minX, height: maxY - minY + headroom },
      90, 900, 1,
    );
    haptic('path-complete');
  }, [highlightPath, layout.nodes, fitTo]);

  // ── Keyboard navigation ──────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const step = e.shiftKey ? 220 : 90;
      switch (e.key) {
        case '+': case '=': zoomBy(1.25); e.preventDefault(); break;
        case '-': case '_': zoomBy(0.8); e.preventDefault(); break;
        case '0': fitAll(); e.preventDefault(); break;
        case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': {
          if (!selectedId) return;
          const next = neighbourInDirection(e.key, selectedId, layout);
          if (next) { select(next); haptic('focus'); e.preventDefault(); }
          else {
            const el2 = wrapRef.current;
            if (el2) el2.scrollBy(0, 0);
          }
          break;
        }
        case 'Enter':
          if (selectedId) { onOpenPerson(selectedId); e.preventDefault(); }
          break;
        default: {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
          void step;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomBy, fitAll, selectedId, layout, select, onOpenPerson]);

  const toggleCollapse = useCallback((id: ID) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    haptic('focus');
  }, []);

  const handleSelect = useCallback((id: ID) => {
    haptic('focus');
    if (selectedId === id) onOpenPerson(id);
    else { select(id); onOpenPerson(id); }
  }, [selectedId, select, onOpenPerson]);

  // ── Derived emphasis sets ────────────────────────────────
  const pathSet = useMemo(() => new Set(highlightPath ?? []), [highlightPath]);

  const branchSet = useMemo(() => {
    if (!branchFilter) return null;
    const b = branches.find((x) => x.id === branchFilter);
    if (!b?.rootPersonId) return null;
    const ids = new Set<ID>([b.rootPersonId]);
    for (const id of graph.descendants(b.rootPersonId).keys()) ids.add(id);
    for (const id of [...ids]) for (const p of graph.partners(id)) ids.add(p.id);
    return ids;
  }, [branchFilter, branches, graph]);

  const relationLabels = useMemo(() => {
    // Relationship badges only make sense on a manageable number of nodes.
    if (!meId || layout.order.length > 260) return new Map<ID, string>();
    const out = new Map<ID, string>();
    for (const n of layout.order) {
      if (n.id === meId) { out.set(n.id, 'You'); continue; }
      const near = graph.neighbours(meId).includes(n.id)
        || graph.ancestors(meId, 3).has(n.id)
        || graph.descendants(meId, 3).has(n.id)
        || graph.siblings(meId).some((s) => s.id === n.id);
      if (!near) continue;
      out.set(n.id, describeRelationship(graph, meId, n.id).label);
    }
    return out;
  }, [meId, graph, layout.order]);

  // ── Virtualisation ───────────────────────────────────────
  const view = useMemo(() => {
    const k = camera.k || 1;
    return {
      minX: (-camera.x - OVERSCAN) / k,
      minY: (-camera.y - OVERSCAN) / k,
      maxX: (-camera.x + size.w + OVERSCAN) / k,
      maxY: (-camera.y + size.h + OVERSCAN) / k,
    };
  }, [camera, size]);

  const detail: 'full' | 'compact' | 'dot' =
    camera.k < 0.3 ? 'dot' : camera.k < 0.55 ? 'compact' : 'full';

  const visibleNodes = useMemo(
    () => layout.order.filter(
      (n) => n.x + NODE_W >= view.minX && n.x <= view.maxX && n.y + NODE_H >= view.minY && n.y <= view.maxY,
    ),
    [layout.order, view],
  );

  const visibleLinks = useMemo(
    () => layout.links.filter((l) => {
      const lo = Math.min(l.from.x, l.to.x), hi = Math.max(l.from.x, l.to.x);
      return hi >= view.minX && lo <= view.maxX && l.to.y >= view.minY && l.from.y <= view.maxY;
    }),
    [layout.links, view],
  );

  const toneOf = useCallback((id: ID): NodeTone => {
    if (pathSet.size) return pathSet.has(id) ? (id === selectedId ? 'selected' : 'onPath') : 'dimmed';
    if (branchSet && !branchSet.has(id)) return 'dimmed';
    if (id === selectedId) return 'selected';
    if (id === meId) return 'me';
    if (selectedId && graph.ancestors(selectedId).has(id)) return 'ancestor';
    return 'normal';
  }, [pathSet, branchSet, selectedId, meId, graph]);

  const empty = layout.order.length === 0;

  return (
    <div
      ref={wrapRef}
      id="tree-canvas"
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{ cursor: interacting ? 'grabbing' : 'grab', overscrollBehavior: 'contain' }}
      role="application"
      aria-label="Family tree canvas. Drag to pan, pinch or scroll to zoom."
    >
      {empty ? (
        <EmptyTree />
      ) : (
        <div
          style={{
            position: 'absolute',
            transformOrigin: '0 0',
            transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.k})`,
            willChange: 'transform',
          }}
        >
          <Connectors
            layout={layout}
            links={visibleLinks}
            pathSet={pathSet}
            branchSet={branchSet}
            selectedId={selectedId}
            graph={graph}
          />
          {visibleNodes.map((n) => {
            const person = graph.person(n.id);
            if (!person) return null;
            return (
              <TreeNode
                key={n.id}
                person={person}
                x={n.x}
                y={n.y}
                tone={toneOf(n.id)}
                relationLabel={detail === 'full' ? relationLabels.get(n.id) : undefined}
                hidden={n.hidden || (n.collapsed ? 0 : hiddenCount(graph, n.id, collapsed))}
                collapsed={n.collapsed}
                detail={detail}
                onSelect={handleSelect}
                onToggleCollapse={toggleCollapse}
              />
            );
          })}
        </div>
      )}

      {!ready && !empty && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" style={{ background: 'rgb(var(--c-paper))' }}>
          <BranchLoader />
        </div>
      )}

      <CanvasControls
        onZoomIn={() => zoomBy(1.35)}
        onZoomOut={() => zoomBy(0.74)}
        onFit={fitAll}
        onMe={meId ? () => flyTo(meId, 1.1) : undefined}
        zoom={camera.k}
      />

      <div className="sr-only" aria-live="polite">
        {selectedId ? `${graph.person(selectedId)?.firstName ?? ''} selected` : ''}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function Connectors({
  layout, links, pathSet, branchSet, selectedId, graph,
}: {
  layout: TreeLayout;
  links: TreeLayout['links'];
  pathSet: Set<ID>;
  branchSet: Set<ID> | null;
  selectedId: ID | null;
  graph: ReturnType<typeof useArchive.getState>['graph'];
}) {
  const b = layout.bounds;
  const ancestorSet = useMemo(
    () => (selectedId ? new Set([selectedId, ...graph.ancestors(selectedId).keys()]) : null),
    [selectedId, graph],
  );

  return (
    <svg
      className="pointer-events-none absolute"
      style={{ left: b.minX, top: b.minY, width: b.width, height: b.height, overflow: 'visible' }}
      width={b.width}
      height={b.height}
      viewBox={`${b.minX} ${b.minY} ${b.width} ${b.height}`}
      aria-hidden="true"
    >
      {/* Marriage bands sit under everything else. */}
      {layout.unions.map((u) => {
        const A = layout.nodes.get(u.a), B = layout.nodes.get(u.b);
        if (!A || !B) return null;
        const y = A.y + NODE_H / 2;
        const x1 = Math.min(A.x, B.x) + NODE_W;
        const x2 = Math.max(A.x, B.x);
        const onPath = pathSet.has(u.a) && pathSet.has(u.b);
        const dim = (pathSet.size && !onPath) || (branchSet && !branchSet.has(u.a) && !branchSet.has(u.b));
        return (
          <g key={u.id} opacity={dim ? 0.14 : 1}>
            <line
              x1={x1} y1={y} x2={x2} y2={y}
              stroke={onPath ? 'rgb(var(--c-gold))' : 'rgb(var(--c-rule))'}
              strokeWidth={onPath ? 2 : 1.25}
              strokeDasharray={u.type === 'divorced' ? '5 5' : u.type === 'partnership' ? '1 5' : undefined}
              strokeLinecap="round"
            />
            {u.type !== 'divorced' && (
              <circle
                cx={(x1 + x2) / 2} cy={y} r={2.6}
                fill={onPath ? 'rgb(var(--c-gold))' : 'rgb(var(--c-gold) / 0.7)'}
              />
            )}
          </g>
        );
      })}

      {links.map((l) => {
        const onPath = pathSet.has(l.childId) && pathSet.size > 0;
        const isAncestorLine = !pathSet.size && ancestorSet?.has(l.childId);
        const dim = (pathSet.size && !onPath) || (branchSet && !branchSet.has(l.childId));
        return (
          <path
            key={l.id}
            d={linkPath(l)}
            fill="none"
            stroke={
              onPath ? 'rgb(var(--c-gold))'
              : isAncestorLine ? 'rgb(var(--c-gold) / 0.55)'
              : 'rgb(var(--c-rule))'
            }
            strokeWidth={onPath ? 2.1 : isAncestorLine ? 1.5 : 1.15}
            strokeLinecap="round"
            strokeDasharray={l.kind === 'adoptive' || l.kind === 'step' || l.kind === 'foster' ? '4 6' : undefined}
            opacity={dim ? 0.13 : 1}
            style={{ transition: 'opacity .5s cubic-bezier(.22,1,.36,1), stroke .5s' }}
          />
        );
      })}
    </svg>
  );
}

function CanvasControls({
  onZoomIn, onZoomOut, onFit, onMe, zoom,
}: {
  onZoomIn: () => void; onZoomOut: () => void; onFit: () => void;
  onMe?: () => void; zoom: number;
}) {
  const [full, setFull] = useState(false);
  // On a phone the control column floats over the tree, so it stays short —
  // pinch already covers zoom, and iOS has no element full screen anyway.
  const coarse = useIsCoarse();
  const toggleFullscreen = () => {
    const el = document.getElementById('tree-shell') ?? document.documentElement;
    if (!document.fullscreenElement) void el.requestFullscreen?.().then(() => setFull(true)).catch(() => {});
    else void document.exitFullscreen?.().then(() => setFull(false)).catch(() => {});
  };

  return (
    <div
      className="no-print absolute right-3 flex flex-col gap-1 rounded-full p-1"
      style={{
        bottom: `calc(var(--safe-b) + var(--nav-h) + 14px)`,
        background: 'rgb(var(--c-paper) / 0.88)',
        border: '1px solid rgb(var(--c-rule))',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      {!coarse && (
        <>
          <IconBtn label="Zoom in" onClick={onZoomIn}>＋</IconBtn>
          <div className="mx-auto h-px w-4" style={{ background: 'rgb(var(--c-rule))' }} />
          <IconBtn label="Zoom out" onClick={onZoomOut}>−</IconBtn>
          <div className="mx-auto h-px w-4" style={{ background: 'rgb(var(--c-rule))' }} />
        </>
      )}
      <IconBtn label="Fit the whole family on screen" onClick={onFit}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" strokeLinecap="round" />
        </svg>
      </IconBtn>
      {onMe && (
        <>
          <div className="mx-auto h-px w-4" style={{ background: 'rgb(var(--c-rule))' }} />
          <IconBtn label="Centre on me" onClick={onMe}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2" strokeLinecap="round" />
            </svg>
          </IconBtn>
        </>
      )}
      {!coarse && (
        <>
          <div className="mx-auto h-px w-4" style={{ background: 'rgb(var(--c-rule))' }} />
          <IconBtn label={full ? 'Leave full screen' : 'Full screen'} onClick={toggleFullscreen}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" strokeLinecap="round" />
            </svg>
          </IconBtn>
        </>
      )}
      <span className="sr-only" aria-live="polite">{`Zoom ${Math.round(zoom * 100)} percent`}</span>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full text-[15px] transition-colors"
      style={{ color: 'rgb(var(--c-muted))' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'rgb(var(--c-ink))')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgb(var(--c-muted))')}
    >
      {children}
    </button>
  );
}

function EmptyTree() {
  const go = useArchive((s) => s.go);
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div style={{ maxWidth: '26rem' }}>
        <BranchLoader still />
        <h2 className="display mt-6 text-[28px]">The tree has no one in it yet</h2>
        <p className="mt-3 text-[14px]" style={{ color: 'rgb(var(--c-muted))' }}>
          Import a GEDCOM file exported from FamilyEcho, or add the first person by hand.
          Nothing is uploaded anywhere — the archive lives on this device.
        </p>
        <button type="button" className="btn btn-primary mt-6" onClick={() => go('settings')}>
          Import the family
        </button>
      </div>
    </div>
  );
}

function hiddenCount(
  graph: ReturnType<typeof useArchive.getState>['graph'], id: ID, collapsed: Set<ID>,
): number {
  return collapsed.has(id) ? graph.descendants(id).size : 0;
}

/** Move selection to the nearest node in a direction — arrow-key navigation. */
function neighbourInDirection(key: string, from: ID, layout: TreeLayout): ID | null {
  const origin = layout.nodes.get(from);
  if (!origin) return null;
  const cx = origin.x + NODE_W / 2, cy = origin.y + NODE_H / 2;
  let best: { id: ID; score: number } | null = null;
  for (const n of layout.order) {
    if (n.id === from) continue;
    const dx = n.x + NODE_W / 2 - cx;
    const dy = n.y + NODE_H / 2 - cy;
    const ok =
      key === 'ArrowLeft' ? dx < -10 && Math.abs(dy) < GEN_H * 0.4
      : key === 'ArrowRight' ? dx > 10 && Math.abs(dy) < GEN_H * 0.4
      : key === 'ArrowUp' ? dy < -10
      : dy > 10;
    if (!ok) continue;
    const score = Math.hypot(dx, dy) + (key === 'ArrowUp' || key === 'ArrowDown' ? Math.abs(dx) * 1.6 : Math.abs(dy) * 1.6);
    if (!best || score < best.score) best = { id: n.id, score };
  }
  return best?.id ?? null;
}
