import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { prefersReducedMotion } from '../lib/motion';

/**
 * The opening. A line grows from the centre, branches, and its tips light up
 * as family members before the camera settles into the archive.
 *
 * Full length only on a first visit; afterwards it is a brief, quiet fade.
 */
export function Intro({ short, onDone }: { short: boolean; onDone: () => void }) {
  const reduced = prefersReducedMotion();
  const duration = reduced ? 400 : short ? 1300 : 4200;
  const [gone, setGone] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const finish = () => {
    setGone(true);
    setTimeout(() => doneRef.current(), reduced ? 0 : 620);
  };

  useEffect(() => {
    const t = setTimeout(finish, duration);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const step = short || reduced ? 0.35 : 1;

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[90] grid place-items-center overflow-hidden"
          style={{ background: 'rgb(var(--c-paper))' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
          onClick={finish}
          role="dialog"
          aria-label="Opening the Abderrahmane family archive"
        >
          <motion.div
            className="relative flex flex-col items-center px-6 text-center"
            exit={{ scale: reduced ? 1 : 1.08, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
          >
            <Emblem animate={!reduced} scale={step} />

            <motion.h1
              className="display mt-8 text-[clamp(30px,7.5vw,52px)]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9 * step + 0.4, delay: 0.25 * step, ease: [0.22, 1, 0.36, 1] }}
            >
              Abderrahmane Family
            </motion.h1>

            <motion.div
              className="rule-gold mt-5"
              style={{ width: 110 }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 1 * step + 0.3, delay: 0.5 * step, ease: [0.22, 1, 0.36, 1] }}
            />

            <motion.p
              className="serif mt-5 text-[clamp(14px,3.6vw,17px)] italic"
              style={{ color: 'rgb(var(--c-muted))' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.1 * step + 0.3, delay: 0.75 * step }}
            >
              Every name carries a story.
            </motion.p>
          </motion.div>

          {!short && !reduced && (
            <motion.button
              type="button"
              onClick={(e) => { e.stopPropagation(); finish(); }}
              className="btn btn-ghost btn-sm absolute"
              style={{ bottom: 'calc(var(--safe-b) + 26px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.6 }}
            >
              Skip
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The growing line: a trunk, two branches, four limbs, five lit tips.
 * The same geometry as the app's loader, so the brand reads as one thing.
 */
function Emblem({ animate, scale }: { animate: boolean; scale: number }) {
  const d = (base: number) => base * scale;
  return (
    <svg width="216" height="150" viewBox="0 0 216 150" fill="none" aria-hidden="true" style={{ overflow: 'visible' }}>
      <g stroke="rgb(var(--c-gold))" strokeWidth="1.15" strokeLinecap="round" fill="none">
        {EMBLEM.map(({ path, delay }, i) => (
          <path
            key={i}
            d={path}
            strokeDasharray={animate ? 200 : undefined}
            strokeDashoffset={animate ? 200 : undefined}
            style={animate ? {
              animation: `draw-branch ${d(1.15)}s cubic-bezier(.22,1,.36,1) ${d(delay)}s forwards`,
            } : undefined}
          />
        ))}
      </g>
      <g>
        {EMBLEM_TIPS.map(([cx, cy, delay], i) => (
          <g key={i} style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <circle
              cx={cx} cy={cy} r="8"
              fill="rgb(var(--c-gold))"
              opacity={animate ? 0 : 0.1}
              style={animate ? { animation: `bloom ${d(1.3)}s ease-out ${d(delay)}s forwards`, opacity: 0.12 } : undefined}
            />
            <circle
              cx={cx} cy={cy} r="2.9"
              fill="rgb(var(--c-gold))"
              opacity={animate ? 0 : 0.85}
              style={animate ? { animation: `bloom ${d(0.8)}s cubic-bezier(.22,1,.36,1) ${d(delay)}s forwards` } : undefined}
            />
          </g>
        ))}
      </g>
      {/* The monogram sits in the negative space at the root of the tree. */}
      <text
        x="108" y="140"
        textAnchor="middle"
        className="serif"
        style={{ fontSize: 21, fontWeight: 300, letterSpacing: '0.22em', fill: 'rgb(var(--c-ink))' }}
        opacity={0.9}
      >
        AF
      </text>
    </svg>
  );
}

const EMBLEM = [
  { path: 'M108 118 L108 78', delay: 0 },
  { path: 'M108 78 C108 62 84 60 68 48', delay: 0.5 },
  { path: 'M108 78 C108 62 132 60 148 48', delay: 0.5 },
  { path: 'M68 48 C56 38 44 32 30 26', delay: 1.05 },
  { path: 'M68 48 C68 34 74 26 80 16', delay: 1.05 },
  { path: 'M148 48 C160 38 172 32 186 26', delay: 1.05 },
  { path: 'M148 48 C148 34 142 26 136 16', delay: 1.05 },
];

const EMBLEM_TIPS: Array<[number, number, number]> = [
  [108, 78, 0.9],
  [30, 26, 1.85],
  [80, 16, 2.0],
  [186, 26, 2.15],
  [136, 16, 2.3],
];
