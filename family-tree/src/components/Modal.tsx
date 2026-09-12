import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { settle, swift } from '../lib/motion';

export function Modal({
  open, onClose, title, subtitle, children, footer, wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 70);
    return () => { document.removeEventListener('keydown', onKey, true); clearTimeout(t); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgb(var(--c-shadow) / 0.38)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={swift}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-x-0 bottom-0 z-[71] flex flex-col sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[86vh]"
            style={{
              maxWidth: wide ? 720 : 560,
              maxHeight: 'min(90dvh, 900px)',
              background: 'rgb(var(--c-paper))',
              border: '1px solid rgb(var(--c-rule))',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 40px 90px -40px rgb(var(--c-shadow)/0.6)',
            }}
            initial={{ y: 40, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={settle}
          >
            <header className="shrink-0 px-6 pb-4 pt-6" style={{ borderBottom: '1px solid rgb(var(--c-rule) / 0.6)' }}>
              <h2 className="display text-[25px]">{title}</h2>
              {subtitle && <p className="mt-1.5 text-[13px]" style={{ color: 'rgb(var(--c-muted))' }}>{subtitle}</p>}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
            {footer && (
              <footer
                className="shrink-0 px-6 py-4"
                style={{
                  borderTop: '1px solid rgb(var(--c-rule) / 0.6)',
                  paddingBottom: 'calc(16px + var(--safe-b))',
                }}
              >
                {footer}
              </footer>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label block mb-1.5">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>{hint}</span>}
    </label>
  );
}
