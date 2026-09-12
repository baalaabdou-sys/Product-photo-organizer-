import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useArchive } from '../data/store';
import { search, type SearchHit } from '../domain/search';
import { Portrait } from './Portrait';
import { haptic } from '../lib/haptics';
import { swift } from '../lib/motion';

const SUGGESTIONS = ['Casablanca', '1948', 'teacher', 'Fès'];

export function SearchPalette() {
  const open = useArchive((s) => s.searchOpen);
  const setOpen = useArchive((s) => s.setSearchOpen);
  const graph = useArchive((s) => s.graph);
  const stories = useArchive((s) => s.data.stories);
  const events = useArchive((s) => s.data.events);
  const select = useArchive((s) => s.select);
  const go = useArchive((s) => s.go);

  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const hits = useMemo(
    () => (open ? search(q, graph, stories, events) : []),
    [q, graph, stories, events, open],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => { setActive(0); }, [q]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (hit: SearchHit) => {
    haptic('focus');
    setOpen(false);
    if (hit.personId) {
      select(hit.personId);
      go('tree');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { setActive((a) => Math.min(a + 1, hits.length - 1)); e.preventDefault(); }
    if (e.key === 'ArrowUp') { setActive((a) => Math.max(a - 1, 0)); e.preventDefault(); }
    if (e.key === 'Enter' && hits[active]) { choose(hits[active]); e.preventDefault(); }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[80]"
            style={{ background: 'rgb(var(--c-shadow) / 0.32)', backdropFilter: 'blur(3px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={swift}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search the family archive"
            className="fixed left-1/2 z-[81] w-[min(620px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[16px]"
            style={{
              top: 'max(calc(var(--safe-t) + 12px), 7vh)',
              background: 'rgb(var(--c-paper))',
              border: '1px solid rgb(var(--c-rule))',
              boxShadow: '0 40px 90px -40px rgb(var(--c-shadow)/0.55)',
            }}
            initial={{ opacity: 0, y: -12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={swift}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 px-5" style={{ borderBottom: '1px solid rgb(var(--c-rule) / 0.7)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgb(var(--c-faint))" strokeWidth="1.4" aria-hidden="true">
                <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="A name, a year, a place, a trade…"
                aria-label="Search"
                className="serif w-full bg-transparent py-4 text-[19px] outline-none"
                style={{ color: 'rgb(var(--c-ink))' }}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm shrink-0"
                onClick={() => setOpen(false)}
                style={{ minHeight: 32 }}
              >
                Esc
              </button>
            </div>

            <ul
              ref={listRef}
              role="listbox"
              aria-label="Results"
              className="max-h-[min(52vh,430px)] overflow-y-auto overscroll-contain py-2"
            >
              {hits.map((hit, i) => {
                const person = hit.personId ? graph.person(hit.personId) : undefined;
                return (
                  <li key={hit.id} role="option" aria-selected={i === active} data-active={i === active}>
                    <button
                      type="button"
                      onClick={() => choose(hit)}
                      onMouseEnter={() => setActive(i)}
                      className="flex w-full items-center gap-3.5 px-5 py-2.5 text-left"
                      style={{ background: i === active ? 'rgb(var(--c-paper-2))' : 'transparent' }}
                    >
                      {person
                        ? <Portrait person={person} size={38} shape="circle" />
                        : <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full"
                                style={{ background: 'rgb(var(--c-paper-3))', color: 'rgb(var(--c-gold))' }}>
                            {hit.kind === 'story' ? '❧' : '·'}
                          </span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate serif text-[16px]">{hit.title}</span>
                        <span className="block truncate text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
                          {hit.kind === 'person' ? hit.subtitle : `${labelFor(hit.kind)} · ${hit.subtitle}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}

              {!hits.length && q.trim() && (
                <li className="px-5 py-8 text-center">
                  <p className="serif text-[15px] italic" style={{ color: 'rgb(var(--c-muted))' }}>
                    Nothing in the archive matches “{q.trim()}”.
                  </p>
                </li>
              )}

              {!q.trim() && (
                <li className="px-5 py-5">
                  <p className="label mb-2.5">Try</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" className="chip" onClick={() => setQ(s)}>{s}</button>
                    ))}
                  </div>
                </li>
              )}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const labelFor = (k: SearchHit['kind']) =>
  k === 'story' ? 'Story' : k === 'event' ? 'Moment' : k === 'place' ? 'Place' : 'Person';
