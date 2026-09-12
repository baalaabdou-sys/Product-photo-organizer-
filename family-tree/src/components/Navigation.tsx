import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useArchive, type ViewKey } from '../data/store';
import { useIsDesktop } from '../hooks/useMedia';
import { haptic } from '../lib/haptics';
import { RelationshipFinder } from './RelationshipFinder';

const PRIMARY: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: 'home', label: 'Home', icon: <IconHome /> },
  { key: 'tree', label: 'Tree', icon: <IconTree /> },
  { key: 'archive', label: 'Archive', icon: <IconArchive /> },
];

const SECONDARY: Array<{ key: ViewKey; label: string; detail: string }> = [
  { key: 'generations', label: 'Generations', detail: 'The family one layer at a time' },
  { key: 'timeline', label: 'Timeline', detail: 'Every recorded year' },
  { key: 'map', label: 'Family Map', detail: 'Where we have lived' },
  { key: 'constellation', label: 'Constellation', detail: 'The family as points of light' },
  { key: 'settings', label: 'Settings', detail: 'Import, export, permissions' },
];

export function Navigation() {
  const view = useArchive((s) => s.view);
  const go = useArchive((s) => s.go);
  const setSearchOpen = useArchive((s) => s.setSearchOpen);
  const desktop = useIsDesktop();
  const [menuOpen, setMenuOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);

  const pick = (v: ViewKey) => { go(v); setMenuOpen(false); haptic('focus'); };

  if (desktop) {
    return (
      <>
        <header
          className="no-print sticky top-0 z-50"
          style={{
            paddingTop: 'var(--safe-t)',
            background: 'rgb(var(--c-paper) / 0.82)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgb(var(--c-rule) / 0.6)',
          }}
        >
          <div className="mx-auto flex h-[58px] max-w-[1180px] items-center gap-1 px-6">
            <button
              type="button"
              onClick={() => pick('home')}
              className="-my-2 mr-5 flex items-baseline gap-2.5 py-3"
              aria-label="Abderrahmane Family Tree, home"
            >
              <span className="serif text-[17px]" style={{ letterSpacing: '0.14em' }}>AF</span>
              <span className="text-[10px] uppercase" style={{ letterSpacing: '0.2em', color: 'rgb(var(--c-faint))' }}>
                Abderrahmane
              </span>
            </button>

            {[...PRIMARY, ...SECONDARY.slice(0, 3)].map((item) => (
              <NavLink key={item.key} active={view === item.key} onClick={() => pick(item.key)}>
                {item.label}
              </NavLink>
            ))}

            <div className="flex-1" />

            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFinderOpen(true)}>
              Relationship between…
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the archive"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" strokeLinecap="round" />
              </svg>
              Search
              <kbd className="ml-1 text-[10px] tabular-nums" style={{ color: 'rgb(var(--c-faint))' }}>⌘K</kbd>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMenuOpen(true)}
              aria-label="More"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
          </div>
        </header>

        <MoreMenu open={menuOpen} onClose={() => setMenuOpen(false)} onPick={pick} view={view} />
        {finderOpen && <RelationshipFinder onClose={() => setFinderOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-50 flex items-stretch"
        style={{
          height: 'calc(var(--nav-h) + var(--safe-b))',
          paddingBottom: 'var(--safe-b)',
          background: 'rgb(var(--c-paper) / 0.9)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderTop: '1px solid rgb(var(--c-rule) / 0.7)',
        }}
        aria-label="Main"
      >
        {PRIMARY.map((item) => (
          <TabButton key={item.key} active={view === item.key} label={item.label} onClick={() => pick(item.key)}>
            {item.icon}
          </TabButton>
        ))}
        <TabButton active={false} label="Search" onClick={() => { setSearchOpen(true); haptic('focus'); }}>
          <IconSearch />
        </TabButton>
        <TabButton
          active={SECONDARY.some((s) => s.key === view)}
          label="More"
          onClick={() => { setMenuOpen(true); haptic('focus'); }}
        >
          <IconMore />
        </TabButton>
      </nav>

      <MoreMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPick={pick}
        view={view}
        onFinder={() => { setMenuOpen(false); setFinderOpen(true); }}
      />
      {finderOpen && <RelationshipFinder onClose={() => setFinderOpen(false)} />}
    </>
  );
}

function NavLink({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="relative rounded-full px-3.5 py-2 text-[12.5px] transition-colors"
      style={{ color: active ? 'rgb(var(--c-ink))' : 'rgb(var(--c-muted))' }}
    >
      {children}
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute inset-x-3.5 bottom-[3px] h-px"
          style={{ background: 'rgb(var(--c-gold))' }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        />
      )}
    </button>
  );
}

