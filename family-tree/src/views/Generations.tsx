import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useArchive } from '../data/store';
import { generationBands } from '../domain/stats';
import { Portrait } from '../components/Portrait';
import { fullName } from '../domain/relationships';
import { lifespan } from '../domain/dates';
import { isDeceased } from '../domain/graph';
import { haptic } from '../lib/haptics';

/**
 * Generations: the family one layer at a time, swiped horizontally.
 * Portraits are laid out in a loose editorial composition rather than a grid.
 */
export function Generations() {
  const graph = useArchive((s) => s.graph);
  const select = useArchive((s) => s.select);
  const go = useArchive((s) => s.go);
  const bands = useMemo(() => generationBands(graph), [graph]);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Keep the header in step with the swipe.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setIndex((prev) => {
          if (prev !== i) haptic('generation');
          return i;
        });
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [bands.length]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  if (!bands.length) {
    return (
      <Centered>
        <p className="serif text-[17px] italic" style={{ color: 'rgb(var(--c-muted))' }}>
          There is no one in the archive to arrange into generations yet.
        </p>
      </Centered>
    );
  }

  const band = bands[Math.min(index, bands.length - 1)];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-5 pt-6 text-center sm:px-8">
        <p className="label">Generations</p>
        <motion.h1
          key={band.index}
          className="display mt-2 text-[clamp(32px,8vw,56px)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {band.label}
        </motion.h1>
        <p className="mt-2 text-[12.5px] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
          {band.from !== null
            ? `${band.from}${band.to !== null && band.to !== band.from ? `–${band.to}` : ''} · `
            : ''}
          {band.people.length} {band.people.length === 1 ? 'person' : 'people'}
        </p>

        <div className="mt-5 flex items-center justify-center gap-1.5" role="tablist" aria-label="Choose a generation">
          {bands.map((b, i) => (
            <button
              key={b.index}
              role="tab"
              aria-selected={i === index}
              aria-label={b.label}
              onClick={() => goTo(i)}
              className="rounded-full transition-all duration-400 ease-editorial"
              style={{
                height: 4,
                width: i === index ? 30 : 12,
                background: i === index ? 'rgb(var(--c-gold))' : 'rgb(var(--c-rule))',
              }}
            />
          ))}
        </div>
      </header>

      <div
        ref={trackRef}
        className="scroll-x mt-6 flex min-h-0 flex-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {bands.map((b) => (
          <section
            key={b.index}
            className="h-full w-full shrink-0 overflow-y-auto overscroll-contain px-5 sm:px-8"
            style={{ scrollSnapAlign: 'start', paddingBottom: 'calc(var(--safe-b) + var(--nav-h) + 32px)' }}
            aria-label={b.label}
          >
            <Composition people={b.people} onPick={(id) => { select(id); go('tree'); haptic('focus'); }} />
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * A staggered composition — portraits vary in size and vertical offset so the
 * page reads like a spread rather than a contact sheet.
 */
function Composition({
  people, onPick,
}: { people: ReturnType<typeof generationBands>[number]['people']; onPick: (id: string) => void }) {
  return (
    <div className="mx-auto flex max-w-[880px] flex-wrap items-start justify-center gap-x-[clamp(14px,4vw,40px)] gap-y-[clamp(22px,5vw,46px)] pt-2">
      {people.map((p, i) => {
        // A deterministic rhythm: every third portrait is larger and dropped.
        const big = i % 3 === 1;
        const drop = (i % 4) * 9;
        return (
          <motion.button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            className="group flex flex-col items-center text-center"
            style={{ marginTop: drop, width: big ? 'clamp(112px,26vw,150px)' : 'clamp(92px,21vw,122px)' }}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.045, 0.6), duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="transition-transform duration-500 ease-editorial group-hover:-translate-y-[5px] group-focus-visible:-translate-y-[5px]">
              <Portrait person={p} size={big ? 128 : 100} shape="arch" />
            </span>
            <span className="serif mt-3 block text-[clamp(15px,3.6vw,18px)] leading-tight">{p.firstName}</span>
            <span className="mt-0.5 block text-[9.5px] uppercase" style={{ letterSpacing: '0.15em', color: 'rgb(var(--c-faint))' }}>
              {p.lastName}
            </span>
            {lifespan(p.birthDate, p.deathDate) && (
              <span className="mt-1 block text-[10.5px] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
                {lifespan(p.birthDate, p.deathDate)}
              </span>
            )}
            <span className="sr-only">{fullName(p)}{isDeceased(p) ? ', deceased' : ''}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center px-6 text-center">{children}</div>;
}
