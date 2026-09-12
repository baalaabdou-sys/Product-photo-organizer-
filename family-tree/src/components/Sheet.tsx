import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { useIsDesktop } from '../hooks/useMedia';
import { settle, swift } from '../lib/motion';

/**
 * One container, two personalities: an editorial drawer on the right at
 * desktop width, a draggable bottom sheet on phones. Both trap focus and
 * close on Escape.
 */
export function Sheet({
  open, onClose, children, label, expanded, onExpandedChange,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  /** Mobile only: whether the sheet is at full height. */
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}) {
  const desktop = useIsDesktop();
  const ref = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const focusables = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey, true);
    const t = setTimeout(() => {
      ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, 60);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      clearTimeout(t);
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) {
      if (expanded && onExpandedChange) onExpandedChange(false);
      else onClose();
    } else if (info.offset.y < -60 && onExpandedChange) {
      onExpandedChange(true);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgb(var(--c-shadow) / 0.34)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={swift}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="sheet"
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed z-[61] flex flex-col"
            style={
              desktop
                ? {
                    top: 0, right: 0, bottom: 0,
                    width: 'min(486px, 42vw)',
                    background: 'rgb(var(--c-paper))',
                    borderLeft: '1px solid rgb(var(--c-rule))',
                    boxShadow: '-30px 0 80px -40px rgb(var(--c-shadow)/0.5)',
                    paddingTop: 'var(--safe-t)',
                  }
                : {
                    left: 0, right: 0, bottom: 0,
                    height: expanded ? 'calc(100dvh - max(var(--safe-t), 12px))' : 'min(82dvh, 660px)',
                    background: 'rgb(var(--c-paper))',
                    borderTop: '1px solid rgb(var(--c-rule))',
                    borderRadius: '22px 22px 0 0',
                    boxShadow: '0 -8px 60px -20px rgb(var(--c-shadow)/0.45)',
                  }
            }
            initial={desktop ? { x: '100%' } : { y: '100%' }}
            animate={desktop ? { x: 0 } : { y: 0 }}
            exit={desktop ? { x: '100%' } : { y: '100%' }}
            transition={settle}
            drag={desktop ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.5 }}
            onDragEnd={onDragEnd}
          >
            {!desktop && (
              <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden="true">
                <div className="h-1 w-9 rounded-full" style={{ background: 'rgb(var(--c-rule))' }} />
              </div>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
