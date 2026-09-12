import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useArchive } from '../data/store';
import { settle } from '../lib/motion';

export function Toast() {
  const toast = useArchive((s) => s.toast);
  const dismiss = useArchive((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, toast.action ? 8000 : 4200);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="no-print fixed left-1/2 z-[100] flex w-[min(440px,calc(100vw-28px))] -translate-x-1/2 items-center gap-3 rounded-full py-2.5 pl-5 pr-2.5"
          style={{
            bottom: 'calc(var(--safe-b) + var(--nav-h) + 18px)',
            background: 'rgb(var(--c-ink))',
            color: 'rgb(var(--c-paper))',
            boxShadow: '0 20px 50px -24px rgb(var(--c-shadow)/0.7)',
          }}
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={settle}
        >
          <span className="min-w-0 flex-1 text-[13px]">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px]"
              style={{ background: 'rgb(var(--c-paper) / 0.14)', color: 'rgb(var(--c-paper))' }}
              onClick={() => { toast.action!.run(); dismiss(); }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
            style={{ color: 'rgb(var(--c-paper) / 0.6)' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
