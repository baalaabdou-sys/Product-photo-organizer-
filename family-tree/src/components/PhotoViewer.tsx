import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useArchive } from '../data/store';
import { Portrait } from './Portrait';
import { formatDate } from '../domain/dates';
import { fullName } from '../domain/relationships';
import { getBlob } from '../data/db';
import type { ID } from '../domain/types';

/**
 * Museum mode: the photograph in the dark, everything else out of the way.
 * The label sits beside it on wide screens and beneath it on phones.
 */
export function PhotoViewer({ mediaId, onClose }: { mediaId: ID; onClose: () => void }) {
  const media = useArchive((s) => s.data.media);
  const graph = useArchive((s) => s.graph);
  const select = useArchive((s) => s.select);
  const go = useArchive((s) => s.go);

  const index = media.findIndex((m) => m.id === mediaId);
  const [current, setCurrent] = useState(Math.max(0, index));
  const item = media[current];
  const [src, setSrc] = useState<string | undefined>(item?.src ?? item?.thumb);
  const [labelOpen, setLabelOpen] = useState(true);

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    setSrc(item?.src ?? item?.thumb);
    if (item && !item.src) {
      void getBlob(item.id).then((row) => {
        if (cancelled || !row) return;
        url = URL.createObjectURL(row.blob);
        setSrc(url);
      });
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent((c) => Math.min(c + 1, media.length - 1));
      if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(c - 1, 0));
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, media.length]);

  if (!item) return null;

  const tagged = item.tags.map((t) => graph.person(t.personId)).filter(Boolean);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[85] flex flex-col lg:flex-row"
        style={{ background: '#0d0b0a', color: '#efe6d9' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.32 }}
        role="dialog"
        aria-modal="true"
        aria-label={item.title ?? 'Photograph'}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 z-10 grid h-11 w-11 place-items-center rounded-full"
          style={{ top: 'calc(var(--safe-t) + 10px)', background: 'rgb(255 255 255 / 0.07)', color: '#efe6d9' }}
          aria-label="Close"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>

        {/* Image */}
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center p-4 lg:p-12"
          onClick={() => setLabelOpen((v) => !v)}
        >
          {src ? (
            <motion.img
              key={item.id}
              src={src}
              alt={item.title ?? 'Family photograph'}
              className="max-h-full max-w-full object-contain"
              style={{ boxShadow: '0 40px 100px -50px rgb(0 0 0 / 0.9)' }}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : (
            <p className="serif text-[15px] italic" style={{ color: 'rgb(255 255 255 / 0.4)' }}>
              This item has no image stored on this device.
            </p>
          )}

          {media.length > 1 && (
            <>
              <NavBtn side="left" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))} />
              <NavBtn side="right" disabled={current === media.length - 1} onClick={() => setCurrent((c) => Math.min(media.length - 1, c + 1))} />
            </>
          )}
        </div>

        {/* Museum label */}
        <AnimatePresence>
          {labelOpen && (
            <motion.aside
              className="shrink-0 overflow-y-auto px-6 py-6 lg:w-[330px] lg:px-8 lg:py-14"
              style={{
                borderTop: '1px solid rgb(255 255 255 / 0.09)',
                paddingBottom: 'calc(24px + var(--safe-b))',
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="serif text-[22px] leading-tight">{item.title ?? 'Untitled'}</h2>
              {(item.date || item.place) && (
                <p className="mt-2 text-[11.5px] uppercase" style={{ letterSpacing: '0.16em', color: 'rgb(255 255 255 / 0.42)' }}>
                  {[formatDate(item.date), item.place?.name].filter(Boolean).join(' · ')}
                </p>
              )}
              {item.caption && (
                <p className="serif mt-5 text-[15px] leading-[1.72]" style={{ color: 'rgb(255 255 255 / 0.74)' }}>
                  {item.caption}
                </p>
              )}

              {tagged.length > 0 && (
                <div className="mt-7">
                  <p className="text-[10.5px] uppercase" style={{ letterSpacing: '0.18em', color: 'rgb(255 255 255 / 0.36)' }}>
                    In this photograph
                  </p>
                  <div className="mt-3 space-y-1">
                    {tagged.map((p) => (
                      <button
                        key={p!.id}
                        type="button"
                        onClick={() => { select(p!.id); go('tree'); onClose(); }}
                        className="flex w-full items-center gap-3 rounded-[9px] py-1.5 pl-1 pr-3 text-left"
                      >
                        <Portrait person={p!} size={30} shape="circle" />
                        <span className="text-[13px]">{fullName(p!)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-8 text-[11px]" style={{ color: 'rgb(255 255 255 / 0.3)' }}>
                {current + 1} of {media.length}
              </p>
            </motion.aside>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

function NavBtn({ side, disabled, onClick }: { side: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      className="absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full transition-opacity"
      style={{
        [side]: 10,
        background: 'rgb(255 255 255 / 0.06)',
        color: '#efe6d9',
        opacity: disabled ? 0.18 : 0.75,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d={side === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
