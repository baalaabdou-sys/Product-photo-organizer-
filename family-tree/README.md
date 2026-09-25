# Abderrahmane Family Tree

A private, offline-first family archive: an interactive genealogy canvas, a
generation explorer, a timeline, a map, a photograph and story archive, and a
GEDCOM importer/exporter — built as an installable Progressive Web App.

Everything lives on the device. There is no server, no account, and nothing is
uploaded anywhere. Moving the archive between devices is done with an explicit
export.

## The family

The app ships with the Abderrahmane family as recorded in FamilyEcho on
25 September 2026: 76 people across five generations, transcribed from the
FamilyEcho chart into `src/data/family.json`. The chart records names,
gender, partnerships and parents, but no dates or places, so none are stored.
Two parents FamilyEcho shows only as "Father of / Mother of Halima" are kept
as والد حليمة and والدة حليمة.

A first visit loads this family. After that, each device keeps its own edited
copy in the browser, and shipping a new `family.json` does not overwrite it.

To bring in a newer version later, export a GEDCOM from FamilyEcho
(**Download → GEDCOM**) and use **Settings → Import family tree**. Nothing is
written until you confirm the preview, and a restore point is saved first.
Export is available as GEDCOM 5.5.1, full JSON, CSV, and a typeset print view.

## Running it

```sh
npm install
npm run dev        # development server
npm run build      # type-check, then production build to dist/
npm run preview    # serve the production build
npm run icons      # regenerate the app icons from scripts/generate-icons.mjs
```

`dist/` is a static bundle — any static host will serve it. The service worker
and manifest make it installable on iOS, Android and desktop.

> **Note:** never run `tsc` with emit enabled. The build is `tsc --noEmit &&
> vite build`; emitted `.js` files would sit beside the `.tsx` sources and Vite
> would resolve those stale copies first. `.gitignore` excludes `src/**/*.js`.

## Architecture

```
src/
  domain/       Relationship logic, independent of any UI
    types.ts        Person, Union, ParentChild, Story, Event, Media, Place, Branch
    dates.ts        Fuzzy historical dates ("about 1948", "BEF 1900") + GEDCOM dates
    graph.ts        FamilyGraph — indexed adjacency, generations, cycle-safe walks
    relationships.ts Bidirectional BFS paths + kinship naming (cousins, removed, in-laws)
    validate.ts     Non-destructive integrity review; never auto-corrects
    stats.ts        Derived counts, today's anniversaries, timeline, generation bands
    search.ts       Names, years, places, trades
  gedcom/       parse.ts · serialize.ts · import.ts (preview + merge)
  layout/       treeLayout.ts — tidy layered layout, one bus per sibling group
  data/         db.ts (Dexie/IndexedDB) · store.ts (Zustand) · demo.ts
  components/   Canvas, nodes, sheets, editors, search, viewer
  views/        Home, Tree, Generations, Timeline, Archive, Map, Constellation,
                Legacy, Settings, Print
  lib/          motion · haptics · privacy · images
```

Relationship logic never imports from `components/` or `views/`, so the graph,
the kinship naming and the GEDCOM round-trip can be reasoned about — and
changed — without touching presentation.

### Notes on a few decisions

**Layout.** Couples share one junction and their children hang from a single
horizontal bus beneath it. That is what stops connectors turning into spaghetti
as the family grows: every sibling group has exactly one vertical drop and one
horizontal run. Subtrees are placed children-first and shifted right when a
generation runs out of room, so nodes never overlap.

**Performance.** Nodes outside the viewport are not rendered, node detail drops
to a compact plate and then to a point as you zoom out, relationship badges are
skipped past ~260 visible nodes, media blobs live in a separate IndexedDB table
so the archive document stays small, and the constellation view paints to
canvas rather than the DOM.

**Privacy.** `lib/privacy.ts` gates every detail field. Living people's details
are hidden below "family member" level; contact details are never shown below
"editor", whatever the per-person setting says. Names and position in the tree
stay visible so the tree remains readable. No identifier that reaches a URL
carries personal data.

**Bad data.** `validate.ts` reports circular ancestry, children born before
their parents, posthumous births and marriages, impossible lifespans, more than
two biological parents, likely duplicates, and disconnected people. All of it
surfaces as warnings — the editor shows them live while you type and still lets
you save, because a real record sometimes looks wrong.

## Accessibility

Semantic landmarks, a skip link, keyboard navigation through the tree (arrows
move between relatives, Enter opens a record, `+`/`-`/`0` zoom and fit),
focus-visible rings, focus trapping and restoration in every sheet and modal,
live regions for selection changes, 44px minimum touch targets, and full
`prefers-reduced-motion` support — the intro, the camera tweens, the branch
loader and every transition all collapse to instant.
