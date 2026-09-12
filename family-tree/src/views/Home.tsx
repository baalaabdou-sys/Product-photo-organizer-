import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useArchive } from '../data/store';
import { familyStats, todayNotes, upcoming, discoverPerson, buildTimeline } from '../domain/stats';
import { Portrait } from './../components/Portrait';
import { fullName, firstName } from '../domain/relationships';
import { lifespan, formatDate, relativeDays } from '../domain/dates';
import { riseVariants } from '../lib/motion';
import { DEMO_NOTICE } from '../data/demo';
import type { ID } from '../domain/types';
import { haptic } from '../lib/haptics';

export function Home() {
  const graph = useArchive((s) => s.graph);
  const data = useArchive((s) => s.data);
  const go = useArchive((s) => s.go);
  const select = useArchive((s) => s.select);
  const hasDemo = useArchive((s) => s.hasDemo);
  const meId = useArchive((s) => s.meId);

  const stats = useMemo(() => familyStats(graph, data), [graph, data]);
  const notes = useMemo(() => todayNotes(graph, data), [graph, data]);
  const events = useMemo(() => upcoming(graph), [graph]);
  const timeline = useMemo(() => buildTimeline(graph, data), [graph, data]);
  const [discovery, setDiscovery] = useState(() => discoverPerson(graph, data, meId));

  const featured = data.stories[0];
  const recent = useMemo(
    () => [...data.stories].sort((a, b) => b.metadata.createdAt - a.metadata.createdAt).slice(0, 3),
    [data.stories],
  );

  const open = (id: ID) => { select(id); go('tree'); haptic('focus'); };

  if (!stats.people) return <HomeEmpty />;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 sm:px-8">
      {hasDemo && (
        <div
          className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[11px] px-4 py-2.5 text-[12px]"
          style={{ background: 'rgb(var(--c-paper-3))', color: 'rgb(var(--c-muted))' }}
          role="note"
        >
          <span>{DEMO_NOTICE}</span>
          <button
            type="button"
            className="-my-2 py-2 underline underline-offset-2"
            onClick={() => go('settings')}
          >
            Import your family
          </button>
        </div>
      )}

      {/* ── Masthead ───────────────────────────────────── */}
      <motion.header
        className="pt-[clamp(40px,9vh,88px)] text-center"
        initial="hidden" animate="show" variants={riseVariants}
      >
        <p className="label">The family archive</p>
        <h1 className="display mt-3 text-[clamp(42px,11vw,92px)]">Abderrahmane</h1>
        <div className="rule-gold mx-auto mt-5" style={{ maxWidth: 180 }} />
        <p className="mt-5 text-[13px] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
          {stats.people} {stats.people === 1 ? 'person' : 'people'}
          {stats.generations > 0 && <> · {stats.generations} {stats.generations === 1 ? 'generation' : 'generations'}</>}
          {stats.earliestYear !== null && <> · from {stats.earliestYear}</>}
        </p>
      </motion.header>

      {/* ── Ways in ────────────────────────────────────── */}
      <nav className="mt-[clamp(34px,6vh,58px)]" aria-label="Explore the archive">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {([
            ['tree', 'Family Tree', 'Every branch'],
            ['generations', 'Generations', 'One layer at a time'],
            ['timeline', 'Timeline', 'The family through the years'],
            ['archive', 'Archive', 'Photographs and stories'],
          ] as const).map(([view, title, sub], i) => (
            <motion.button
              key={view}
              type="button"
              custom={i}
              initial="hidden" animate="show" variants={riseVariants}
              onClick={() => go(view)}
              className="group rounded-[14px] px-4 py-5 text-left transition-transform duration-500 ease-editorial hover:-translate-y-[3px]"
              style={{ background: 'rgb(var(--c-paper-2))', border: '1px solid rgb(var(--c-rule) / 0.75)' }}
            >
              <span className="serif block text-[clamp(16px,3.6vw,19px)] leading-tight">{title}</span>
              <span className="mt-1 block text-[11px]" style={{ color: 'rgb(var(--c-faint))' }}>{sub}</span>
            </motion.button>
          ))}
        </div>
      </nav>

      {/* ── Today ──────────────────────────────────────── */}
      {notes.length > 0 && (
        <Block title="Today in our family">
          <div className="space-y-4">
            {notes.slice(0, 4).map((n) => {
              const p = graph.person(n.personIds[0]);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => p && open(p.id)}
                  className="flex w-full items-center gap-4 text-left"
                >
                  {p && <Portrait person={p} size={52} shape="arch" />}
                  <span>
                    <span className="serif block text-[clamp(17px,4vw,21px)] leading-snug">{n.headline}</span>
                    {n.detail && (
                      <span className="mt-0.5 block text-[12.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
                        {n.detail}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Block>
      )}

      {/* ── Featured story ─────────────────────────────── */}
      {featured && (
        <Block title="A story from the archive">
          <button type="button" onClick={() => go('archive')} className="block w-full text-left">
            <h3 className="display text-[clamp(26px,6vw,40px)] leading-[1.06]">{featured.title}</h3>
            <p className="label mt-3">
              {[formatDate(featured.date), featured.place?.name].filter(Boolean).join(' · ')}
            </p>
            <p
              className="serif mt-4 text-[clamp(15px,3.8vw,17.5px)] leading-[1.72]"
              style={{ color: 'rgb(var(--c-ink-soft))', maxWidth: '38rem' }}
            >
              {featured.body.split('\n')[0]}
            </p>
            <span className="mt-4 inline-block text-[12px]" style={{ color: 'rgb(var(--c-gold))' }}>
              Read it →
            </span>
          </button>
        </Block>
      )}

      {/* ── Oldest known ancestor ──────────────────────── */}
      {stats.oldestAncestor && (
        <Block title="Our oldest known ancestor">
          <button
            type="button"
            onClick={() => open(stats.oldestAncestor!.id)}
            className="flex items-center gap-5 text-left"
          >
            <Portrait person={stats.oldestAncestor} size={88} shape="arch" />
            <span>
              <span className="serif block text-[clamp(22px,5vw,30px)] leading-tight">
                {fullName(stats.oldestAncestor)}
              </span>
              <span className="mt-1 block text-[12.5px] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
                {lifespan(stats.oldestAncestor.birthDate, stats.oldestAncestor.deathDate)}
                {stats.oldestAncestor.birthPlace && ` · ${stats.oldestAncestor.birthPlace.name}`}
              </span>
              <span className="mt-2 block text-[12px]" style={{ color: 'rgb(var(--c-faint))' }}>
                Everyone in this archive descends from, or married into, the generation that begins here.
              </span>
            </span>
          </button>
        </Block>
      )}

      {/* ── Through the years ──────────────────────────── */}
      {timeline.length > 3 && (
        <Block title="The family through the years">
          <YearRibbon entries={timeline} onPick={() => go('timeline')} />
        </Block>
      )}

      {/* ── Upcoming ───────────────────────────────────── */}
      {events.length > 0 && (
        <Block title="Coming up">
          <ul className="space-y-0">
            {events.map((e, i) => {
              const p = graph.person(e.personIds[0]);
              return (
                <li key={e.id} style={{ borderTop: i ? '1px solid rgb(var(--c-rule) / 0.55)' : 'none' }}>
                  <button
                    type="button"
                    onClick={() => p && open(p.id)}
                    className="flex w-full items-center gap-4 py-3 text-left"
                  >
                    {p && <Portrait person={p} size={40} shape="circle" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">{e.label}</span>
                      <span className="block text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>{e.detail}</span>
                    </span>
                    <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: 'rgb(var(--c-gold))' }}>
                      {relativeDays(e.days)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      {/* ── Discover a relative ────────────────────────── */}
      {discovery && (
        <Block title="Discover a relative">
          <div
            className="rounded-[15px] p-6"
            style={{ background: 'rgb(var(--c-paper-2))', border: '1px solid rgb(var(--c-rule) / 0.7)' }}
          >
            <motion.div key={discovery.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="flex items-start gap-5">
                <Portrait person={discovery} size={72} shape="arch" />
                <div className="min-w-0">
                  <p className="serif text-[clamp(20px,4.6vw,26px)] leading-tight">{fullName(discovery)}</p>
                  <p className="mt-1 text-[12px] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
                    {[lifespan(discovery.birthDate, discovery.deathDate), discovery.profession, discovery.birthPlace?.name]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              {discovery.biography && (
                <p className="serif mt-4 text-[15px] leading-[1.7]" style={{ color: 'rgb(var(--c-ink-soft))' }}>
                  {discovery.biography}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => open(discovery.id)}>
                  See {firstName(discovery)} in the tree
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setDiscovery(discoverPerson(graph, data, discovery.id))}
                >
                  Someone else
                </button>
              </div>
            </motion.div>
          </div>
        </Block>
      )}

      {/* ── Recently added ─────────────────────────────── */}
      {recent.length > 0 && (
        <Block title="Recently added memories">
          <div className="space-y-3">
            {recent.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go('archive')}
                className="block w-full py-1 text-left"
              >
                <span className="serif block text-[17px] leading-snug">{s.title}</span>
                <span className="block text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
                  {[formatDate(s.date), s.personIds.map((id) => graph.person(id)?.firstName).filter(Boolean).slice(0, 3).join(', ')]
                    .filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </Block>
      )}

      <div className="h-24" />
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      className="mt-[clamp(40px,7vh,72px)]"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 className="label mb-5">{title}</h2>
      {children}
    </motion.section>
  );
}

/** A slim decade ribbon: how full each decade of the family is. */
function YearRibbon({
  entries, onPick,
}: { entries: ReturnType<typeof buildTimeline>; onPick: () => void }) {
  const decades = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of entries) {
      const d = Math.floor(e.sortYear / 10) * 10;
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [entries]);
  const max = Math.max(...decades.map(([, n]) => n), 1);

  return (
    <button type="button" onClick={onPick} className="block w-full text-left" aria-label="Open the family timeline">
      <div className="flex items-end gap-[3px]" style={{ height: 74 }}>
        {decades.map(([d, n]) => (
          <span key={d} className="group relative flex-1" style={{ minWidth: 6 }}>
            <span
              className="block w-full rounded-t-[2px] transition-colors"
              style={{
                height: Math.max(3, (n / max) * 66),
                background: 'rgb(var(--c-gold) / 0.42)',
              }}
            />
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] tabular-nums" style={{ color: 'rgb(var(--c-faint))' }}>
        <span>{decades[0]?.[0]}s</span>
        <span>{entries.length} recorded moments</span>
        <span>{decades[decades.length - 1]?.[0]}s</span>
      </div>
    </button>
  );
}

function HomeEmpty() {
  const go = useArchive((s) => s.go);
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-[34rem] place-items-center px-6 text-center">
      <div>
        <p className="label">The family archive</p>
        <h1 className="display mt-3 text-[clamp(38px,10vw,64px)]">Abderrahmane</h1>
        <div className="rule-gold mx-auto mt-5" style={{ maxWidth: 150 }} />
        <p className="serif mt-6 text-[17px] leading-relaxed" style={{ color: 'rgb(var(--c-muted))' }}>
          The archive is empty. Bring the family in from a GEDCOM file — the format
          FamilyEcho and every other genealogy tool exports — and everything here
          will build itself around them.
        </p>
        <button type="button" className="btn btn-primary mt-7" onClick={() => go('settings')}>
          Import the family
        </button>
      </div>
    </div>
  );
}
