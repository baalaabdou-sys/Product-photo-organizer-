import { useState } from 'react';
import { useArchive, newId } from '../data/store';
import { Modal, Field } from './Modal';
import type { ID, Story, Visibility } from '../domain/types';
import { haptic } from '../lib/haptics';
import { VISIBILITY_LABELS } from '../lib/privacy';
import { fullName } from '../domain/relationships';

export function StoryEditor({
  personId, storyId, onClose,
}: { personId?: ID; storyId?: ID; onClose: () => void }) {
  const graph = useArchive((s) => s.graph);
  const stories = useArchive((s) => s.data.stories);
  const upsertStory = useArchive((s) => s.upsertStory);
  const notify = useArchive((s) => s.notify);

  const existing = storyId ? stories.find((s) => s.id === storyId) : undefined;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [date, setDate] = useState(existing?.date?.value ?? '');
  const [place, setPlace] = useState(existing?.place?.name ?? '');
  const [people, setPeople] = useState<ID[]>(
    existing?.personIds ?? (personId ? [personId] : []),
  );
  const [privacy, setPrivacy] = useState<Visibility>(existing?.privacy ?? 'family');

  const everyone = [...graph.people.values()].sort((a, b) => a.firstName.localeCompare(b.firstName));

  const save = () => {
    if (!title.trim() || !body.trim()) return;
    const now = Date.now();
    const story: Story = {
      id: existing?.id ?? newId('s'),
      title: title.trim(),
      body: body.trim(),
      date: date.trim() ? { value: date.trim() } : undefined,
      place: place.trim() ? { name: place.trim() } : undefined,
      personIds: people,
      mediaIds: existing?.mediaIds ?? [],
      privacy,
      metadata: {
        createdAt: existing?.metadata.createdAt ?? now,
        updatedAt: now,
        author: existing?.metadata.author,
      },
    };
    upsertStory(story);
    haptic('commit');
    notify(existing ? 'Story updated.' : 'Story added to the family history.');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={existing ? 'Edit this story' : 'Add to our family history'}
      subtitle="Write it the way you would tell it. Names, places and the year help the next generation find it."
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={!title.trim() || !body.trim()}
          >
            {existing ? 'Save' : 'Preserve this story'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Title">
          <input
            data-autofocus
            className="field serif"
            style={{ fontSize: 19 }}
            placeholder="Grandfather's leather shop"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="The story">
          <textarea
            className="field serif"
            rows={11}
            style={{ fontSize: 16, lineHeight: 1.7, resize: 'vertical', minHeight: 220 }}
            placeholder="He had a habit of testing leather by folding it once against his thumb and listening…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="When" hint="A year is enough.">
            <input className="field" placeholder="1974" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Where">
            <input className="field" placeholder="Fès, Morocco" value={place} onChange={(e) => setPlace(e.target.value)} />
          </Field>
        </div>

        <Field label="Who is in it">
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

        <Field label="Who may read it">
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
