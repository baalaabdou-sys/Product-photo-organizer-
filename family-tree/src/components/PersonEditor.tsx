import { useMemo, useState } from 'react';
import { useArchive } from '../data/store';
import { Modal, Field } from './Modal';
import type { Person, Gender, Visibility, ID } from '../domain/types';
import { reviewFamily } from '../domain/validate';
import { haptic } from '../lib/haptics';
import { VISIBILITY_LABELS } from '../lib/privacy';
import { fullName } from '../domain/relationships';

const GENDERS: Array<[Gender, string]> = [
  ['male', 'Male'], ['female', 'Female'], ['other', 'Other'], ['unknown', 'Not recorded'],
];

export function PersonEditor({ personId, onClose }: { personId: ID; onClose: () => void }) {
  const graph = useArchive((s) => s.graph);
  const data = useArchive((s) => s.data);
  const upsertPerson = useArchive((s) => s.upsertPerson);
  const removePerson = useArchive((s) => s.removePerson);
  const notify = useArchive((s) => s.notify);

  const original = graph.person(personId);
  const [draft, setDraft] = useState<Person | undefined>(original ? { ...original } : undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Live check: warn before saving, never block or silently correct.
  const warnings = useMemo(() => {
    if (!draft) return [];
    const next = { ...data, people: data.people.map((p) => (p.id === draft.id ? draft : p)) };
    return reviewFamily(next).filter((i) => i.personIds.includes(draft.id));
  }, [draft, data]);

  if (!draft || !original) return null;

  const set = <K extends keyof Person>(k: K, v: Person[K]) => setDraft({ ...draft, [k]: v });
  const setDate = (k: 'birthDate' | 'deathDate' | 'burialDate', v: string) =>
    setDraft({ ...draft, [k]: v ? { value: v } : undefined });
  const setPlace = (k: 'birthPlace' | 'deathPlace' | 'burialPlace', v: string) =>
    setDraft({ ...draft, [k]: v ? { name: v } : undefined });

  const save = () => {
    upsertPerson({
      ...draft,
      firstName: draft.firstName.trim() || 'Unknown',
      lastName: draft.lastName.trim(),
      living: draft.deathDate?.value ? false : draft.living,
    });
    haptic('commit');
    notify(`${fullName(draft)} saved.`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${original.firstName}`}
      subtitle="Nothing here is sent anywhere. The archive stays on this device until you export it."
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: 'rgb(var(--c-faint))' }}
            onClick={() => setConfirmDelete(true)}
          >
            Remove from the tree
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save}>Save</button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <input data-autofocus className="field" value={draft.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </Field>
          <Field label="Family name">
            <input className="field" value={draft.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </Field>
          <Field label="Middle names">
            <input className="field" value={draft.middleNames ?? ''} onChange={(e) => set('middleNames', e.target.value || undefined)} />
          </Field>
          <Field label="Name at birth" hint="If the family name changed on marriage.">
            <input className="field" value={draft.birthSurname ?? ''} onChange={(e) => set('birthSurname', e.target.value || undefined)} />
          </Field>
          <Field label="Known as">
            <input className="field" value={draft.nickname ?? ''} onChange={(e) => set('nickname', e.target.value || undefined)} />
          </Field>
          <Field label="Gender">
            <select className="field" value={draft.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
              {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        <div className="hairline pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Born" hint="A year alone is fine — 1948.">
              <input className="field" placeholder="1948-03-17" value={draft.birthDate?.value ?? ''} onChange={(e) => setDate('birthDate', e.target.value)} />
            </Field>
            <Field label="Birthplace">
              <input className="field" placeholder="Casablanca, Morocco" value={draft.birthPlace?.name ?? ''} onChange={(e) => setPlace('birthPlace', e.target.value)} />
            </Field>
            <Field label="Died">
              <input className="field" placeholder="2021" value={draft.deathDate?.value ?? ''} onChange={(e) => setDate('deathDate', e.target.value)} />
            </Field>
            <Field label="Place of death">
              <input className="field" value={draft.deathPlace?.name ?? ''} onChange={(e) => setPlace('deathPlace', e.target.value)} />
            </Field>
            <Field label="Buried">
              <input className="field" value={draft.burialDate?.value ?? ''} onChange={(e) => setDate('burialDate', e.target.value)} />
            </Field>
            <Field label="Resting place">
              <input className="field" value={draft.burialPlace?.name ?? ''} onChange={(e) => setPlace('burialPlace', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="hairline pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Work">
              <input className="field" value={draft.profession ?? ''} onChange={(e) => set('profession', e.target.value || undefined)} />
            </Field>
            <Field label="Company or place of work">
              <input className="field" value={draft.company ?? ''} onChange={(e) => set('company', e.target.value || undefined)} />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Interests" hint="Separated by commas.">
              <input
                className="field"
                value={draft.interests?.join(', ') ?? ''}
                onChange={(e) => set('interests', splitList(e.target.value))}
              />
            </Field>
            <Field label="Known for" hint="Separated by commas.">
              <input
                className="field"
                value={draft.activities?.join(', ') ?? ''}
                onChange={(e) => set('activities', splitList(e.target.value))}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Their story">
              <textarea
                className="field"
                rows={5}
                style={{ minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
                value={draft.biography ?? ''}
                onChange={(e) => set('biography', e.target.value || undefined)}
              />
            </Field>
          </div>
        </div>

        <div className="hairline pt-5">
          <Field label="Who may see the details" hint="Names and position in the tree are always visible. Contact details are never shown below editor level.">
            <select
              className="field"
              value={draft.privacy.level}
              onChange={(e) => set('privacy', { ...draft.privacy, level: e.target.value as Visibility })}
            >
              {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((v) => (
                <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
              ))}
            </select>
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Email" hint="Editors and administrators only.">
              <input className="field" type="email" value={draft.email ?? ''} onChange={(e) => set('email', e.target.value || undefined)} />
            </Field>
            <Field label="Telephone" hint="Editors and administrators only.">
              <input className="field" type="tel" value={draft.phone ?? ''} onChange={(e) => set('phone', e.target.value || undefined)} />
            </Field>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="hairline pt-5">
            <p className="label mb-2" style={{ color: 'rgb(var(--c-gold))' }}>Worth checking</p>
            <ul className="space-y-2">
              {warnings.map((w) => (
                <li key={w.id} className="text-[12.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
                  <strong style={{ color: 'rgb(var(--c-ink))', fontWeight: 500 }}>{w.title}.</strong> {w.detail}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
              These are warnings, not blocks — save anyway if the record is right.
            </p>
          </div>
        )}
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Remove ${original.firstName}?`}
        subtitle="Their record, and every link to parents, partners and children, will be removed from the archive. A restore point is kept in Settings."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Keep them</button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => { removePerson(personId); notify(`${original.firstName} was removed.`); onClose(); }}
            >
              Remove
            </button>
          </div>
        }
      >
        <p className="text-[13.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
          {graph.children(personId).length > 0
            ? `${original.firstName} has ${graph.children(personId).length} children recorded. Removing them will leave those children without this parent link.`
            : 'Nothing else in the archive depends on this record.'}
        </p>
      </Modal>
    </Modal>
  );
}

const splitList = (v: string) => {
  const arr = v.split(',').map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
};
