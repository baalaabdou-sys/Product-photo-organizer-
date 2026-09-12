import type { Transition, Variants } from 'framer-motion';

/** One motion vocabulary for the whole app: weighted, never bouncy. */
export const ease = [0.22, 1, 0.36, 1] as const;

export const gentle: Transition = { duration: 0.55, ease };
export const swift: Transition = { duration: 0.32, ease };
export const settle: Transition = { type: 'spring', stiffness: 210, damping: 26, mass: 0.9 };

export const pageVariants: Variants = {
  enter: { opacity: 0, y: 14 },
  center: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.22, ease } },
};

export const riseVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease, delay: Math.min(i * 0.055, 0.5) },
  }),
};

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
