import { useState } from 'react';
import { useArchive, newId } from '../data/store';
import { Modal, Field } from './Modal';
import { putBlob } from '../data/db';
import { makeThumbnail, kindOf } from '../lib/images';
import { fullName } from '../domain/relationships';
import { haptic } from '../lib/haptics';
import type { Media, Visibility } from '../domain/types';
import { VISIBILITY_LABELS } from '../lib/privacy';

/**
 * "Add to our family history" — one short path from a photograph or document
 * on a phone to something tagged, dated and findable in the archive.
 */
export function AddMemory({ onClose, onWriteStory }: { onClose: () => void; onWriteStory: () => void }) {
  const graph = useArchive((s) => s.graph);
  const upsertMedia = useArchive((s) => s.upsertMedia);
  const notify = useArchive((s) => s.notify);

  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [place, setPlace] = useState('');
  const [caption, setCaption] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState<Visibility>('family');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const everyone = [...graph.people.values()].sort((a, b) => a.firstName.localeCompare(b.firstName));

  const save = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      for (const [i, file] of files.entries()) {
        const id = newId('m');
        const kind = kindOf(file);
        const thumb = kind === 'photo' ? await makeThumbnail(file) : null;
        // The full file goes to IndexedDB; only the small preview lives in the
        // document, so the archive stays quick to load.
        await putBlob(id, file);
        const media: Media = {
          id,
          kind,
          title: (files.length === 1 ? title.trim() : '') || file.name.replace(/\.[^.]+$/, ''),
          thumb: thumb?.dataUrl,
          mime: file.type,
          width: thumb?.width,
          height: thumb?.height,
          date: date.trim() ? { value: date.trim() } : undefined,
          place: place.trim() ? { name: place.trim() } : undefined,
          caption: caption.trim() || undefined,
          tags: people.map((personId) => ({ personId })),
          privacy,
          metadata: { createdAt: Date.now() + i },
        };
        upsertMedia(media);
      }
      haptic('commit');
      notify(`${files.length} ${files.length === 1 ? 'item' : 'items'} added to the archive.`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Add to our family history"
      subtitle="Photographs, scanned documents, certificates, recordings. Everything stays on this device until you export it."
      footer={
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onWriteStory}>
            Write a story instead
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void save()}
              disabled={!files.length || busy}
            >
              {busy ? 'Preserving…' : `Add ${files.length || ''}`.trim()}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <label
          className="block cursor-pointer rounded-[14px] px-6 py-10 text-center transition-colors"
          style={{
            border: `1px dashed ${dragging ? 'rgb(var(--c-gold))' : 'rgb(var(--c-rule))'}`,
            background: dragging ? 'rgb(var(--c-gold) / 0.05)' : 'transparent',
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            setFiles([...files, ...Array.from(e.dataTransfer.files)]);
          }}
        >
          <input
            type="file"
            multiple
            className="sr-only"
            accept="image/*,application/pdf,audio/*,video/*"
            onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])}
          />
          {files.length ? (
            <>
              <p className="serif text-[17px]">{files.length} {files.length === 1 ? 'item' : 'items'} ready</p>
              <p className="mt-1 text-[12px]" style={{ color: 'rgb(var(--c-faint))' }}>
                {files.slice(0, 3).map((f) => f.name).join(', ')}{files.length > 3 ? '…' : ''}
              </p>
            </>
          ) : (
            <>
              <p className="serif text-[17px]">Drop them here, or choose files</p>
              <p className="mt-1.5 text-[12px]" style={{ color: 'rgb(var(--c-faint))' }}>
                Photographs, PDFs, recordings — several at once is fine.
              </p>
            </>
          )}
        </label>

        {files.length === 1 && (
          <Field label="Title">
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The courtyard in Fès, summer" />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="When" hint="Approximate is fine — 1978.">
            <input className="field" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1978" />
          </Field>
          <Field label="Where">
            <input className="field" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Fès, Morocco" />
          </Field>
        </div>

        <Field label="What is happening here">
          <textarea
            className="field"
            rows={3}
            style={{ resize: 'vertical' }}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </Field>

        <Field label="Who is in it" hint="Tagged people can be opened straight from the photograph.">
          <div className="flex flex-wrap gap-1.5">
            {everyone.map((p) => {
              const on = people.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  data-on={on}
                  aria-pressed={on}
                  onClick={() => setPeople(on ? people.filter((x) => x !== p.id) : [...people, p.id])}
                >
                  {fullName(p)}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Who may see it">
          <select className="field" value={privacy} onChange={(e) => setPrivacy(e.target.value as Visibility)}>
            {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((v) => (
              <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