function TabButton({
  active, label, onClick, children,
}: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="relative flex flex-1 flex-col items-center justify-center gap-[3px]"
      style={{ color: active ? 'rgb(var(--c-ink))' : 'rgb(var(--c-faint))', minHeight: 48 }}
    >
      {children}
      <span className="text-[9.5px]" style={{ letterSpacing: '0.05em' }}>{label}</span>
      {active && (
        <motion.span
          layoutId="tab-dot"
          className="absolute top-[7px] h-[3px] w-[3px] rounded-full"
          style={{ background: 'rgb(var(--c-gold))' }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        />
      )}
    </button>
  );
}

function MoreMenu({
  open, onClose, onPick, view, onFinder,
}: {
  open: boolean; onClose: () => void; onPick: (v: ViewKey) => void; view: ViewKey; onFinder?: () => void;
}) {
  const desktop = useIsDesktop();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[62]"
            style={{ background: 'rgb(var(--c-shadow) / 0.3)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="More places to explore"
            className="fixed z-[63] overflow-hidden"
            style={desktop
              ? {
                  top: 'calc(var(--safe-t) + 62px)', right: 22, width: 300,
                  background: 'rgb(var(--c-paper))', border: '1px solid rgb(var(--c-rule))',
                  borderRadius: 14, boxShadow: '0 30px 70px -34px rgb(var(--c-shadow)/0.5)',
                }
              : {
                  left: 0, right: 0, bottom: 0,
                  background: 'rgb(var(--c-paper))',
                  borderTop: '1px solid rgb(var(--c-rule))',
                  borderRadius: '20px 20px 0 0',
                  paddingBottom: 'calc(var(--safe-b) + 12px)',
                  boxShadow: '0 -10px 60px -26px rgb(var(--c-shadow)/0.45)',
                }}
            initial={desktop ? { opacity: 0, y: -8 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, y: -6 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 240, damping: 28 }}
          >
            {!desktop && (
              <div className="flex justify-center pb-1 pt-2.5" aria-hidden="true">
                <div className="h-1 w-9 rounded-full" style={{ background: 'rgb(var(--c-rule))' }} />
              </div>
            )}
            <ul className="py-2">
              {SECONDARY.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onPick(item.key)}
                    className="flex w-full flex-col px-5 py-3 text-left transition-colors"
                    style={{ background: view === item.key ? 'rgb(var(--c-paper-2))' : 'transparent' }}
                  >
                    <span className="serif text-[16px]">{item.label}</span>
                    <span className="text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>{item.detail}</span>
                  </button>
                </li>
              ))}
              {onFinder && (
                <li className="hairline mt-2 pt-2">
                  <button type="button" onClick={onFinder} className="flex w-full flex-col px-5 py-3 text-left">
                    <span className="serif text-[16px]">Relationship between…</span>
                    <span className="text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
                      How any two relatives connect
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Icons: 1.3px strokes, no fills, consistent 16px grid ──
function IconHome() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M3.5 8.5L10 3.5l6.5 5V16a.5.5 0 01-.5.5h-4v-5h-4v5h-4a.5.5 0 01-.5-.5V8.5z" strokeLinejoin="round" />
    </svg>
  );
}
function IconTree() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="10" cy="4" r="2" /><circle cx="5" cy="16" r="2" /><circle cx="15" cy="16" r="2" />
      <path d="M10 6v3.5M5 14v-2.5h10V14" strokeLinecap="round" />
    </svg>
  );
}
function IconArchive() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="3.5" y="5.5" width="13" height="11" rx="1.5" /><path d="M3.5 8.5h13M8 12h4" strokeLinecap="round" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2L17 17" strokeLinecap="round" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="4.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
