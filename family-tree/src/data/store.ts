import { create } from 'zustand';
import type { FamilyData, ID, Person, Role, Union, ParentChild, Story, FamilyEvent, Media } from '../domain/types';
import { emptyFamily } from '../domain/types';
import { FamilyGraph } from '../domain/graph';
import { demoFamily, DEMO_ME } from './demo';
import { loadArchive, saveArchive, snapshot, getSetting, setSetting, flushArchive } from './db';

export type ViewKey =
  | 'home' | 'tree' | 'generations' | 'timeline' | 'archive'
  | 'map' | 'constellation' | 'settings' | 'print';

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface UIState {
  view: ViewKey;
  selectedId: ID | null;
  /** Person the viewer identifies as — powers every "your relationship" label. */
  meId: ID | null;
  /** Path currently highlighted in the tree. */
  highlightPath: ID[] | null;
  legacyId: ID | null;
  branchFilter: ID | null;
  searchOpen: boolean;
  role: Role;
  theme: ThemeChoice;
  introSeen: boolean;
  reducedData: boolean;
}

interface ArchiveState extends UIState {
  data: FamilyData;
  graph: FamilyGraph;
  ready: boolean;
  hasDemo: boolean;
  toast: { id: number; message: string; action?: { label: string; run: () => void } } | null;

  init: () => Promise<void>;
  setData: (next: FamilyData, opts?: { snapshotReason?: string }) => void;
  replaceAll: (next: FamilyData, reason: string) => Promise<void>;

  go: (view: ViewKey) => void;
  select: (id: ID | null) => void;
  setMe: (id: ID | null) => void;
  setHighlight: (path: ID[] | null) => void;
  setLegacy: (id: ID | null) => void;
  setBranch: (id: ID | null) => void;
  setSearchOpen: (open: boolean) => void;
  setTheme: (t: ThemeChoice) => void;
  setRole: (r: Role) => void;
  markIntroSeen: () => void;
  notify: (message: string, action?: { label: string; run: () => void }) => void;
  dismissToast: () => void;

