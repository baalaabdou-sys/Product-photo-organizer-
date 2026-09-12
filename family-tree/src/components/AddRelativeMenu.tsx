import { useMemo, useState } from 'react';
import { useArchive, newId } from '../data/store';
import { Modal, Field } from './Modal';
import type { ID, Gender, Person, ParentChild, Union } from '../domain/types';
import { fullName } from '../domain/relationships';
import { haptic } from '../lib/haptics';
import { FamilyGraph } from '../domain/graph';

type Kind = 'father' | 'mother' | 'partner' | 'son' | 'daughter' | 'sibling';

const KINDS: Array<{ kind: Kind; label: string; gender: Gender; hint: string }> = [
  { kind: 'father', label: 'Father', gender: 'male', hint: 'Added above, on the same branch.' },
  { kind: 'mother', label: 'Mother', gender: 'female', hint: 'Added above, on the same branch.' },
  { kind: 'partner', label: 'Partner', gender: 'unknown', hint: 'A marriage or partnership.' },
  { kind: 'son', label: 'Son', gender: 'male', hint: 'Added below, under this couple.' },
  { kind: 'daughter', label: 'Daughter', gender: 'female', hint: 'Added below, under this couple.' },
  { kind: 'sibling', label: 'Brother or sister', gender: 'unknown', hint: 'Shares the same parents.' },
];

/**
 * Adding a relative is contextual: you pick a person, then say how the new
 * person relates to them. All the graph bookkeeping — unions, parent links,
 * which couple a child belongs to — happens underneath.
 */
