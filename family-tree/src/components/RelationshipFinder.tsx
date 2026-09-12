import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useArchive } from '../data/store';
import { Modal } from './Modal';
import { describeRelationship, fullName } from '../domain/relationships';
import { Portrait } from './Portrait';
import { describePerson } from '../domain/search';
import type { ID } from '../domain/types';
import { haptic } from '../lib/haptics';

/** "Relationship between…" — pick any two relatives and see the route. */
export function RelationshipFinder({ onClose }: { onClose: () => void }) {
  const graph = useArchive((s) => s.graph);
  const meId = useArchive((s) => s.meId);
  const setHighlight = useArchive((s) => s.setHighlight);
  const go = useArchive((s) => s.go);

  const [a, setA] = useState<ID | null>(meId);
  const [b, setB] = useState<ID | null>(null);

  const result = useMemo(
    () => (a && b && a !== b ? describeRelationship(graph, a, b) : null),
    [graph, a, b],
  );

  const show = () => {
    if (!result?.path.length) return;
    setHighlight(result.path);
    haptic('path-complete');
    go('tree');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Relationship between…"
      subtitle="Choose two relatives and the archive will work out how they connect."
      footer={
        result && result.degree !== 'none' ? (
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={show}>Show in the tree</button>
          </div>
        ) : undefined
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PersonPicker label="Person" value={a} onChange={setA} exclude={b} />
        <PersonPicker label="And" value={b} onChange={setB} exclude={a} />
      </div>

      {result && (
        <motion.div
          className="mt-7"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {result.degree === 'none' ? (
            <p className="serif text-[17px] italic" style={{ color: 'rgb(var(--c-muted))' }}>
              No recorded connection links these two yet. A missing parent or marriage somewhere
              between them would join the branches.
            </p>
          ) : (
            <>
              <div className="rule-gold" />
              <p className="serif mt-5 text-[clamp(20px,4.6vw,26px)] leading-snug">
                {result.sentence}
              </p>
              <PathTrail path={result.path} />
            </>
          )}
        </motion.div>
      )}
    </Modal>
  );
}

/** The chain, drawn step by step. */
export function PathTrail({ path, compact = false }: { path: ID[]; compact?: boolean }) {
  const graph = useArchive((s) => s.graph);
  const select = useArchive((s) => s.select);
  if (path.length < 2) return null;

  return (
    <ol className={compact ? 'mt-4 space-y-0' : 'mt-6 space-y-0'}>
      {path.map((id, i) => {
        const p = graph.person(id);
        if (!p) return null;
        return (
          <motion.li
            key={id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.09, 0.7), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex items-center gap-3 py-1.5"
          >
            {i < path.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[17px] top-[34px] w-px"
                style={{ height: 'calc(100% - 20px)', background: 'rgb(var(--c-gold) / 0.45)' }}
              />
            )}
            <button
              type="button"
              onClick={() => select(id)}
              className="flex items-center gap-3 rounded-[10px] py-1 pr-3 text-left"
            >
              <Portrait person={p} size={36} shape="circle" />
              <span>
                <span className="block text-[14px] leading-tight">{fullName(p)}</span>
                <span className="block text-[10.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
                  {describePerson(p)}
                </span>
              </span>
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}

function PersonPicker({
  label, value, onChange, exclude,
}: { label: string; value: ID | null; onChange: (id: ID | null) => void; exclude: ID | null }) {
  const graph = useArchive((s) => s.graph);
  const people = useMemo(
    () => [...graph.people.values()]
      .filter((p) => p.id !== exclude)
      .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [graph, exclude],
  );
  const chosen = value ? graph.person(value) : undefined;

  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      <div className="flex items-center gap-3">
        {chosen && <Portrait person={chosen} size={44} shape="arch" />}
        <select
          className="field"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">Choose someone…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{fullName(p)}</option>
          ))}
        </select>
      </div>
    </label>
  );
}
