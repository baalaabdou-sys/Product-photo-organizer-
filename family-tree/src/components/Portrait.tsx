import { useEffect, useMemo, useState } from 'react';
import type { Person } from '../domain/types';
import { initialsOf } from '../domain/relationships';
import { useArchive } from '../data/store';
import { getBlob } from '../data/db';

/**
 * An archival portrait. When there is no photograph we draw a typeset
 * monogram from the family's own type and palette — never a grey avatar.
 */
export function Portrait({
  person,
  size = 64,
  shape = 'soft',
  className = '',
  eager = false,
}: {
  person: Person;
  size?: number;
  shape?: 'soft' | 'circle' | 'arch';
  className?: string;
  eager?: boolean;
}) {
  const media = useArchive((s) => s.data.media);
  const photo = useMemo(
    () => (person.photoId ? media.find((m) => m.id === person.photoId) : undefined),
    [person.photoId, media],
  );
  const [src, setSrc] = useState<string | undefined>(photo?.thumb ?? photo?.src);

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    setSrc(photo?.thumb ?? photo?.src);
    if (photo && !photo.thumb && !photo.src) {
      void getBlob(photo.id).then((row) => {
        if (cancelled || !row) return;
        url = URL.createObjectURL(row.thumb ?? row.blob);
        setSrc(url);
      });
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo]);

  const radius =
    shape === 'circle' ? '50%'
    : shape === 'arch' ? `${size / 2}px ${size / 2}px ${size * 0.09}px ${size * 0.09}px`
    : `${Math.max(8, size * 0.16)}px`;

  const initials = initialsOf(person);
  // A stable, quiet tint per person — derived from the name, not random.
  const tint = useMemo(() => hashTint(person.id + person.firstName), [person.id, person.firstName]);

  return (
    <div
      className={`portrait-frame shrink-0 ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center select-none"
          style={{
            background: `linear-gradient(155deg, rgb(var(--c-paper-2)), rgb(var(--c-paper-3)))`,
            boxShadow: `inset 0 0 0 1px rgb(var(--c-gold) / ${0.1 + tint * 0.12})`,
          }}
        >
          <span
            className="serif"
            style={{
              fontSize: size * 0.36,
              lineHeight: 1,
              fontWeight: 300,
              letterSpacing: '0.03em',
              color: `rgb(var(--c-gold))`,
              opacity: 0.72 + tint * 0.2,
              paddingLeft: '0.03em',
            }}
          >
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}

function hashTint(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 100) / 100;
}
