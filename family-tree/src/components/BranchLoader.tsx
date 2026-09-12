import { prefersReducedMotion } from '../lib/motion';

/**
 * The loading state: a branch drawing itself. Never a spinner.
 */
export function BranchLoader({ still = false, size = 120 }: { still?: boolean; size?: number }) {
  const stat = still || prefersReducedMotion();
  return (
    <svg
      width={size}
      height={size * 0.8}
      viewBox="0 0 120 96"
      fill="none"
      role="img"
      aria-label="Loading the family archive"
      style={{ overflow: 'visible' }}
    >
      <g
        stroke="rgb(var(--c-gold))"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      >
        {BRANCHES.map((d, i) => (
          <path
            key={i}
            d={d}
            strokeDasharray={stat ? undefined : 160}
            strokeDashoffset={stat ? undefined : 160}
            style={stat ? undefined : {
              animation: `draw-branch 1.05s cubic-bezier(.22,1,.36,1) ${i * 0.16}s forwards`,
            }}
          />
        ))}
      </g>
      <g fill="rgb(var(--c-gold))">
        {TIPS.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="2.4"
            opacity={stat ? 0.8 : 0}
            style={stat ? undefined : {
              animation: `bloom .7s cubic-bezier(.22,1,.36,1) ${0.75 + i * 0.13}s forwards`,
              transformOrigin: `${cx}px ${cy}px`,
            }}
          />
        ))}
      </g>
    </svg>
  );
}

const BRANCHES = [
  'M60 92 L60 58',
  'M60 58 C60 44 44 42 34 34',
  'M60 58 C60 44 76 42 86 34',
  'M34 34 C28 26 22 22 16 18',
  'M34 34 C34 24 40 18 44 12',
  'M86 34 C92 26 98 22 104 18',
  'M86 34 C86 24 80 18 76 12',
];

const TIPS: Array<[number, number]> = [
  [16, 18], [44, 12], [104, 18], [76, 12], [60, 58],
];
