import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useArchive, type ThemeChoice } from '../data/store';
import { buildPreview, applyImport, type ImportPreview, type ImportStrategy } from '../gedcom/import';
import { toGedcom, toJson, toCsv } from '../gedcom/serialize';
import { reviewFamily } from '../domain/validate';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '../lib/privacy';
import { listSnapshots, type SnapshotRow } from '../data/db';
import type { Role } from '../domain/types';
import { Modal } from '../components/Modal';
import { haptic } from '../lib/haptics';
import { fullName } from '../domain/relationships';
import { familyStats } from '../domain/stats';

export function Settings() {
  const data = useArchive((s) => s.data);
  const graph = useArchive((s) => s.graph);
  const role = useArchive((s) => s.role);
  const setRole = useArchive((s) => s.setRole);
  const theme = useArchive((s) => s.theme);
  const setTheme = useArchive((s) => s.setTheme);
  const hasDemo = useArchive((s) => s.hasDemo);
  const removeDemoData = useArchive((s) => s.removeDemoData);
  const replaceAll = useArchive((s) => s.replaceAll);
  const notify = useArchive((s) => s.notify);
  const select = useArchive((s) => s.select);
  const go = useArchive((s) => s.go);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>('merge');
  const [removeDemo, setRemoveDemo] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [confirmDemo, setConfirmDemo] = useState(false);

  const issues = useMemo(() => reviewFamily(data), [data]);
  const stats = useMemo(() => familyStats(graph, data), [graph, data]);

  useEffect(() => { void listSnapshots().then(setSnapshots); }, [data]);

  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const p = await buildPreview(file, data);
      setPreview(p);
      setStrategy(p.existingCount === 0 || p.demoCount === p.existingCount ? 'replace' : 'merge');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const { data: next, summary } = applyImport(data, preview, { strategy, removeDemo });
      await replaceAll(next, `Before importing ${preview.format.toUpperCase()}`);
      haptic('commit');
      notify(
        `${summary.added} added, ${summary.updated} updated. A restore point was saved first.`,
      );
      setPreview(null);
      go('tree');
    } finally {
      setBusy(false);
    }
  };

  const download = (contents: string, filename: string, mime: string) => {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    notify(`${filename} exported.`);
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-32 sm:px-8">
      <header className="pt-6">
        <p className="label">The archive</p>
        <h1 className="display mt-2 text-[clamp(32px,8vw,54px)]">Settings</h1>
      </header>

      {/* ── Import ──────────────────────────────────────── */}
      <Group title="Import family tree">
        <p className="mb-4 text-[13.5px] leading-relaxed" style={{ color: 'rgb(var(--c-muted))' }}>
          Export your tree from FamilyEcho (<em>Download</em> → GEDCOM), then drop the
          <code className="mx-1 rounded px-1 text-[12px]" style={{ background: 'rgb(var(--c-paper-3))' }}>.ged</code>
          file here. JSON backups from this app and simple CSV files also work.
          Nothing is replaced until you have seen the preview and confirmed it.
        </p>

        <label
          className="block cursor-pointer rounded-[14px] px-6 py-12 text-center transition-colors"
          style={{
            border: `1px dashed ${dragging ? 'rgb(var(--c-gold))' : 'rgb(var(--c-rule))'}`,
            background: dragging ? 'rgb(var(--c-gold) / 0.05)' : 'transparent',
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void handleFile(f);
          }}
        >
          <input
            type="file"
            className="sr-only"
            accept=".ged,.gedcom,.json,.csv,.tsv,text/plain"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          />
          <p className="serif text-[19px]">{busy ? 'Reading the file…' : 'Drop family.ged here'}</p>
          <p className="mt-1.5 text-[12px]" style={{ color: 'rgb(var(--c-faint))' }}>
            or choose a file · GEDCOM, JSON or CSV
          </p>
        </label>

        {error && (
          <p className="mt-3 text-[13px]" style={{ color: 'rgb(var(--c-gold))' }}>{error}</p>
        )}
      </Group>

      {/* ── Export ──────────────────────────────────────── */}
      <Group title="Export">
        <p className="mb-4 text-[13.5px] leading-relaxed" style={{ color: 'rgb(var(--c-muted))' }}>
          Take the archive with you. GEDCOM is the format every genealogy program reads;
          JSON keeps everything this app knows, including stories.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button" className="btn btn-sm"
            onClick={() => download(toGedcom(data), `abderrahmane-family-${stamp}.ged`, 'text/plain')}
            disabled={!data.people.length}
          >
            GEDCOM (.ged)
          </button>
          <button
            type="button" className="btn btn-sm"
            onClick={() => download(toJson(data), `abderrahmane-family-${stamp}.json`, 'application/json')}
            disabled={!data.people.length}
          >
            Full backup (.json)
          </button>
          <button
            type="button" className="btn btn-sm"
            onClick={() => download(toCsv(data), `abderrahmane-family-${stamp}.csv`, 'text/csv')}
            disabled={!data.people.length}
          >
            Spreadsheet (.csv)
          </button>
          <button type="button" className="btn btn-sm" onClick={() => go('print')} disabled={!data.people.length}>
            Print or PDF
          </button>
        </div>
      </Group>

      {/* ── Demo data ───────────────────────────────────── */}
      {hasDemo && (
        <Group title="Demonstration family">
          <p className="mb-4 text-[13.5px] leading-relaxed" style={{ color: 'rgb(var(--c-muted))' }}>
            The archive currently shows a small demonstration family so the app has
            something to display. These are not real relatives. Importing a GEDCOM
            can remove them in the same step, or remove them now.
          </p>
          <button type="button" className="btn btn-sm" onClick={() => setConfirmDemo(true)}>
            Remove the demonstration family
          </button>
        </Group>
      )}

      {/* ── Data review ─────────────────────────────────── */}
      <Group title={`Check the records${issues.length ? ` · ${issues.length}` : ''}`}>
        {issues.length === 0 ? (
          <p className="serif text-[15px] italic" style={{ color: 'rgb(var(--c-muted))' }}>
            Nothing looks wrong. No circular ancestry, no impossible dates, no obvious duplicates.
          </p>
        ) : (
          <ul className="space-y-3">
            {issues.slice(0, 14).map((i) => (
              <li key={i.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: i.severity === 'error' ? 'rgb(var(--c-gold))'
                      : i.severity === 'warning' ? 'rgb(var(--c-gold) / 0.5)'
                      : 'rgb(var(--c-rule))',
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-[13.5px]">{i.title}</span>
                  <span className="block text-[12px]" style={{ color: 'rgb(var(--c-muted))' }}>{i.detail}</span>
                  {i.personIds[0] && (
                    <button
                      type="button"
                      className="mt-1 text-[11.5px] underline underline-offset-2"
                      style={{ color: 'rgb(var(--c-gold))' }}
                      onClick={() => { select(i.personIds[0]); go('tree'); }}
                    >
                      Open the record
                    </button>
                  )}
                </span>
              </li>
            ))}
            {issues.length > 14 && (
              <li className="text-[12px]" style={{ color: 'rgb(var(--c-faint))' }}>
                and {issues.length - 14} more.
              </li>
            )}
          </ul>
        )}
      </Group>

      {/* ── Permissions ─────────────────────────────────── */}
      <Group title="What this device may see">
        <p className="mb-4 text-[13.5px] leading-relaxed" style={{ color: 'rgb(var(--c-muted))' }}>
          Living relatives' details are protected by default. Set a lower level on a
          shared or family device — names and the shape of the tree always stay visible.
        </p>
        <div className="space-y-2">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className="flex w-full items-start gap-3 rounded-[11px] px-4 py-3 text-left transition-colors"
              style={{
                background: role === r ? 'rgb(var(--c-paper-2))' : 'transparent',
                border: `1px solid ${role === r ? 'rgb(var(--c-gold) / 0.45)' : 'rgb(var(--c-rule) / 0.6)'}`,
              }}
              aria-pressed={role === r}
            >
              <span
                aria-hidden="true"
                className="mt-[5px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full"
                style={{ border: `1px solid ${role === r ? 'rgb(var(--c-gold))' : 'rgb(var(--c-rule))'}` }}
              >
                {role === r && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgb(var(--c-gold))' }} />}
              </span>
              <span>
                <span className="block text-[13.5px]">{ROLE_LABELS[r]}</span>
                <span className="block text-[11.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
                  {ROLE_DESCRIPTIONS[r]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Group>

      {/* ── Appearance ──────────────────────────────────── */}
      <Group title="Appearance">
        <div className="flex gap-1.5">
          {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={theme === t}
              onClick={() => setTheme(t)}
            >
              {t === 'system' ? 'Match device' : t === 'light' ? 'Parchment' : 'Espresso'}
            </button>
          ))}
        </div>
      </Group>

      {/* ── Restore points ──────────────────────────────── */}
      {snapshots.length > 0 && (
        <Group title="Restore points">
          <p className="mb-3 text-[13px]" style={{ color: 'rgb(var(--c-muted))' }}>
            Taken automatically before anything that changes the archive in bulk.
            The last ten are kept on this device.
          </p>
          <ul className="space-y-2">
            {snapshots.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{s.reason}</span>
                  <span className="block text-[11px] tabular-nums" style={{ color: 'rgb(var(--c-faint))' }}>
                    {new Date(s.at).toLocaleString()} · {s.data.people.length} people
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm shrink-0"
                  onClick={() => {
                    void replaceAll(s.data, 'Before restoring an earlier version');
                    notify('The archive was restored to that point.');
                  }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </Group>
      )}

      <Group title="This archive">
        <dl className="space-y-2 text-[13px]">
          {([
            ['People', stats.people],
            ['Generations', stats.generations],
            ['Stories', stats.stories],
            ['Photographs and documents', data.media.length],
            ['Places', stats.places],
            ['Family names', stats.surnames.slice(0, 4).join(', ') || '—'],
          ] as const).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt style={{ color: 'rgb(var(--c-muted))' }}>{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-[11.5px] leading-relaxed" style={{ color: 'rgb(var(--c-faint))' }}>
          Everything lives in this browser's storage on this device. Nothing is uploaded
          and no account is needed. Export a backup to move it, and keep one somewhere safe.
        </p>
      </Group>

      {/* ── Import preview ──────────────────────────────── */}
      {preview && (
        <ImportPreviewModal
          preview={preview}
          strategy={strategy}
          setStrategy={setStrategy}
          removeDemo={removeDemo}
          setRemoveDemo={setRemoveDemo}
          busy={busy}
          onCancel={() => setPreview(null)}
          onConfirm={() => void confirmImport()}
          hasDemo={hasDemo}
        />
      )}

      <Modal
        open={confirmDemo}
        onClose={() => setConfirmDemo(false)}
        title="Remove the demonstration family?"
        subtitle="The archive will be empty until you import your own. A restore point is saved first."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setConfirmDemo(false)}>Keep it</button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { removeDemoData(); setConfirmDemo(false); notify('The demonstration family was removed.'); }}
            >
              Remove
            </button>
          </div>
        }
      >
        <p className="text-[13.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
          {data.people.filter((p) => p.metadata.demo).length} demonstration records will be removed.
          Anything you have added yourself is kept.
        </p>
      </Modal>
    </div>
  );
}

function ImportPreviewModal({
  preview, strategy, setStrategy, removeDemo, setRemoveDemo, busy, onCancel, onConfirm, hasDemo,
}: {
  preview: ImportPreview;
  strategy: ImportStrategy;
  setStrategy: (s: ImportStrategy) => void;
  removeDemo: boolean;
  setRemoveDemo: (v: boolean) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  hasDemo: boolean;
}) {
  const errors = preview.issues.filter((i) => i.severity === 'error');
  return (
    <Modal
      open
      wide
      onClose={onCancel}
      title="Import preview"
      subtitle={`${preview.format.toUpperCase()}${preview.source ? ` from ${preview.source}` : ''} — nothing has been changed yet.`}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm} disabled={busy || !preview.counts.people}>
            {busy ? 'Importing…' : strategy === 'replace' ? 'Replace the archive' : 'Merge into the archive'}
          </button>
        </div>
      }
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ['People', preview.counts.people],
            ['Marriages', preview.counts.unions],
            ['Parent links', preview.counts.parentage],
            ['Dated events', preview.counts.events],
          ] as const).map(([k, v]) => (
            <div key={k} className="rounded-[11px] px-4 py-3" style={{ background: 'rgb(var(--c-paper-2))' }}>
              <p className="serif text-[26px] leading-none tabular-nums">{v}</p>
              <p className="label mt-1.5">{k}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="label mb-2">How to bring them in</p>
          <div className="space-y-2">
            <Choice
              on={strategy === 'merge'}
              onPick={() => setStrategy('merge')}
              title="Merge"
              detail={`Keeps everything already here. ${preview.matches.length} ${preview.matches.length === 1 ? 'person appears' : 'people appear'} in both and will be matched rather than duplicated; ${preview.newPeople.length} will be added.`}
            />
            <Choice
              on={strategy === 'replace'}
              onPick={() => setStrategy('replace')}
              title="Replace everything"
              detail={`Removes all ${preview.existingCount} current records and starts from this file. A restore point is saved first, so this can be undone.`}
            />
          </div>
        </div>

        {hasDemo && strategy === 'merge' && (
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={removeDemo}
              onChange={(e) => setRemoveDemo(e.target.checked)}
              className="mt-1"
            />
            <span className="text-[13px]" style={{ color: 'rgb(var(--c-muted))' }}>
              Also remove the {preview.demoCount} demonstration records — recommended, since they are not real relatives.
            </span>
          </label>
        )}

        {preview.matches.length > 0 && (
          <Detail title={`Matched to existing records · ${preview.matches.length}`}>
            <ul className="space-y-1.5">
              {preview.matches.slice(0, 10).map((m) => (
                <li key={m.incomingId} className="text-[12.5px]">
                  <span>{m.label}</span>
                  <span style={{ color: 'rgb(var(--c-faint))' }}> — {m.reason}</span>
                </li>
              ))}
              {preview.matches.length > 10 && (
                <li className="text-[12px]" style={{ color: 'rgb(var(--c-faint))' }}>and {preview.matches.length - 10} more.</li>
              )}
            </ul>
          </Detail>
        )}

        {preview.internalDuplicates.length > 0 && (
          <Detail title={`Possible duplicates inside the file · ${preview.internalDuplicates.length}`}>
            <ul className="space-y-1.5">
              {preview.internalDuplicates.slice(0, 8).map((d, i) => (
                <li key={i} className="text-[12.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
                  {d.a} · {d.b}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px]" style={{ color: 'rgb(var(--c-faint))' }}>
              These are imported as written. Merge them by hand afterwards if they are the same person.
            </p>
          </Detail>
        )}

        {errors.length > 0 && (
          <Detail title={`Records worth checking after import · ${errors.length}`}>
            <ul className="space-y-1.5">
              {errors.slice(0, 8).map((i) => (
                <li key={i.id} className="text-[12.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
                  <strong style={{ color: 'rgb(var(--c-ink))', fontWeight: 500 }}>{i.title}.</strong> {i.detail}
                </li>
              ))}
            </ul>
          </Detail>
        )}

        {preview.warnings.length > 0 && (
          <Detail title={`Notes from the file · ${preview.warnings.length}`}>
            <ul className="space-y-1">
              {preview.warnings.slice(0, 8).map((w, i) => (
                <li key={i} className="text-[12px]" style={{ color: 'rgb(var(--c-muted))' }}>{w}</li>
              ))}
            </ul>
          </Detail>
        )}

        {preview.newPeople.length > 0 && (
          <Detail title={`New to the archive · ${preview.newPeople.length}`}>
            <p className="text-[12.5px]" style={{ color: 'rgb(var(--c-muted))' }}>
              {preview.newPeople.slice(0, 18).map(fullName).join(' · ')}
              {preview.newPeople.length > 18 ? ' …' : ''}
            </p>
          </Detail>
        )}
      </motion.div>
    </Modal>
  );
}

function Choice({ on, onPick, title, detail }: { on: boolean; onPick: () => void; title: string; detail: string }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className="flex w-full items-start gap-3 rounded-[11px] px-4 py-3 text-left"
      style={{
        background: on ? 'rgb(var(--c-paper-2))' : 'transparent',
        border: `1px solid ${on ? 'rgb(var(--c-gold) / 0.5)' : 'rgb(var(--c-rule) / 0.6)'}`,
      }}
    >
      <span
        aria-hidden="true"
        className="mt-[5px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full"
        style={{ border: `1px solid ${on ? 'rgb(var(--c-gold))' : 'rgb(var(--c-rule))'}` }}
      >
        {on && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgb(var(--c-gold))' }} />}
      </span>
      <span>
        <span className="block text-[13.5px]">{title}</span>
        <span className="block text-[11.5px] leading-relaxed" style={{ color: 'rgb(var(--c-muted))' }}>{detail}</span>
      </span>
    </button>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-[11px] px-4 py-3" style={{ background: 'rgb(var(--c-paper-2))' }}>
      <summary className="cursor-pointer text-[12.5px]" style={{ color: 'rgb(var(--c-ink-soft))' }}>{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-11">
      <h2 className="label mb-4">{title}</h2>
      {children}
    </section>
  );
}
