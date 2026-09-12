import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useArchive } from '../data/store';
import { buildTimeline, type TimelineEntry } from '../domain/stats';
import { Portrait } from '../components/Portrait';
import { useIsDesktop } from '../hooks/useMedia';
import { Centered } from './Generations';
import { haptic } from '../lib/haptics';

/**
 * The family timeline. Horizontal and cinematic on wide screens; a vertical
 * reading column on phones, where horizontal scrolling is the wrong gesture.
 */
export function Timeline() {
  const graph = useArchive((s) => s.graph);
  const data = useArchive((s) => s.data);
  const select = useArchive((s) => s.select);
  const go = useArchive((s) => s.go);
  const desktop = useIsDesktop();

  const entries = useMemo(() => buildTimeline(graph, data), [graph, data]);
  const [filter, setFilter] = useState<'all' | TimelineEntry['kind']>('all');

  const shown = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.kind === filter)),
    [entries, filter],
  );

  const jump = (id: string) => { select(id); go('tree'); haptic('focus'); };

  if (!entries.length) {
    return (
      <Centered>
        <div style={{ maxWidth: '26rem' }}>
          <p className="serif text-[17px] italic" style={{ color: 'rgb(var(--c-muted))' }}>
            Nothing in the archive carries a date yet. Add a birth year to someone and
            the family's years will start to appear here.
          </p>
        </div>
      </Centered>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-5 pt-6 sm:px-8">
        <p className="label">The family through the years</p>
        <h1 className="display mt-2 text-[clamp(32px,8vw,54px)]">Timeline</h1>
        <div className="scroll-x mt-5 flex gap-1.5 pb-1" style={{ scrollSnapType: 'none' }}>
          {([
            ['all', 'Everything'], ['birth', 'Births'], ['marriage', 'Marriages'],
            ['death', 'Remembered'], ['event', 'Moments'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className="chip"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {desktop
        ? <HorizontalTimeline entries={shown} onJump={jump} />
        : <VerticalTimeline entries={shown} onJump={jump} />}
    </div>
  );
}

function HorizontalTimeline({
  entries, onJump,
}: { entries: TimelineEntry[]; onJump: (id: string) => void }) {
  const graph = useArchive((s) => s.graph);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative mt-8 min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
      style={{ scrollbarWidth: 'thin' }}
      onWheel={(e) => {
        // Vertical wheel scrolls the timeline sideways — the natural gesture here.
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && ref.current) {
          ref.current.scrollLeft += e.deltaY;
        }
      }}
    >
      <div className="relative flex h-full items-center gap-0 px-[12vw]" style={{ width: 'max-content' }}>
        <div
          aria-hidden="true"
          className="absolute left-0 right-0"
          style={{ top: '50%', height: 1, background: 'rgb(var(--c-rule))' }}
        />
        {entries.map((e, i) => {
          const person = graph.person(e.personIds[0]);
          const above = i % 2 === 0;
          return (
            <motion.article
              key={e.id}
              className="relative h-full shrink-0"
              style={{ width: 268 }}
              initial={{ opacity: 0, y: above ? -14 : 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Percentages on top/bottom resolve against this article's own
                  height, which is what keeps every card clear of the axis. */}
              <div
                className="absolute inset-x-0 flex flex-col items-center px-5 text-center"
                style={above ? { bottom: 'calc(50% + 30px)' } : { top: 'calc(50% + 30px)' }}
              >
                <Card entry={e} person={person} onJump={onJump} />
              </div>
              <span
                aria-hidden="true"
                className="absolute left-1/2 rounded-full"
                style={{
                  top: 'calc(50% - 3.5px)',
                  marginLeft: -3.5,
                  width: 7, height: 7,
                  background: e.kind === 'death' ? 'rgb(var(--c-faint))' : 'rgb(var(--c-gold))',
                  boxShadow: '0 0 0 4px rgb(var(--c-paper))',
                }}
              />
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function VerticalTimeline({
  entries, onJump,
}: { entries: TimelineEntry[]; onJump: (id: string) => void }) {
  const graph = useArchive((s) => s.graph);
  return (
    <div
      className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
      style={{ paddingBottom: 'calc(var(--safe-b) + var(--nav-h) + 40px)' }}
    >
      <ol className="relative mx-auto max-w-[34rem] pl-6">
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-[3px] top-2 w-px"
          style={{ background: 'rgb(var(--c-rule))' }}
        />
        {entries.map((e, i) => {
          const person = graph.person(e.personIds[0]);
          return (
            <motion.li
              key={e.id}
              className="relative pb-8"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.02, 0.3), ease: [0.22, 1, 0.36, 1] }}
            >
              <span
                aria-hidden="true"
                className="absolute rounded-full"
                style={{
                  left: -4.5, top: 8, width: 7, height: 7,
                  background: e.kind === 'death' ? 'rgb(var(--c-faint))' : 'rgb(var(--c-gold))',
                  boxShadow: '0 0 0 4px rgb(var(--c-paper))',
                }}
              />
              <Card entry={e} person={person} onJump={onJump} align="left" />
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

function Card({
  entry, person, onJump, align = 'center',
}: {
  entry: TimelineEntry;
  person?: ReturnType<ReturnType<typeof useArchive.getState>['graph']['person']>;
  onJump: (id: string) => void;
  align?: 'center' | 'left';
}) {
  return (
    <div className={align === 'left' ? 'text-left' : 'text-center'}>
      <p className="serif tabular-nums text-[clamp(24px,5.5vw,34px)] leading-none" style={{ color: 'rgb(var(--c-gold))' }}>
        {entry.sortYear}
      </p>
      {entry.dateLabel !== String(entry.sortYear) && (
        <p className="label mt-1.5">{entry.dateLabel}</p>
      )}
      <h3 className="serif mt-2.5 text-[clamp(16px,4vw,19px)] leading-snug">{entry.title}</h3>
      {entry.detail && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'rgb(var(--c-muted))' }}>
          {entry.detail}
        </p>
      )}
      {person && (
        <button
          type="button"
          onClick={() => onJump(person.id)}
          className={`mt-3 inline-flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3.5 transition-colors ${align === 'left' ? '' : 'mx-auto'}`}
          style={{ border: '1px solid rgb(var(--c-rule))' }}
        >
          <Portrait person={person} size={26} shape="circle" />
          <span className="text-[11.5px]" style={{ color: 'rgb(var(--c-muted))' }}>Jump to {person.firstName}</span>
        </button>
      )}
    </div>
  );
}