  upsertPerson: (p: Person) => void;
  removePerson: (id: ID) => void;
  upsertUnion: (u: Union) => void;
  removeUnion: (id: ID) => void;
  addParentage: (link: ParentChild) => void;
  removeParentage: (parentId: ID, childId: ID) => void;
  upsertStory: (s: Story) => void;
  removeStory: (id: ID) => void;
  upsertEvent: (e: FamilyEvent) => void;
  removeEvent: (id: ID) => void;
  upsertMedia: (m: Media) => void;
  removeMedia: (id: ID) => void;
  removeDemoData: () => void;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const useArchive = create<ArchiveState>((set, get) => ({
  data: emptyFamily(),
  graph: new FamilyGraph(emptyFamily()),
  ready: false,
  hasDemo: false,
  toast: null,

  view: 'home',
  selectedId: null,
  meId: null,
  highlightPath: null,
  legacyId: null,
  branchFilter: null,
  searchOpen: false,
  role: 'admin',
  theme: 'system',
  introSeen: false,
  reducedData: false,

  async init() {
    const [stored, meId, theme, introSeen, role] = await Promise.all([
      loadArchive(),
      getSetting<ID | null>('meId', null),
      getSetting<ThemeChoice>('theme', 'system'),
      getSetting<boolean>('introSeen', false),
      getSetting<Role>('role', 'admin'),
    ]);

    let data = stored;
    let me = meId;
    if (!data || !data.people.length) {
      data = demoFamily();
      me = DEMO_ME;
      saveArchive(data);
      void setSetting('meId', me);
    }
    applyTheme(theme);
    set({
      data,
      graph: new FamilyGraph(data),
      hasDemo: data.people.some((p) => p.metadata.demo),
      meId: me && data.people.some((p) => p.id === me) ? me : null,
      theme, introSeen, role,
      ready: true,
    });
  },

  setData(next, opts) {
    if (opts?.snapshotReason) void snapshot(opts.snapshotReason, get().data);
    saveArchive(next);
    set({
      data: next,
      graph: new FamilyGraph(next),
      hasDemo: next.people.some((p) => p.metadata.demo),
    });
  },

  async replaceAll(next, reason) {
    await snapshot(reason, get().data);
    saveArchive(next);
    await flushArchive();
    const me = get().meId;
    set({
      data: next,
      graph: new FamilyGraph(next),
      hasDemo: next.people.some((p) => p.metadata.demo),
      meId: me && next.people.some((p) => p.id === me) ? me : null,
      selectedId: null,
      highlightPath: null,
      legacyId: null,
      branchFilter: null,
    });
  },

  go(view) { set({ view, searchOpen: false }); },
  select(id) { set({ selectedId: id }); },
  setMe(id) { set({ meId: id }); void setSetting('meId', id); },
  setHighlight(path) { set({ highlightPath: path }); },
  setLegacy(id) { set({ legacyId: id }); },
  setBranch(id) { set({ branchFilter: id }); },
  setSearchOpen(open) { set({ searchOpen: open }); },
  setTheme(t) { set({ theme: t }); applyTheme(t); void setSetting('theme', t); },
  setRole(r) { set({ role: r }); void setSetting('role', r); },
  markIntroSeen() { set({ introSeen: true }); void setSetting('introSeen', true); },
  notify(message, action) { set({ toast: { id: Date.now(), message, action } }); },
  dismissToast() { set({ toast: null }); },

  upsertPerson(p) {
    const data = clone(get().data);
    const i = data.people.findIndex((x) => x.id === p.id);
    const next = { ...p, metadata: { ...p.metadata, updatedAt: Date.now(), demo: false } };
    if (i >= 0) data.people[i] = next; else data.people.push(next);
    get().setData(data);
  },

  removePerson(id) {
    const data = clone(get().data);
    data.people = data.people.filter((p) => p.id !== id);
    data.unions = data.unions.filter((u) => u.personA !== id && u.personB !== id);
    data.parentage = data.parentage.filter((r) => r.parentId !== id && r.childId !== id);
    data.stories = data.stories.map((s) => ({ ...s, personIds: s.personIds.filter((x) => x !== id) }));
    data.events = data.events.map((e) => ({ ...e, personIds: e.personIds.filter((x) => x !== id) }));
    data.media = data.media.map((m) => ({ ...m, tags: m.tags.filter((tg) => tg.personId !== id) }));
    get().setData(data, { snapshotReason: 'Before removing a person' });
    const s = get();
    set({
      selectedId: s.selectedId === id ? null : s.selectedId,
      meId: s.meId === id ? null : s.meId,
      legacyId: s.legacyId === id ? null : s.legacyId,
      highlightPath: null,
    });
  },

  upsertUnion(u) {
    const data = clone(get().data);
    const i = data.unions.findIndex((x) => x.id === u.id);
    if (i >= 0) data.unions[i] = u; else data.unions.push(u);
    get().setData(data);
  },
  removeUnion(id) {
    const data = clone(get().data);
    data.unions = data.unions.filter((u) => u.id !== id);
    data.parentage = data.parentage.map((r) => (r.unionId === id ? { ...r, unionId: undefined } : r));
    get().setData(data);
  },

  addParentage(link) {
    const data = clone(get().data);
    if (data.parentage.some((r) => r.parentId === link.parentId && r.childId === link.childId)) return;
    data.parentage.push(link);
    get().setData(data);
  },
  removeParentage(parentId, childId) {
    const data = clone(get().data);
    data.parentage = data.parentage.filter((r) => !(r.parentId === parentId && r.childId === childId));
    get().setData(data);
  },

  upsertStory(s) {
    const data = clone(get().data);
    const i = data.stories.findIndex((x) => x.id === s.id);
    if (i >= 0) data.stories[i] = s; else data.stories.push(s);
    get().setData(data);
  },
  removeStory(id) {
    const data = clone(get().data);
    data.stories = data.stories.filter((s) => s.id !== id);
    get().setData(data);
  },

  upsertEvent(e) {
    const data = clone(get().data);
    const i = data.events.findIndex((x) => x.id === e.id);
    if (i >= 0) data.events[i] = e; else data.events.push(e);
    get().setData(data);
  },
  removeEvent(id) {
    const data = clone(get().data);
    data.events = data.events.filter((e) => e.id !== id);
    get().setData(data);
  },

  upsertMedia(m) {
    const data = clone(get().data);
    const i = data.media.findIndex((x) => x.id === m.id);
    if (i >= 0) data.media[i] = m; else data.media.push(m);
    get().setData(data);
  },
  removeMedia(id) {
    const data = clone(get().data);
    data.media = data.media.filter((m) => m.id !== id);
    data.stories = data.stories.map((s) => ({ ...s, mediaIds: s.mediaIds.filter((x) => x !== id) }));
    data.people = data.people.map((p) => (p.photoId === id ? { ...p, photoId: undefined } : p));
    get().setData(data);
  },

  removeDemoData() {
    const data = clone(get().data);
    const demoIds = new Set(data.people.filter((p) => p.metadata.demo).map((p) => p.id));
    data.people = data.people.filter((p) => !demoIds.has(p.id));
    data.unions = data.unions.filter((u) => !demoIds.has(u.personA) && !demoIds.has(u.personB));
    data.parentage = data.parentage.filter((r) => !demoIds.has(r.parentId) && !demoIds.has(r.childId));
    data.stories = data.stories.filter((s) => !s.metadata.demo);
    data.events = data.events.filter((e) => !e.metadata.demo);
    data.media = data.media.filter((m) => !m.metadata.demo);
    data.branches = data.branches.filter((b) => !b.metadata.demo);
    data.places = data.places.filter((p) => !p.metadata.demo);
    get().setData(data, { snapshotReason: 'Before removing the demonstration family' });
    set({ selectedId: null, meId: null, highlightPath: null, legacyId: null });
  },
}));

export function applyTheme(t: ThemeChoice) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  for (const el of document.querySelectorAll('meta[name="theme-color"]')) {
    el.setAttribute('content', dark ? '#171311' : '#f8f4ec');
  }
}

/** Newly generated ids stay opaque — never a name, never anything sensitive. */
export const newId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
