import { useMemo, useState } from 'react';
import { useArchive } from '../data/store';
import { fullName } from '../domain/relationships';
import { lifespan, formatDate } from '../domain/dates';
import { generationBands, familyStats } from '../domain/stats';
import type { ID, Person } from '../domain/types';

type Scope = 'all' | 'ancestors' | 'descendants' | 'branch';

/**
 * A print representation built from the data directly — not a screenshot of
 * the canvas. Typeset for paper: no controls, no colour dependency, real
 * page breaks.
 */
export function PrintView() {
  const graph = useArchive((s) => s.graph);
  const data = useArchive((s) => s.data);
  const meId = useArchive((s) => s.meId);
  const selectedId = useArchive((s) => s.selectedId);
  const go = useArchive((s) => s.go);

  const [scope, setScope] = useState<Scope>('all');
  const [rootId, setRootId] = useState<ID | null>(selectedId ?? meId);
  const [withStories, setWithStories] = useState(false);

  const stats = useMemo(() => familyStats(graph, data), [graph, data]);

  const people = useMemo<Person[]>(() => {
    const all = [...graph.people.values()];
    if (scope === 'all' || !rootId) return all;
    const root = graph.person(rootId);
    if (!root) return all;
    if (scope === 'ancestors') {
      return [root, ...[...graph.ancestors(rootId).keys()].map((id) => graph.person(id)!)].filter(Boolean);
    }
    if (scope === 'descendants') {
      return [root, ...[...graph.descendants(rootId).keys()].map((id) => graph.person(id)!)].filter(Boolean);
    }
    const ids = new Set<ID>([rootId, ...graph.ancestors(rootId).keys(), ...graph.descendants(rootId).keys()]);
    for (const id of [...ids]) for (const p of graph.partners(id)) ids.add(p.id);
    return [...ids].map((id) => graph.person(id)!).filter(Boolean);
  }, [graph, scope, rootId]);

  const included = useMemo(() => new Set(people.map((p) => p.id)), [people]);
  const bands = useMemo(
    () => generationBands(graph).map((b) => ({ ...b, people: b.people.filter((p) => included.has(p.id)) }))
      .filter((b) => b.people.length),
    [graph, included],
  );

  const stories = withStories
    ? data.stories.filter((s) => s.personIds.some((id) => included.has(id)))
    : [];

  const everyone = useMemo(
    () => [...graph.people.values()].sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [graph],
  );

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 sm:px-8">
      {/* Controls — never printed. */}
      <div className="no-print pb-8 pt-6">
        <button type="button" className="btn btn-ghost btn-sm -ml-3" onClick={() => go('settings')}>
          ← Back to settings
        </button>
        <h1 className="display mt-4 text-[clamp(28px,7vw,44px)]">Print the family</h1>
        <p className="mt-3 text-[13.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
          Choose what to include, then print. Your browser's print dialog can save it as a PDF.
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {([
            ['all', 'Whole tree'], ['ancestors', 'Ancestors of…'],
            ['descendants', 'Descendants of…'], ['branch', 'Their whole branch'],
          ] as const).map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={scope === k} onClick={() => setScope(k)}>
              {l}
            </button>
          ))}
        </div>

        {scope !== 'all' && (
          <select
            className="field mt-3"
            style={{ maxWidth: 320 }}
            value={rootId ?? ''}
            onChange={(e) => setRootId(e.target.value || null)}
          >
            <option value="">Choose a person…</option>
            {everyone.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </select>
        )}

        <label className="mt-4 flex items-center gap-2.5 text-[13px]">
          <input type="checkbox" checked={withStories} onChange={(e) => setWithStories(e.target.checked)} />
          <span style={{ color: 'rgb(var(--c-muted))' }}>Include the stories</span>
        </label>

        <div className="mt-6 flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            Print · {people.length} {people.length === 1 ? 'person' : 'people'}
          </button>
        </div>
        <div className="rule-gold mt-8" />
      </div>

      {/* The printed document. */}
      <article className="print-doc pb-24">
        <header className="text-center">
          <p className="label">The family archive</p>
          <h1 className="display mt-3 text-[clamp(38px,9vw,64px)]">Abderrahmane</h1>
          <div className="rule-gold mx-auto mt-5" style={{ maxWidth: 160 }} />
          <p className="mt-5 text-[12.5px] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
            {people.length} {people.length === 1 ? 'person' : 'people'} · {bands.length} generations
            {stats.earliestYear !== null && ` · from ${stats.earliestYear}`}
          </p>
          <p className="mt-1.5 text-[11px]" style={{ color: 'rgb(var(--c-faint))' }}>
            Printed {new Date().toLocaleDateString()}
          </p>
        </header>

        {bands.map((band) => (
          <section key={band.index} className="mt-12" style={{ breakInside: 'avoid' }}>
            <h2 className="serif text-[22px]">{band.label}</h2>
            <p className="label mt-1">
              {band.from !== null ? `${band.from}${band.to && band.to !== band.from ? `–${band.to}` : ''} · ` : ''}
              {band.people.length} {band.people.length === 1 ? 'person' : 'people'}
            </p>
            <div className="rule-gold mt-3" style={{ maxWidth: 90 }} />

            <ul className="mt-5 space-y-4">
              {band.people.map((p) => {
                const parents = graph.parents(p.id).filter((x) => included.has(x.id));
                const partners = graph.partners(p.id);
                const children = graph.children(p.id).filter((x) => included.has(x.id));
                return (
                  <li key={p.id} style={{ breakInside: 'avoid' }}>
                    <p className="serif text-[17px] leading-tight">
                      {fullName(p)}
                      {p.nickname && <span style={{ color: 'rgb(var(--c-muted))' }}> “{p.nickname}”</span>}
                    </p>
                    <p className="text-[12px] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
                      {[
                        lifespan(p.birthDate, p.deathDate),
                        p.birthPlace?.name && `b. ${p.birthPlace.name}`,
                        p.profession,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: 'rgb(var(--c-faint))' }}>
                      {[
                        parents.length && `Child of ${parents.map((x) => fullName(x)).join(' and ')}`,
                        partners.length && `Married ${partners.map((x) => fullName(x)).join(', ')}`,
                        children.length && `Children: ${children.map((x) => x.firstName).join(', ')}`,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {stories.length > 0 && (
          <section className="mt-16" style={{ breakBefore: 'page' }}>
            <h2 className="display text-[32px]">Stories</h2>
            <div className="rule-gold mt-4" style={{ maxWidth: 90 }} />
            {stories.map((s) => (
              <article key={s.id} className="mt-10" style={{ breakInside: 'avoid' }}>
                <h3 className="serif text-[21px]">{s.title}</h3>
                <p className="label mt-1">{[formatDate(s.date), s.place?.name].filter(Boolean).join(' · ')}</p>
                <div className="serif mt-3 space-y-3 text-[14.5px] leading-[1.7]">
                  {s.body.split('\n').filter(Boolean).map((para, i) => <p key={i}>{para}</p>)}
                </div>
              </article>
            ))}
          </section>
        )}
      </article>
    </div>
  );
}
