import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

export interface Camera { x: number; y: number; k: number }

export interface Rect { x: number; y: number; width: number; height: number }

const MIN_K = 0.12;
const MAX_K = 2.6;

/**
 * Pan/zoom camera for the tree canvas.
 *
 * Handles wheel + trackpad pinch, two-finger pinch, one-finger drag and
 * keyboard panning, and animates camera moves with an eased tween so
 * "fly to this person" feels like a camera rather than a jump.
 */
export function useViewport(containerRef: React.RefObject<HTMLElement>) {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, k: 1 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const animRef = useRef<number | null>(null);
  const [interacting, setInteracting] = useState(false);

  const stop = useCallback(() => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

  const set = useCallback((c: Camera) => { stop(); setCamera(clamp(c)); }, [stop]);

  /** Tween the camera. Instant when the user asked for reduced motion. */
  const animateTo = useCallback((target: Camera, duration = 700) => {
    stop();
    const from = cameraRef.current;
    const to = clamp(target);
    if (prefersReducedMotion() || duration <= 0) { setCamera(to); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setCamera({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        // Zoom interpolates geometrically so the motion reads as one move.
        k: from.k * Math.pow(to.k / from.k, e),
      });
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(step);
  }, [stop]);

  /** Frame a rectangle of world space inside the container. */
  const fitTo = useCallback((rect: Rect, padding = 64, duration = 700, maxScale = 1.1) => {
    const el = containerRef.current;
    if (!el || rect.width <= 0 || rect.height <= 0) return;
    const w = el.clientWidth, h = el.clientHeight;
    const k = Math.min(
      maxScale,
      Math.max(MIN_K, Math.min((w - padding * 2) / rect.width, (h - padding * 2) / rect.height)),
    );
    animateTo({
      k,
      x: w / 2 - (rect.x + rect.width / 2) * k,
      y: h / 2 - (rect.y + rect.height / 2) * k,
    }, duration);
  }, [animateTo, containerRef]);

  /** Centre one world-space point, optionally changing zoom. */
  const centerOn = useCallback((x: number, y: number, k?: number, duration = 700) => {
    const el = containerRef.current;
    if (!el) return;
    const scale = k ?? cameraRef.current.k;
    animateTo({ k: scale, x: el.clientWidth / 2 - x * scale, y: el.clientHeight / 2 - y * scale }, duration);
  }, [animateTo, containerRef]);

  const zoomBy = useCallback((factor: number, originX?: number, originY?: number) => {
    const el = containerRef.current;
    if (!el) return;
    const c = cameraRef.current;
    const ox = originX ?? el.clientWidth / 2;
    const oy = originY ?? el.clientHeight / 2;
    const k = clampK(c.k * factor);
    const ratio = k / c.k;
    animateTo({ k, x: ox - (ox - c.x) * ratio, y: oy - (oy - c.y) * ratio }, 220);
  }, [animateTo, containerRef]);

  // ── Pointer / wheel / touch handling ─────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let dragging = false;
    let moved = false;
    let last = { x: 0, y: 0 };
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: { dist: number; k: number; cx: number; cy: number } | null = null;

    const rectOf = () => el.getBoundingClientRect();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stop();
      const r = rectOf();
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      const c = cameraRef.current;
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch arrives as ctrl+wheel.
        const k = clampK(c.k * Math.exp(-e.deltaY * 0.01));
        const ratio = k / c.k;
        setCamera({ k, x: ox - (ox - c.x) * ratio, y: oy - (oy - c.y) * ratio });
      } else if (e.shiftKey) {
        setCamera(clamp({ ...c, x: c.x - e.deltaY }));
      } else {
        const k = clampK(c.k * Math.exp(-e.deltaY * 0.0022));
        const ratio = k / c.k;
        setCamera({ k, x: ox - (ox - c.x) * ratio, y: oy - (oy - c.y) * ratio });
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true;
        moved = false;
        last = { x: e.clientX, y: e.clientY };
        setInteracting(true);
        stop();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const r = rectOf();
        pinchStart = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          k: cameraRef.current.k,
          cx: (a.x + b.x) / 2 - r.left,
          cy: (a.y + b.y) / 2 - r.top,
        };
        dragging = false;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size >= 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStart.dist > 0) {
          const c = cameraRef.current;
          const k = clampK(pinchStart.k * (dist / pinchStart.dist));
          const ratio = k / c.k;
          setCamera({
            k,
            x: pinchStart.cx - (pinchStart.cx - c.x) * ratio,
            y: pinchStart.cy - (pinchStart.cy - c.y) * ratio,
          });
        }
        moved = true;
        return;
      }

      if (!dragging) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      last = { x: e.clientX, y: e.clientY };
      const c = cameraRef.current;
      setCamera(clamp({ ...c, x: c.x + dx, y: c.y + dy }));
    };

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (pointers.size === 0) {
        dragging = false;
        setInteracting(false);
        // Suppress the click that follows a drag.
        if (moved) {
          const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
          el.addEventListener('click', swallow, { capture: true, once: true });
          setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPointer);
      window.removeEventListener('pointercancel', endPointer);
    };
  }, [containerRef, stop]);

  useEffect(() => stop, [stop]);

  return { camera, setCamera: set, animateTo, fitTo, centerOn, zoomBy, interacting, MIN_K, MAX_K };
}

const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));
const clamp = (c: Camera): Camera => ({ ...c, k: clampK(c.k) });
