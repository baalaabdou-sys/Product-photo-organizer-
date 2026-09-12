import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useArchive } from '../data/store';
import { Portrait } from '../components/Portrait';
import { fullName } from '../domain/relationships';
import { lifespan } from '../domain/dates';
import { Centered } from './Generations';
import type { ID, Person } from '../domain/types';
import { haptic } from '../lib/haptics';

interface PlaceGroup {
  name: string;
  lat?: number;
  lon?: number;
  born: Person[];
  died: Person[];
  buried: Person[];
  married: Person[][];
  total: number;
}

/**
 * Where the family has lived. Drawn as a projected constellation of places
 * rather than a street map — precise addresses are never plotted, and the
 * archive holds no tile keys or third-party requests.
 */
export function FamilyMap() {
  const graph = useArchive((s) => s.graph);
  const data = useArchive((s) => s.data);
  const select = useArchive((s) => s.select);
  const go = useArchive((s) => s.go);
  const [activeName, setActiveName] = useState<string | null>(null);

  const groups = useMemo<PlaceGroup[]>(() => {
    const byName = new Map<string, PlaceGroup>();
    const ensure = (name: string): PlaceGroup => {
      const key = name.trim();
      let g = byName.get(key);
      if (!g) {
        const known = data.places.find((p) => p.name.toLowerCase() === key.toLowerCase());
        g = { name: key, lat: known?.lat, lon: known?.lon, born: [], died: [], buried: [], married: [], total: 0 };
        byName.set(key, g);
      }
      return g;
    };
    for (const p of graph.people.values()) {
      if (p.birthPlace?.name) { ensure(p.birthPlace.name).born.push(p); }
      if (p.deathPlace?.name) { ensure(p.deathPlace.name).died.push(p); }
      if (p.burialPlace?.name) { ensure(p.burialPlace.name).buried.push(p); }
    }
    for (const u of graph.unions.values()) {
      if (!u.place?.name) continue;
      const a = graph.person(u.personA), b = graph.person(u.personB);
      if (a && b) ensure(u.place.name).married.push([a, b]);
    }
    for (const g of byName.values()) {
      g.total = g.born.length + g.died.length + g.buried.length + g.married.length;
    }
    return [...byName.values()].filter((g) => g.total > 0).sort((a, b) => b.total - a.total);
  }, [graph, data.places]);

  const plotted = groups.filter((g) => g.lat != null && g.lon != null);
  const active = groups.find((g) => g.name === activeName);

  if (!groups.length) {
    return (
      <Centered>
        <p className="serif max-w-[26rem] text-[17px] italic" style={{ color: 'rgb(var(--c-muted))' }}>
          No places have been recorded yet. Add a birthplace to someone and the family's
          geography will begin to appear here.
        </p>
      </Centered>
    );
  }

  const open = (id: ID) => { select(id); go('tree'); haptic('focus'); };

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-28 sm:px-8">
      <header className="pt-6">
        <p className="label">Where we have lived</p>
        <h1 className="display mt-2 text-[clamp(32px,8vw,54px)]">Family Map</h1>
        <p className="mt-3 text-[12.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
          {groups.length} {groups.length === 1 ? 'place' : 'places'} recorded.
          Exact addresses are never shown here.
        </p>
      </header>

      {plotted.length > 1 && (
        <Projection places={plotted} activeName={activeName} onPick={setActiveName} />
      )}

      <ul className="mt-10 space-y-0">
        {groups.map((g, i) => {
          const on = g.name === activeName;
          return (
            <li key={g.name} style={{ borderTop: i ? '1px solid rgb(var(--c-rule) / 0.55)' : 'none' }}>
              <button
                type="button"
                onClick={() => setActiveName(on ? null : g.name)}
                aria-expanded={on}
                className="flex w-full items-baseline gap-4 py-4 text-left"
              >
                <span className="serif flex-1 text-[clamp(19px,4.6vw,25px)] leading-tight">{g.name}</span>
                <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: 'rgb(var(--c-faint))' }}>
                  {g.total} {g.total === 1 ? 'record' : 'records'}
                </span>
              </button>

              {on && active && (
                <motion.div
                  className="pb-6"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Group label="Born here" people={active.born} onPick={open} />
                  <Group label="Died here" people={active.died} onPick={open} />
                  <Group label="Resting here" people={active.buried} onPick={open} />
                  {active.married.length > 0 && (
                    <div className="mt-4">
                      <p className="label mb-2">Married here</p>
                      <ul className="space-y-1">
                        {active.married.map(([a, b], j) => (
                          <li key={j} className="text-[13.5px]" style={{ color: 'rgb(var(--c-ink-soft))' }}>
                            <button type="button" onClick={() => open(a.id)} className="underline underline-offset-2">{a.firstName}</button>
                            {' and '}
                            <button type="button" onClick={() => open(b.id)} className="underline underline-offset-2">{b.firstName}</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Group({ label, people, onPick }: { label: string; people: Person[]; onPick: (id: ID) => void }) {
  if (!people.length) return null;
  return (
    <div className="mt-4">
      <p className="label mb-2">{label}</p>
      <div className="flex flex-wrap gap-x-1 gap-y-1">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            className="flex items-center gap-2.5 rounded-[10px] py-1.5 pl-1.5 pr-3"
          >
            <Portrait person={p} size={30} shape="circle" />
            <span className="text-left">
              <span className="block text-[13px] leading-tight">{fullName(p)}</span>
              <span className="block text-[10px] tabular-nums" style={{ color: 'rgb(var(--c-faint))' }}>
                {lifespan(p.birthDate, p.deathDate)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** An equirectangular plot of the family's places — no tiles, no requests. */
function Projection({
  places, activeName, onPick,
}: { places: PlaceGroup[]; activeName: string | null; onPick: (name: string) => void }) {
  const lats = places.map((p) => p.lat!);
  const lons = places.map((p) => p.lon!);
  const pad = 6;
  const minLat = Math.min(...lats) - 2, maxLat = Math.max(...lats) + 2;
  const minLon = Math.min(...lons) - 2, maxLon = Math.max(...lons) + 2;
  const W = 100, H = 62;
  const px = (lon: number) => pad + ((lon - minLon) / Math.max(0.0001, maxLon - minLon)) * (W - pad * 2);
  const py = (lat: number) => pad + ((maxLat - lat) / Math.max(0.0001, maxLat - minLat)) * (H - pad * 2);
  const maxTotal = Math.max(...places.map((p) => p.total));

  return (
    <div
      className="mt-8 overflow-hidden rounded-[16px]"
      style={{ background: 'rgb(var(--c-paper-2))', border: '1px solid rgb(var(--c-rule) / 0.7)' }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ aspectRatio: `${W}/${H}` }} role="img" aria-label="Family places">
        {/* Faint lines between places tell the story of the family's movement. */}
        {places.slice(1).map((p, i) => (
          <line
            key={p.name}
            x1={px(places[i].lon!)} y1={py(places[i].lat!)}
            x2={px(p.lon!)} y2={py(p.lat!)}
            stroke="rgb(var(--c-gold) / 0.2)" strokeWidth="0.25" strokeDasharray="1 1.5"
          />
        ))}
        {places.map((p) => {
          const on = p.name === activeName;
          const r = 1 + (p.total / maxTotal) * 2.2;
          return (
            <g key={p.name} onClick={() => onPick(p.name)} style={{ cursor: 'pointer' }}>
              <circle cx={px(p.lon!)} cy={py(p.lat!)} r={r + 3} fill="rgb(var(--c-gold) / 0.08)" />
              <circle
                cx={px(p.lon!)} cy={py(p.lat!)} r={r}
                fill={on ? 'rgb(var(--c-gold))' : 'rgb(var(--c-gold) / 0.7)'}
              />
              <text
                x={px(p.lon!)} y={py(p.lat!) - r - 1.6}
                textAnchor="middle"
                className="serif"
                style={{ fontSize: 2.5, fill: 'rgb(var(--c-ink))', opacity: on ? 1 : 0.6 }}
              >
                {p.name.split(',')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
