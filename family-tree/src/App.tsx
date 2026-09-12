import { Suspense, lazy, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useArchive } from './data/store';
import { Navigation } from './components/Navigation';
import { Intro } from './components/Intro';
import { SearchPalette } from './components/SearchPalette';
import { Toast } from './components/Toast';
import { PersonPanel } from './components/PersonPanel';
import { BranchLoader } from './components/BranchLoader';
import { TreeView } from './views/TreeView';
import { Home } from './views/Home';
import { pageVariants } from './lib/motion';
import { flushArchive } from './data/db';
import type { ID } from './domain/types';

// Secondary views load on demand — the first paint only needs home and tree.
const Generations = lazy(() => import('./views/Generations').then((m) => ({ default: m.Generations })));
const Timeline = lazy(() => import('./views/Timeline').then((m) => ({ default: m.Timeline })));
const Archive = lazy(() => import('./views/Archive').then((m) => ({ default: m.Archive })));
const FamilyMap = lazy(() => import('./views/FamilyMap').then((m) => ({ default: m.FamilyMap })));
const Constellation = lazy(() => import('./views/Constellation').then((m) => ({ default: m.Constellation })));
const Settings = lazy(() => import('./views/Settings').then((m) => ({ default: m.Settings })));
const PrintView = lazy(() => import('./views/PrintView').then((m) => ({ default: m.PrintView })));
const Legacy = lazy(() => import('./views/Legacy').then((m) => ({ default: m.Legacy })));

export default function App() {
  const ready = useArchive((s) => s.ready);
  const init = useArchive((s) => s.init);
  const view = useArchive((s) => s.view);
  const introSeen = useArchive((s) => s.introSeen);
  const markIntroSeen = useArchive((s) => s.markIntroSeen);
  const legacyId = useArchive((s) => s.legacyId);
  const selectedId = useArchive((s) => s.selectedId);
  const select = useArchive((s) => s.select);
  const setHighlight = useArchive((s) => s.setHighlight);

  const [introDone, setIntroDone] = useState(false);
  const [panelId, setPanelId] = useState<ID | null>(null);

  useEffect(() => { void init(); }, [init]);

  // Persist immediately when the app is backgrounded — phones kill tabs freely.
  useEffect(() => {
    const flush = () => { void flushArchive(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Escape always steps back one layer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (panelId) setPanelId(null);
      else setHighlight(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelId, setHighlight]);

  const openPerson = (id: ID) => { select(id); setPanelId(id); };

  if (!ready) {
    return (
      <div className="grid h-full place-items-center" style={{ background: 'rgb(var(--c-paper))' }}>
        <BranchLoader />
        <span className="sr-only">Opening the family archive</span>
      </div>
    );
  }

  const fullBleed = view === 'tree' || view === 'constellation' || view === 'generations' || view === 'timeline';

  return (
    <div className="flex h-full flex-col" style={{ minHeight: '100dvh' }}>
      {!introDone && (
        <Intro
          short={introSeen}
          onDone={() => { setIntroDone(true); markIntroSeen(); }}
        />
      )}

      <Navigation />

      <main
        id="main"
        className="relative min-h-0 flex-1"
        style={{
          paddingBottom: fullBleed ? 0 : 'calc(var(--safe-b) + var(--nav-h))',
          overflow: fullBleed ? 'hidden' : 'auto',
          overscrollBehaviorY: 'contain',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="h-full"
            style={{ minHeight: fullBleed ? '100%' : undefined }}
          >
            <Suspense fallback={<ViewLoading />}>
              {view === 'home' && <Home />}
              {view === 'tree' && <TreeView onOpenPerson={openPerson} />}
              {view === 'generations' && <Generations />}
              {view === 'timeline' && <Timeline />}
              {view === 'archive' && <Archive />}
              {view === 'map' && <FamilyMap />}
              {view === 'constellation' && <Constellation />}
              {view === 'settings' && <Settings />}
              {view === 'print' && <PrintView />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <PersonPanel personId={panelId} onClose={() => setPanelId(null)} />

      <AnimatePresence>
        {legacyId && (
          <Suspense fallback={null}>
            <Legacy personId={legacyId} />
          </Suspense>
        )}
      </AnimatePresence>

      <SearchPalette />
      <Toast />

      <span className="sr-only" aria-live="polite">
        {selectedId ? '' : ''}
      </span>
    </div>
  );
}

/** Skeleton that matches the shape of what is arriving, not a spinner. */
function ViewLoading() {
  return (
    <div className="grid h-full min-h-[50vh] place-items-center">
      <BranchLoader size={96} />
      <span className="sr-only">Loading</span>
    </div>
  );
}
