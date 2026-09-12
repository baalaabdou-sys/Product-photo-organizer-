import { useMemo, useState } from 'react';
import { useIsDesktop } from '../hooks/useMedia';
import { AnimatePresence, motion } from 'framer-motion';
import { useArchive } from '../data/store';
import { TreeCanvas } from '../components/TreeCanvas';
import { PathTrail } from '../components/RelationshipFinder';
import { describeRelationship } from '../domain/relationships';
import { FamilyGraph } from '../domain/graph';
import type { ID } from '../domain/types';

/** The tree screen: the canvas, the branch filter, and the relationship banner. */
export function TreeView({ onOpenPerson }: { onOpenPerson: (id: ID) => void }) {
  const graph = useArchive((s) => s.graph);
  const branches = useArchive((s) => s.data.branches);
  const branchFilter = useArchive((s) => s.branchFilter);
  const setBranch = useArchive((s) => s.setBranch);
  const highlightPath = useArchive((s) => s.highlightPath);
  const setHighlight = useArchive((s) => s.setHighlight);
  const meId = useArchive((s) => s.meId);
  const [showTrail, setShowTrail] = useState(false);
  const desktop = useIsDesktop();
  // On desktop the app bar already occupies the top of the window.
  const topInset = desktop ? '18px' : 'calc(var(--safe-t) + 12px)';

  const summary = useMemo(() => {
    if (!highlightPath || highlightPath.length < 2) return null;
    const a = highlightPath[0], b = highlightPath[highlightPath.length - 1];
    return describeRelationship(graph as FamilyGraph, a, b);
  }, [highlightPath, graph]);

  const usableBranches = branches.filter((b) => b.rootPersonId && graph.people.has(b.rootPersonId));

  return (
    <div id="tree-shell" className="relative h-full w-full" style={{ background: 'rgb(var(--c-paper))' }}>
      <TreeCanvas onOpenPerson={onOpenPerson} />

      {/* Branch filter — a quiet row, not a rainbow legend. */}
      {usableBranches.length > 0 && !highlightPath && (
        <div
          className="no-print pointer-events-none absolute inset-x-0 flex justify-center px-4"
          style={{ top: topInset }}
        >
          <div
            className="scroll-x pointer-events-auto flex max-w-full gap-1.5 rounded-full px-1.5 py-1.5"
            style={{
              background: 'rgb(var(--c-paper) / 0.86)',
              border: '1px solid rgb(var(--c-rule))',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              scrollSnapType: 'none',
            }}
          >
            <button
              type="button"
              className="chip"
              aria-pressed={branchFilter === null}
              onClick={() => setBranch(null)}
              style={{ border: 'none' }}
            >
              Everyone
            </button>
            {usableBranches.map((b) => (
              <button
                key={b.id}
                type="button"
                className="chip"
                aria-pressed={branchFilter === b.id}
                onClick={() => setBranch(branchFilter === b.id ? null : b.id)}
                style={{ border: 'none' }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The relationship banner, while a connection is shown. */}
      <AnimatePresence>
        {summary && (
          <motion.div
            className="no-print absolute inset-x-0 flex justify-center px-4"
            style={{ top: topInset }}
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="w-full max-w-[440px] overflow-hidden rounded-[15px]"
              style={{
                background: 'rgb(var(--c-paper) / 0.94)',
                border: '1px solid rgb(var(--c-gold) / 0.4)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 20px 50px -28px rgb(var(--c-shadow)/0.5)',
              }}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="label" style={{ color: 'rgb(var(--c-gold))' }}>
                    {highlightPath![0] === meId ? 'Your relationship' : 'Connection'}
                  </p>
                  <p className="serif mt-1 text-[16.5px] leading-snug">{summary.sentence}</p>
                  <p className="mt-1 text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
                    {highlightPath!.length} people in the chain
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setHighlight(null); setShowTrail(false); }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                  style={{ color: 'rgb(var(--c-faint))' }}
                  aria-label="Clear the highlighted connection"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowTrail((v) => !v)}
                className="w-full px-4 pb-3 text-left text-[11.5px]"
                style={{ color: 'rgb(var(--c-gold))' }}
                aria-expanded={showTrail}
              >
                {showTrail ? 'Hide the steps' : 'Show every step'}
              </button>

              <AnimatePresence>
                {showTrail && (
                  <motion.div
                    className="max-h-[38vh] overflow-y-auto px-4 pb-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <PathTrail path={highlightPath!} compact />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
