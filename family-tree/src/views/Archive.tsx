import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useArchive } from '../data/store';
import { Portrait } from '../components/Portrait';
import { formatDate, decadeOf } from '../domain/dates';
import { fullName } from '../domain/relationships';
import type { ID, Media, Story } from '../domain/types';
import { canEdit } from '../lib/privacy';
import { StoryEditor } from '../components/StoryEditor';
import { PhotoViewer } from '../components/PhotoViewer';
import { AddMemory } from '../components/AddMemory';
import { Empty } from '../components/PersonPanel';
import { haptic } from '../lib/haptics';

type Filter = { person: ID | 'all'; decade: string | 'all'; kind: 'all' | 'photo' | 'document' | 'audio' | 'video' | 'story' };

/**
 * The Archive: the family's collection, presented the way a museum presents
 * one — grouped, captioned, and given room — rather than as a file list.
 */
export function Archive() {
  const graph = useArchive((s) => s.graph);
  const data = useArchive((s) => s.data);
  const role = useArchive((s) => s.role);
  const select = useArchive((s) => s.select);
  const go = useArchive((s) => s.go);

  const [filter, setFilter] = useState<Filter>({ person: 'all', decade: 'all', kind: 'all' });
  const [readingId, setReadingId] = useState<ID | null>(null);
  const [viewing, setViewing] = useState<ID | null>(null);
  const [writing, setWriting] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);

  const decades = useMemo(() => {
    const set = new Set<string>();
    for (const m of data.media) { const d = decadeOf(m.date); if (d) set.add(d); }
    for (const s of data.stories) { const d = decadeOf(s.date); if (d) set.add(d); }
    return [...set].sort();
  }, [data.media, data.stories]);

  const peopleWithItems = useMemo(() => {
    const ids = new Set<ID>();
    for (const m of data.media) for (const t of m.tags) ids.add(t.personId);
    for (const s of data.stories) for (const id of s.personIds) ids.add(id);
    return [...ids].map((id) => graph.person(id)).filter(Boolean).sort((a, b) => a!.firstName.localeCompare(b!.firstName));
  }, [data.media, data.stories, graph]);

  const stories = useMemo(
    () => data.stories.filter((s) => matchesStory(s, filter)),
    [data.stories, filter],
  );
  const media = useMemo(
    () => data.media.filter((m) => matchesMedia(m, filter)),
    [data.media, filter],
  );

  const reading = readingId ? data.stories.find((s) => s.id === readingId) : undefined;
  const nothing = !stories.length && !media.length;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 sm:px-8">
      <header className="pt-6">
        <p className="label">The family's collection</p>
        <h1 className="display mt-2 text-[clamp(32px,8vw,54px)]">Archive</h1>
        <p className="mt-3 text-[12.5px] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
          {data.stories.length} {data.stories.length === 1 ? 'story' : 'stories'}
          {data.media.length > 0 && ` · ${data.media.length} items`}
        </p>
      </header>

      <div className="mt-6 space-y-2">
        <FilterRow label="Anyone" active={filter.person === 'all'} onAll={() => setFilter({ ...filter, person: 'all' })}>
          {peopleWithItems.map((p) => (
            <button
              key={p!.id}
              type="button"
              className="chip"
              aria-pressed={filter.person === p!.id}
              onClick={() => setFilter({ ...filter, person: filter.person === p!.id ? 'all' : p!.id })}
            >
              {fullName(p!)}
            </button>
          ))}
        </FilterRow>

        {decades.length > 0 && (
          <FilterRow label="Any decade" active={filter.decade === 'all'} onAll={() => setFilter({ ...filter, decade: 'all' })}>
            {decades.map((d) => (
              <button
                key={d}
                type="button"
                className="chip"
                aria-pressed={filter.decade === d}
                onClick={() => setFilter({ ...filter, decade: filter.decade === d ? 'all' : d })}
              >
                {d}
              </button>
            ))}
          </FilterRow>
        )}
      </div>

      {nothing ? (
        <div className="mt-12">
          <Empty
            line={
              filter.person !== 'all' || filter.decade !== 'all'
                ? 'Nothing in the collection matches those filters yet.'
                : 'Nothing has been preserved in the archive yet — no photographs, no documents, no stories.'
            }
            action={canEdit(role) ? { label: 'Add to our family history', run: () => setAddingMemory(true) } : undefined}
          />
        </div>
      ) : (
        <>
          {media.length > 0 && (
            <section className="mt-10">
              <h2 className="label mb-4">Photographs and documents</h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {media.map((m, i) => (
                  <motion.button
                    key={m.id}
                    type="button"
                    onClick={() => { setViewing(m.id); haptic('focus'); }}
                    className="group block text-left"
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: Math.min(i * 0.03, 0.4), ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span
                      className="portrait-frame block aspect-[4/5] rounded-[10px] transition-transform duration-500 ease-editorial group-hover:-translate-y-[3px]"
                    >
                      {m.thumb || m.src
                        ? <img src={m.thumb ?? m.src} alt={m.title ?? 'Family photograph'} loading="lazy" decoding="async" />
                        : <span className="grid h-full w-full place-items-center serif text-[13px]" style={{ color: 'rgb(var(--c-faint))' }}>
                            {m.kind}
                          </span>}
                    </span>
                    <span className="mt-2 block truncate text-[12.5px]">{m.title ?? 'Untitled'}</span>
                    <span className="block text-[10.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
                      {[formatDate(m.date), m.place?.name].filter(Boolean).join(' · ')}
                    </span>
                  </motion.button>
                ))}
              </div>
            </section>
          )}

          {stories.length > 0 && (
            <section className="mt-12">
              <h2 className="label mb-5">Stories</h2>
              <div className="space-y-0">
                {stories.map((s, i) => (
                  <motion.button
                    key={s.id}
                    type="button"
                    onClick={() => setReadingId(s.id)}
                    className="group block w-full py-6 text-left"
                    style={{ borderTop: i ? '1px solid rgb(var(--c-rule) / 0.6)' : 'none' }}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="label">{[formatDate(s.date), s.place?.name].filter(Boolean).join(' · ')}</p>
                    <h3 className="display mt-2 text-[clamp(23px,5.4vw,34px)] leading-[1.08] transition-opacity group-hover:opacity-75">
                      {s.title}
                    </h3>
                    <p
                      className="serif mt-3 line-clamp-2 text-[15px] leading-[1.7]"
                      style={{ color: 'rgb(var(--c-muted))', maxWidth: '40rem' }}
                    >
                      {s.body.split('\n')[0]}
                    </p>
                    <span className="mt-3 flex flex-wrap items-center gap-1.5">
                      {s.personIds.slice(0, 5).map((id) => {
                        const p = graph.person(id);
                        return p ? <Portrait key={id} person={p} size={24} shape="circle" /> : null;
                      })}
                    </span>
                  </motion.button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {canEdit(role) && (
        <div className="mt-14 text-center">
          <button type="button" className="btn" onClick={() => setAddingMemory(true)}>
            Add to our family history
          </button>
        </div>
      )}

      <div className="h-28" />

      {/* ── Reading a story ─────────────────────────────── */}
      <AnimatePresence>
        {reading && (
          <motion.div
            className="fixed inset-0 z-[75] overflow-y-auto overscroll-contain"
            style={{ background: 'rgb(var(--c-paper))' }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={reading.title}
          >
            <article
              className="mx-auto max-w-[38rem] px-6 pb-24"
              style={{ paddingTop: 'calc(var(--safe-t) + 72px)' }}
            >
              <button
                type="button"
                onClick={() => setReadingId(null)}
                className="btn btn-ghost btn-sm fixed left-4 z-10"
                style={{ top: 'calc(var(--safe-t) + 14px)' }}
              >
                ← Back to the archive
              </button>

              <p className="label">{[formatDate(reading.date), reading.place?.name].filter(Boolean).join(' · ')}</p>
              <h1 className="display mt-3 text-[clamp(32px,8vw,52px)] leading-[1.04]">{reading.title}</h1>
              <div className="rule-gold mt-7" style={{ maxWidth: 120 }} />

              <div className="serif mt-8 space-y-5 text-[clamp(17px,4.4vw,19px)] leading-[1.78]" style={{ color: 'rgb(var(--c-ink-soft))' }}>
                {reading.body.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              {reading.personIds.length > 0 && (
                <footer className="mt-12 hairline pt-7">
                  <p className="label mb-3">In this story</p>
                  <div className="flex flex-wrap gap-x-1 gap-y-1">
                    {reading.personIds.map((id) => {
                      const p = graph.person(id);
                      if (!p) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => { setReadingId(null); select(id); go('tree'); }}
                          className="flex items-center gap-2.5 rounded-[10px] py-1.5 pl-1.5 pr-3"
                        >
                          <Portrait person={p} size={32} shape="circle" />
                          <span className="text-[13px]">{fullName(p)}</span>
                        </button>
                      );
                    })}
                  </div>
                </footer>
              )}
            </article>
          </motion.div>
        )}
      </AnimatePresence>

      {viewing && <PhotoViewer mediaId={viewing} onClose={() => setViewing(null)} />}
      {writing && <StoryEditor onClose={() => setWriting(false)} />}
      {addingMemory && <AddMemory onClose={() => setAddingMemory(false)} onWriteStory={() => { setAddingMemory(false); setWriting(true); }} />}
    </div>
  );
}

function FilterRow({
  label, active, onAll, children,
}: { label: string; active: boolean; onAll: () => void; children: React.ReactNode }) {
  return (
    <div className="scroll-x flex gap-1.5 pb-1" style={{ scrollSnapType: 'none' }}>
      <button type="button" className="chip" aria-pressed={active} onClick={onAll}>{label}</button>
      {children}
    </div>
  );
}

const matchesStory = (s: Story, f: Filter) =>
  (f.kind === 'all' || f.kind === 'story')
  && (f.person === 'all' || s.personIds.includes(f.person))
  && (f.decade === 'all' || decadeOf(s.date) === f.decade);

const matchesMedia = (m: Media, f: Filter) =>
  (f.kind === 'all' || f.kind === m.kind)
  && (f.person === 'all' || m.tags.some((t) => t.personId === f.person))
  && (f.decade === 'all' || decadeOf(m.date) === f.decade);


