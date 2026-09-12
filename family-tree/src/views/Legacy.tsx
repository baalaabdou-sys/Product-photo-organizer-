import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useArchive } from '../data/store';
import { Portrait } from '../components/Portrait';
import { fullName, firstName } from '../domain/relationships';
import { formatDate, lifespan, ageOf } from '../domain/dates';
import type { ID } from '../domain/types';
import { haptic } from '../lib/haptics';

/**
 * Legacy. The interface goes quiet: one photograph, the name, the years,
 * what was written down, and the branch that continues through them.
 * No symbolism beyond a single rule of gold.
 */
export function Legacy({ personId }: { personId: ID }) {
  const graph = useArchive((s) => s.graph);
  const stories = useArchive((s) => s.data.stories);
  const media = useArchive((s) => s.data.media);
  const setLegacy = useArchive((s) => s.setLegacy);
  const select = useArchive((s) => s.select);
  const go = useArchive((s) => s.go);

  const person = graph.person(personId);
  const descendantGens = useMemo(() => {
    if (!person) return [];
    const byDepth = new Map<number, ID[]>();
    for (const [id, d] of graph.descendants(person.id)) {
      const arr = byDepth.get(d) ?? [];
      arr.push(id);
      byDepth.set(d, arr);
    }
    return [...byDepth.entries()].sort((a, b) => a[0] - b[0]);
  }, [graph, person]);

  if (!person) return null;

  const personStories = stories.filter((s) => s.personIds.includes(person.id));
  const photos = media.filter((m) => m.tags.some((t) => t.personId === person.id));
  const age = ageOf(person.birthDate, person.deathDate);
  const partners = graph.partners(person.id);
  const parents = graph.parents(person.id);
  const close = () => { setLegacy(null); haptic('focus'); };
  const open = (id: ID) => { setLegacy(null); select(id); go('tree'); };

  return (
    <motion.div
      className="legacy-veil fixed inset-0 z-[78] overflow-y-auto overscroll-contain"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label={`Legacy — ${fullName(person)}`}
    >
      <button
        type="button"
        onClick={close}
        className="btn btn-ghost btn-sm fixed left-4 z-10"
        style={{ top: 'calc(var(--safe-t) + 14px)' }}
      >
        ← Back to the tree
      </button>

      <article className="mx-auto max-w-[40rem] px-6 pb-32" style={{ paddingTop: 'calc(var(--safe-t) + 84px)' }}>
        <motion.div
          className="flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <Portrait person={person} size={196} shape="arch" eager />

          <h1 className="display mt-9 text-[clamp(38px,10vw,66px)] leading-[1.02]">
            {person.firstName}
          </h1>
          <p className="label mt-2.5">{person.lastName}</p>

          <div className="rule-gold mt-7" style={{ width: 96 }} />

          <p className="serif mt-7 text-[clamp(18px,4.6vw,22px)] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
            {lifespan(person.birthDate, person.deathDate)}
          </p>
          {age !== null && (
            <p className="mt-1.5 text-[12.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
              {age} years
              {person.birthPlace && ` · born in ${person.birthPlace.name}`}
            </p>
          )}
        </motion.div>

        {person.biography && (
          <motion.div
            className="serif mt-14 space-y-5 text-[clamp(17px,4.4vw,19px)] leading-[1.8]"
            style={{ color: 'rgb(var(--c-ink-soft))' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {person.biography.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </motion.div>
        )}

        {(person.profession || person.interests?.length) && (
          <Quiet>
            {[
              person.profession && `Worked as ${person.profession.toLowerCase()}${person.company ? ` at ${person.company}` : ''}.`,
              person.interests?.length && `Loved ${person.interests.join(', ').toLowerCase()}.`,
              person.burialPlace && `Resting in ${person.burialPlace.name}${person.burialDate ? `, since ${formatDate(person.burialDate)}` : ''}.`,
            ].filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
          </Quiet>
        )}

        {photos.length > 0 && (
          <section className="mt-16">
            <p className="label mb-4 text-center">Photographs</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {photos.slice(0, 9).map((m) => (
                <div key={m.id} className="portrait-frame aspect-[4/5] rounded-[10px]">
                  {m.thumb || m.src ? <img src={m.thumb ?? m.src} alt={m.title ?? ''} loading="lazy" /> : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {personStories.length > 0 && (
          <section className="mt-16">
            <p className="label mb-6 text-center">What was remembered</p>
            <div className="space-y-12">
              {personStories.map((s) => (
                <div key={s.id}>
                  <h2 className="display text-[clamp(24px,5.6vw,32px)] leading-tight">{s.title}</h2>
                  {s.date && <p className="label mt-2">{formatDate(s.date)}</p>}
                  <div className="serif mt-4 space-y-4 text-[16.5px] leading-[1.76]" style={{ color: 'rgb(var(--c-ink-soft))' }}>
                    {s.body.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {(parents.length > 0 || partners.length > 0) && (
          <section className="mt-16 text-center">
            <p className="label mb-4">Their people</p>
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-2">
              {[...parents, ...partners].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => open(p.id)}
                  className="flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4"
                  style={{ border: '1px solid rgb(var(--c-rule))' }}
                >
                  <Portrait person={p} size={30} shape="circle" />
                  <span className="text-[12.5px]">{firstName(p)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {descendantGens.length > 0 && (
          <section className="mt-20">
            <div className="rule-gold mx-auto" style={{ width: 60 }} />
            <p className="serif mt-8 text-center text-[clamp(19px,4.8vw,24px)] italic" style={{ color: 'rgb(var(--c-muted))' }}>
              Their branch continues through
            </p>
            <div className="mt-10 space-y-9">
              {descendantGens.map(([depth, ids], gi) => (
                <motion.div
                  key={depth}
                  className="flex flex-wrap justify-center gap-x-4 gap-y-5"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: gi * 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  {ids.map((id) => {
                    const p = graph.person(id);
                    if (!p) return null;
                    const size = Math.max(38, 74 - depth * 10);
                    return (
                      <button key={id} type="button" onClick={() => open(id)} className="flex flex-col items-center">
                        <Portrait person={p} size={size} shape="arch" />
                        <span className="serif mt-2 text-[13px]">{p.firstName}</span>
                      </button>
                    );
                  })}
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-24 text-center">
          <button type="button" className="btn" onClick={close}>Return to the tree</button>
        </div>
      </article>
    </motion.div>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="serif mt-12 space-y-2 text-center text-[15.5px] italic leading-relaxed"
      style={{ color: 'rgb(var(--c-muted))' }}
    >
      {children}
    </div>
  );
}
