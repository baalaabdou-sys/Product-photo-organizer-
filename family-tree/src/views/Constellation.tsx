import { useEffect, useMemo, useRef, useState } from 'react';
import { useArchive } from '../data/store';
import { layoutFamily, NODE_W, NODE_H } from '../layout/treeLayout';
import { useViewport } from '../hooks/useViewport';
import { Portrait } from '../components/Portrait';
import { fullName } from '../domain/relationships';
import { lifespan } from '../domain/dates';
import { isDeceased } from '../domain/graph';
import { prefersReducedMotion } from '../lib/motion';
import { haptic } from '../lib/haptics';

/**
 * Constellation — an artistic second reading of the same graph. Every person
 * is a point of warm light; zooming in resolves them into portraits and names.
 * Drawn to canvas so thousands of points stay smooth.
 */
export function Constellation() {
  const graph = useArchive((s) => s.graph);
  const select = useArchive((s) => s.select);
  const go = useArchive((s) => s.go);
  const meId = useArchive((s) => s.meId);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { camera, fitTo, centerOn } = useViewport(wrapRef);
  const [hovered, setHovered] = useState<string | null>(null);

  const layout = useMemo(() => layoutFamily(graph), [graph]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !layout.order.length) return;
    fitTo(
      { x: layout.bounds.minX, y: layout.bounds.minY, width: layout.bounds.width, height: layout.bounds.height },
      60, 0, 0.9,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // ── Canvas painting ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let raf = 0;
    let t = 0;
    const reduced = prefersReducedMotion();

    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const toScreen = (x: number, y: number) => ({
        x: x * camera.k + camera.x,
        y: y * camera.k + camera.y,
      });

      // Connections first, faint.
      ctx.lineWidth = Math.max(0.4, 0.7 * camera.k);
      ctx.strokeStyle = 'rgba(198, 166, 105, 0.16)';
      ctx.beginPath();
      for (const l of layout.links) {
        const a = toScreen(l.from.x, l.from.y);
        const b = toScreen(l.to.x, l.to.y);
        if (Math.max(a.y, b.y) < -50 || Math.min(a.y, b.y) > h + 50) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      for (const u of layout.unions) {
        const A = layout.nodes.get(u.a), B = layout.nodes.get(u.b);
        if (!A || !B) continue;
        const a = toScreen(A.x + NODE_W / 2, A.y + NODE_H / 2);
        const b = toScreen(B.x + NODE_W / 2, B.y + NODE_H / 2);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();

      // Points of light.
      for (const n of layout.order) {
        const p = toScreen(n.x + NODE_W / 2, n.y + NODE_H / 2);
        if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) continue;
        const person = graph.person(n.id);
        const living = person ? !isDeceased(person) : true;
        const seed = hash(n.id);
        const twinkle = reduced ? 1 : 0.78 + 0.22 * Math.sin(t / 1400 + seed);
        const isMe = n.id === meId;
        const base = isMe ? 3.6 : living ? 2.5 : 2.0;
        const r = base * Math.max(0.55, Math.min(1.5, camera.k));

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
        grad.addColorStop(0, `rgba(232, 200, 140, ${0.5 * twinkle})`);
        grad.addColorStop(1, 'rgba(232, 200, 140, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isMe
          ? `rgba(255, 236, 200, ${twinkle})`
          : `rgba(240, 214, 168, ${(living ? 0.95 : 0.7) * twinkle})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      t += 16;
      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [layout, camera, graph, meId]);

  // Close enough to read names?
  const resolved = camera.k > 0.62;

  const pick = (id: string) => {
    haptic('focus');
    select(id);
    go('tree');
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left - camera.x) / camera.k;
    const y = (e.clientY - r.top - camera.y) / camera.k;
    let best: { id: string; d: number } | null = null;
    for (const n of layout.order) {
      const d = Math.hypot(n.x + NODE_W / 2 - x, n.y + NODE_H / 2 - y);
      if (!best || d < best.d) best = { id: n.id, d };
    }
    if (best && best.d < 90) {
      const node = layout.nodes.get(best.id)!;
      centerOn(node.x + NODE_W / 2, node.y + NODE_H / 2, Math.max(camera.k, 0.9));
      setHovered(best.id);
      haptic('focus');
    }
  };

  const focused = hovered ? graph.person(hovered) : null;

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full touch-none overflow-hidden"
      style={{
        background: 'radial-gradient(120% 90% at 50% 20%, #16120f 0%, #0b0908 70%)',
        cursor: 'grab',
      }}
      onClick={onCanvasClick}
      role="application"
      aria-label="Family constellation. An artistic view of the same family tree."
    >
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />

      {/* Names resolve out of the light when you come close enough. */}
      {resolved && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ transformOrigin: '0 0' }}
        >
          {layout.order.map((n) => {
            const p = graph.person(n.id);
            if (!p) return null;
            const sx = (n.x + NODE_W / 2) * camera.k + camera.x;
            const sy = (n.y + NODE_H / 2) * camera.k + camera.y;
            if (sx < -80 || sy < -60 || sx > window.innerWidth + 80 || sy > window.innerHeight + 60) return null;
            return (
              <button
                key={n.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); pick(n.id); }}
                className="pointer-events-auto absolute -translate-x-1/2 text-center"
                style={{
                  left: sx,
                  top: sy + 14 * Math.min(1.4, camera.k),
                  opacity: Math.min(1, (camera.k - 0.62) / 0.3),
                  transition: 'opacity .3s',
                }}
              >
                <span className="serif block whitespace-nowrap text-[13px]" style={{ color: '#f0e2cc' }}>
                  {p.firstName}
                </span>
                <span className="block whitespace-nowrap text-[9px] tabular-nums" style={{ color: 'rgb(240 226 204 / 0.45)' }}>
                  {lifespan(p.birthDate, p.deathDate)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <header className="pointer-events-none absolute left-0 right-0 px-6 text-center" style={{ top: 'calc(var(--safe-t) + 22px)' }}>
        <p className="text-[10px] uppercase" style={{ letterSpacing: '0.28em', color: 'rgb(240 226 204 / 0.42)' }}>
          Constellation
        </p>
        <p className="serif mt-1.5 text-[13px] italic" style={{ color: 'rgb(240 226 204 / 0.34)' }}>
          {resolved ? 'Every point is someone.' : 'Zoom in until the names appear.'}
        </p>
      </header>

      {focused && (
        <aside
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-2 pr-5"
          style={{
            bottom: 'calc(var(--safe-b) + var(--nav-h) + 18px)',
            background: 'rgb(255 255 255 / 0.06)',
            backdropFilter: 'blur(12px)',
            color: '#f0e2cc',
          }}
        >
          <Portrait person={focused} size={40} shape="circle" />
          <span className="text-left">
            <span className="block text-[14px]">{fullName(focused)}</span>
            <span className="block text-[10.5px] tabular-nums" style={{ color: 'rgb(240 226 204 / 0.5)' }}>
              {lifespan(focused.birthDate, focused.deathDate)}
            </span>
          </span>
          <button
            type="button"
            className="ml-2 rounded-full px-3 py-1.5 text-[11.5px]"
            style={{ background: 'rgb(255 255 255 / 0.1)' }}
            onClick={(e) => { e.stopPropagation(); pick(focused.id); }}
          >
            Open
          </button>
        </aside>
      )}
    </div>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000;
}
