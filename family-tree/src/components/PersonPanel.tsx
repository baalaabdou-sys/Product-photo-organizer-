import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useArchive } from '../data/store';
import { Sheet } from './Sheet';
import { Portrait } from './Portrait';
import { describeRelationship, fullName, firstName } from '../domain/relationships';
import { formatDate, lifespan, ageOf } from '../domain/dates';
import { isDeceased } from '../domain/graph';
import { canSee, canEdit } from '../lib/privacy';
import type { ID, Person } from '../domain/types';
import { haptic } from '../lib/haptics';
import { riseVariants } from '../lib/motion';
import { PersonEditor } from './PersonEditor';
import { StoryEditor } from './StoryEditor';
import { AddRelativeMenu } from './AddRelativeMenu';

export function PersonPanel({ personId, onClose }: { personId: ID | null; onClose: () => void }) {
  const graph = useArchive((s) => s.graph);
  const role = useArchive((s) => s.role);
  const meId = useArchive((s) => s.meId);
  const setMe = useArchive((s) => s.setMe);
  const setHighlight = useArchive((s) => s.setHighlight);
  const setLegacy = useArchive((s) => s.setLegacy);
  const select = useArchive((s) => s.select);
  const stories = useArchive((s) => s.data.stories);
  const events = useArchive((s) => s.data.events);
  const media = useArchive((s) => s.data.media);
  const notify = useArchive((s) => s.notify);

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [writingStory, setWritingStory] = useState(false);
  const [adding, setAdding] = useState(false);

  const person = graph.person(personId);

  const relationship = useMemo(
    () => (person && meId && meId !== person.id ? describeRelationship(graph, meId, person.id) : null),
    [graph, meId, person],
  );

  if (!person) return <Sheet open={false} onClose={onClose} label="Family member">{null}</Sheet>;

  const parents = graph.parents(person.id);
  const children = graph.children(person.id);
  const siblings = graph.siblings(person.id);
  const partners = graph.partners(person.id);
  const personStories = stories.filter((s) => s.personIds.includes(person.id));
  const personEvents = events
    .filter((e) => e.personIds.includes(person.id))
    .sort((a, b) => (a.date.value > b.date.value ? 1 : -1));
  const personPhotos = media.filter((m) => m.tags.some((t) => t.personId === person.id) || m.id === person.photoId);

  const see = (f: Parameters<typeof canSee>[1]) => canSee(person, f, role);
  const deceased = isDeceased(person);
  const age = ageOf(person.birthDate, person.deathDate);

  const showConnection = () => {
    if (!meId || !relationship?.path.length) return;
    setHighlight(relationship.path);
    haptic('path-complete');
    onClose();
  };

  return (
    <>
      <Sheet
        open={Boolean(personId)}
        onClose={onClose}
        label={`${fullName(person)} — family record`}
        expanded={expanded}
        onExpandedChange={setExpanded}
      >
        <header
          className="relative shrink-0 px-6 pt-5 pb-5 sm:px-8"
          style={{ borderBottom: '1px solid rgb(var(--c-rule) / 0.7)' }}
        >
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full transition-colors"
            style={{ color: 'rgb(var(--c-faint))' }}
            aria-label="Close this record"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>

          <motion.div layoutId={`portrait-${person.id}`} className="inline-block">
            <Portrait person={person} size={92} shape="arch" eager />
          </motion.div>

          <h2 className="display mt-4 pr-10 text-[clamp(27px,6vw,36px)]">
            {person.firstName}
            {person.middleNames ? <span style={{ opacity: 0.6 }}> {person.middleNames}</span> : null}
          </h2>
          <p className="label mt-1.5">{person.lastName}</p>

          {person.nickname && (
            <p className="serif mt-2 text-[15px] italic" style={{ color: 'rgb(var(--c-muted))' }}>
              known as {person.nickname}
            </p>
          )}

          {(see('birthDate') || see('deathDate')) && lifespan(person.birthDate, person.deathDate) && (
            <p className="mt-3 text-[13px] tabular-nums" style={{ color: 'rgb(var(--c-muted))' }}>
              {lifespan(person.birthDate, person.deathDate)}
              {age !== null && (
                <span style={{ color: 'rgb(var(--c-faint))' }}>
                  {deceased ? ` · ${age} years` : ` · ${age} years old`}
                </span>
              )}
            </p>
          )}

          {person.metadata.demo && (
            <p
              className="mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] uppercase"
              style={{ letterSpacing: '0.14em', background: 'rgb(var(--c-paper-3))', color: 'rgb(var(--c-faint))' }}
            >
              Demonstration record
            </p>
          )}

          {/* ── Your relationship ─────────────────────────── */}
          {meId && meId !== person.id && relationship && relationship.degree !== 'none' && (
            <div
              className="mt-5 rounded-[13px] px-4 py-3.5"
              style={{ background: 'rgb(var(--c-paper-2))', border: '1px solid rgb(var(--c-gold) / 0.3)' }}
            >
              <p className="label" style={{ color: 'rgb(var(--c-gold))' }}>Your relationship</p>
              <p className="serif mt-1.5 text-[21px] leading-tight">{relationship.label}</p>
              <p className="mt-1 text-[12.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
                {relationship.sentence}
              </p>
              {relationship.path.length > 2 && (
                <button type="button" className="btn btn-sm mt-3" onClick={showConnection}>
                  Show connection
                </button>
              )}
            </div>
          )}

          {meId !== person.id && (
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-3"
              onClick={() => { setMe(person.id); haptic('commit'); notify(`You are now shown as ${firstName(person)} in the tree.`); }}
            >
              This is me
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-10 sm:px-8"
             style={{ paddingBottom: 'calc(var(--safe-b) + 40px)' }}>

          <Facts person={person} see={see} />

          <People
            title="Family"
            groups={[
              { label: 'Parents', people: parents },
              { label: partners.length > 1 ? 'Partners' : 'Partner', people: partners },
              { label: 'Siblings', people: siblings },
              { label: 'Children', people: children },
            ]}
            onPick={(id) => { select(id); haptic('focus'); }}
          />

          {see('biography') && person.biography && (
            <Section title="Their story">
              <p className="serif whitespace-pre-wrap text-[16.5px] leading-[1.72]" style={{ color: 'rgb(var(--c-ink-soft))' }}>
                {person.biography}
              </p>
            </Section>
          )}

          {personStories.length > 0 && (
            <Section title={`Stories · ${personStories.length}`}>
              <div className="space-y-3">
                {personStories.map((s, i) => (
                  <motion.button
                    key={s.id}
                    type="button"
                    custom={i}
                    variants={riseVariants}
                    initial="hidden"
                    animate="show"
                    onClick={() => { setLegacy(null); select(person.id); document.getElementById(`story-${s.id}`)?.scrollIntoView(); }}
                    className="block w-full rounded-[12px] p-4 text-left transition-transform duration-300 ease-editorial hover:-translate-y-[2px]"
                    style={{ background: 'rgb(var(--c-paper-2))', border: '1px solid rgb(var(--c-rule) / 0.7)' }}
                  >
                    <p className="serif text-[18px] leading-snug">{s.title}</p>
                    {s.date && <p className="label mt-1">{formatDate(s.date)}</p>}
                    <p className="mt-2 line-clamp-3 text-[13px]" style={{ color: 'rgb(var(--c-muted))' }}>
                      {s.body.split('\n')[0]}
                    </p>
                  </motion.button>
                ))}
              </div>
            </Section>
          )}

          {personStories.length === 0 && (
            <Section title="Stories">
              <Empty
                line={`No stories have been preserved for ${firstName(person)} yet.`}
                action={canEdit(role) ? { label: 'Write the first story', run: () => setWritingStory(true) } : undefined}
              />
            </Section>
          )}

          {personEvents.length > 0 && (
            <Section title="Important dates">
              <ol className="space-y-2.5">
                {personEvents.map((e) => (
                  <li key={e.id} className="flex gap-4">
                    <span className="serif shrink-0 tabular-nums text-[15px]" style={{ color: 'rgb(var(--c-gold))', width: '4.2rem' }}>
                      {formatDate(e.date).replace(/^about /, 'c. ')}
                    </span>
                    <span className="text-[13.5px]" style={{ color: 'rgb(var(--c-ink-soft))' }}>
                      {e.title}
                      {e.place && <span style={{ color: 'rgb(var(--c-faint))' }}> · {e.place.name}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {personPhotos.length > 0 && (
            <Section title={`Photographs · ${personPhotos.length}`}>
              <div className="grid grid-cols-3 gap-2">
                {personPhotos.slice(0, 9).map((m) => (
                  <div key={m.id} className="portrait-frame aspect-square rounded-[9px]">
                    {m.thumb || m.src ? <img src={m.thumb ?? m.src} alt={m.title ?? ''} loading="lazy" /> : null}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {deceased && (
            <div className="mt-9">
              <button
                type="button"
                className="btn w-full"
                onClick={() => { setLegacy(person.id); onClose(); }}
              >
                Enter Legacy
              </button>
              <p className="mt-2 text-center text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
                A quieter page for {firstName(person)} and the branch that continues through them.
              </p>
            </div>
          )}

          {canEdit(role) && (
            <div className="mt-9 flex flex-wrap gap-2 hairline pt-6">
              <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>Edit record</button>
              <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>Add a relative</button>
              <button type="button" className="btn btn-sm" onClick={() => setWritingStory(true)}>Add a story</button>
            </div>
          )}
        </div>
      </Sheet>

      {editing && <PersonEditor personId={person.id} onClose={() => setEditing(false)} />}
      {writingStory && <StoryEditor personId={person.id} onClose={() => setWritingStory(false)} />}
      {adding && <AddRelativeMenu personId={person.id} onClose={() => setAdding(false)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────

function Facts({ person, see }: { person: Person; see: (f: Parameters<typeof canSee>[1]) => boolean }) {
  const rows: Array<[string, string]> = [];
  const add = (label: string, value?: string | null) => { if (value) rows.push([label, value]); };

  if (see('birthDate')) add('Born', formatDate(person.birthDate));
  if (see('birthPlace')) add('Birthplace', person.birthPlace?.name);
  if (see('deathDate')) add('Died', formatDate(person.deathDate));
  if (see('deathPlace')) add('Place of death', person.deathPlace?.name);
  if (see('burialDate')) add('Buried', formatDate(person.burialDate));
  if (see('burialPlace')) add('Resting place', person.burialPlace?.name);
  if (see('profession')) add('Work', person.profession);
  if (see('company')) add('At', person.company);
  if (person.birthSurname && person.birthSurname !== person.lastName) add('Born as', `${person.firstName} ${person.birthSurname}`);
  if (see('interests') && person.interests?.length) add('Interests', person.interests.join(' · '));
  if (see('activities') && person.activities?.length) add('Known for', person.activities.join(' · '));
  if (see('email')) add('Email', person.email);
  if (see('phone')) add('Telephone', person.phone);

  if (!rows.length) return null;

  return (
    <Section title="Record">
      <dl className="space-y-0">
        {rows.map(([k, v], i) => (
          <div
            key={k}
            className="grid grid-cols-[6.6rem_1fr] gap-4 py-2.5"
            style={{ borderTop: i === 0 ? 'none' : '1px solid rgb(var(--c-rule) / 0.55)' }}
          >
            <dt className="label pt-[3px]">{k}</dt>
            <dd className="text-[14px]" style={{ color: 'rgb(var(--c-ink-soft))' }}>{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function People({
  title, groups, onPick,
}: {
  title: string;
  groups: Array<{ label: string; people: Person[] }>;
  onPick: (id: ID) => void;
}) {
  const filled = groups.filter((g) => g.people.length);
  if (!filled.length) return null;
  return (
    <Section title={title}>
      <div className="space-y-5">
        {filled.map((g) => (
          <div key={g.label}>
            <p className="label mb-2">{g.label}</p>
            <div className="flex flex-wrap gap-x-1 gap-y-1">
              {g.people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(p.id)}
                  className="group flex items-center gap-2.5 rounded-[10px] py-1.5 pl-1.5 pr-3 transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgb(var(--c-paper-2))')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Portrait person={p} size={34} shape="circle" />
                  <span className="text-left">
                    <span className="block text-[13.5px] leading-tight">{p.firstName}</span>
                    <span className="block text-[10.5px] tabular-nums" style={{ color: 'rgb(var(--c-faint))' }}>
                      {lifespan(p.birthDate, p.deathDate) || p.lastName}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="label mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function Empty({ line, action }: { line: string; action?: { label: string; run: () => void } }) {
  return (
    <div
      className="rounded-[12px] px-5 py-7 text-center"
      style={{ border: '1px dashed rgb(var(--c-rule))' }}
    >
      <p className="serif text-[15px] italic" style={{ color: 'rgb(var(--c-muted))' }}>{line}</p>
      {action && (
        <button type="button" className="btn btn-sm mt-4" onClick={action.run}>
          {action.label}
        </button>
      )}
    </div>
  );
}