export function AddRelativeMenu({ personId, onClose }: { personId: ID; onClose: () => void }) {
  const graph = useArchive((s) => s.graph);
  const data = useArchive((s) => s.data);
  const setData = useArchive((s) => s.setData);
  const select = useArchive((s) => s.select);
  const notify = useArchive((s) => s.notify);

  const anchor = graph.person(personId);
  const [kind, setKind] = useState<Kind | null>(null);
  const [firstNameV, setFirstName] = useState('');
  const [lastNameV, setLastName] = useState(anchor?.lastName ?? '');
  const [birth, setBirth] = useState('');
  const [partnerFor, setPartnerFor] = useState<ID | ''>('');

  const partners = anchor ? graph.partners(anchor.id) : [];
  const parents = anchor ? graph.parents(anchor.id) : [];

  const blocked = useMemo(() => {
    if (!anchor || !kind) return null;
    if ((kind === 'father' || kind === 'mother') && parents.length >= 2) {
      return `${anchor.firstName} already has two parents recorded: ${parents.map(fullName).join(' and ')}. Remove one first if it is wrong.`;
    }
    if (kind === 'sibling' && parents.length === 0) {
      return `${anchor.firstName} has no parents recorded yet. Add a parent first — a brother or sister needs a shared parent to hang from.`;
    }
    return null;
  }, [anchor, kind, parents]);

  if (!anchor) return null;

  const chosen = KINDS.find((k) => k.kind === kind);

  const commit = () => {
    if (!kind || blocked) return;
    const name = firstNameV.trim();
    if (!name) return;

    const now = Date.now();
    const next = JSON.parse(JSON.stringify(data)) as typeof data;
    const id = newId('p');
    const person: Person = {
      id,
      firstName: name,
      lastName: lastNameV.trim(),
      gender: chosen?.gender ?? 'unknown',
      birthDate: birth.trim() ? { value: birth.trim() } : undefined,
      privacy: { level: 'family' },
      metadata: { source: 'manual', createdAt: now, updatedAt: now },
    };
    next.people.push(person);

    const link = (parentId: ID, childId: ID, unionId?: ID): ParentChild => ({
      id: `pc_${parentId}_${childId}`, parentId, childId, type: 'biological', unionId,
      metadata: { createdAt: now },
    });
    const union = (a: ID, b: ID): Union => ({
      id: newId('u'), personA: a, personB: b, type: 'marriage',
      metadata: { createdAt: now, updatedAt: now },
    });

    if (kind === 'father' || kind === 'mother') {
      // The new parent joins the existing parent in a union, if there is one.
      let unionId: ID | undefined;
      const existing = parents[0];
      if (existing) {
        const u = union(existing.id, id);
        next.unions.push(u);
        unionId = u.id;
        // Existing siblings belong to the same couple.
        for (const sib of [anchor, ...graph.siblings(anchor.id)]) {
          const l = next.parentage.find((r) => r.parentId === existing.id && r.childId === sib.id);
          if (l) l.unionId = u.id;
          next.parentage.push(link(id, sib.id, u.id));
        }
      } else {
        next.parentage.push(link(id, anchor.id));
      }
      if (!next.parentage.some((r) => r.parentId === id && r.childId === anchor.id)) {
        next.parentage.push(link(id, anchor.id, unionId));
      }
    }

    if (kind === 'partner') {
      next.unions.push(union(anchor.id, id));
    }

    if (kind === 'son' || kind === 'daughter') {
      const partnerId = partnerFor || partners[0]?.id;
      const u = partnerId
        ? next.unions.find(
            (x) => (x.personA === anchor.id && x.personB === partnerId) || (x.personA === partnerId && x.personB === anchor.id),
          )
        : undefined;
      next.parentage.push(link(anchor.id, id, u?.id));
      if (partnerId) next.parentage.push(link(partnerId, id, u?.id));
    }

    if (kind === 'sibling') {
      const sharedUnion = graph.parentLinks(anchor.id).find((l) => l.unionId)?.unionId;
      for (const p of parents) next.parentage.push(link(p.id, id, sharedUnion));
    }

    // Final safeguard: never commit a change that makes someone their own ancestor.
    const test = new FamilyGraph(next);
    for (const p of test.people.values()) {
      if (test.ancestors(p.id).has(p.id)) {
        notify('That would make someone their own ancestor, so it was not saved.');
        return;
      }
    }

    setData(next, { snapshotReason: `Before adding ${name}` });
    haptic('commit');
    select(id);
    notify(`${name} was added to the tree.`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add someone to ${anchor.firstName}`}
      subtitle="Choose how they are related, and the tree will place them."
      footer={
        kind ? (
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setKind(null)}>Back</button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={commit}
              disabled={!firstNameV.trim() || Boolean(blocked)}
            >
              Add {chosen?.label.toLowerCase()}
            </button>
          </div>
        ) : undefined
      }
    >
      {!kind ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => { setKind(k.kind); haptic('focus'); }}
              className="rounded-[12px] p-4 text-left transition-transform duration-300 ease-editorial hover:-translate-y-[2px]"
              style={{ background: 'rgb(var(--c-paper-2))', border: '1px solid rgb(var(--c-rule) / 0.8)' }}
            >
              <span className="serif block text-[18px]">{k.label}</span>
              <span className="mt-1 block text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>{k.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {blocked ? (
            <p
              className="rounded-[11px] px-4 py-3 text-[13px]"
              style={{ background: 'rgb(var(--c-paper-3))', color: 'rgb(var(--c-ink-soft))' }}
            >
              {blocked}
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <input data-autofocus className="field" value={firstNameV} onChange={(e) => setFirstName(e.target.value)} />
                </Field>
                <Field label="Family name">
                  <input className="field" value={lastNameV} onChange={(e) => setLastName(e.target.value)} />
                </Field>
              </div>
              <Field label="Born" hint="Optional. A year alone is fine.">
                <input className="field" placeholder="1962" value={birth} onChange={(e) => setBirth(e.target.value)} />
              </Field>

              {(kind === 'son' || kind === 'daughter') && partners.length > 1 && (
                <Field label="Other parent">
                  <select className="field" value={partnerFor} onChange={(e) => setPartnerFor(e.target.value)}>
                    <option value="">Not recorded</option>
                    {partners.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
                  </select>
                </Field>
              )}

              {(kind === 'son' || kind === 'daughter') && partners.length === 1 && (
                <p className="text-[12px]" style={{ color: 'rgb(var(--c-faint))' }}>
                  Will be recorded as a child of {anchor.firstName} and {partners[0].firstName}.
                </p>
              )}

              {kind === 'sibling' && (
                <p className="text-[12px]" style={{ color: 'rgb(var(--c-faint))' }}>
                  Will share {parents.map((p) => p.firstName).join(' and ')} as parents.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
