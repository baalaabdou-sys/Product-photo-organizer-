import { memo } from 'react';
import type { Person } from '../domain/types';
import { NODE_W, NODE_H } from '../layout/treeLayout';
import { Portrait } from './Portrait';
import { lifespan } from '../domain/dates';
import { isDeceased } from '../domain/graph';

export type NodeTone = 'normal' | 'dimmed' | 'selected' | 'onPath' | 'me' | 'ancestor';

interface Props {
  person: Person;
  x: number;
  y: number;
  tone: NodeTone;
  relationLabel?: string;
  hidden: number;
  collapsed: boolean;
  /** Below this zoom the node renders as a simplified plate. */
  detail: 'full' | 'compact' | 'dot';
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}

/**
 * One family member. Deliberately sparse — a portrait, a name, a lifespan,
 * and a relationship only when it means something.
 */
export const TreeNode = memo(function TreeNode({
  person, x, y, tone, relationLabel, hidden, collapsed, detail, onSelect, onToggleCollapse,
}: Props) {
  const deceased = isDeceased(person);
  const years = lifespan(person.birthDate, person.deathDate);

  const dim = tone === 'dimmed';
  const emphasised = tone === 'selected' || tone === 'onPath' || tone === 'me';

  if (detail === 'dot') {
    return (
      <button
        type="button"
        onClick={() => onSelect(person.id)}
        className="absolute rounded-full transition-opacity"
        style={{
          left: x + NODE_W / 2 - 7, top: y + NODE_H / 2 - 7,
          width: 14, height: 14,
          background: tone === 'selected' || tone === 'me'
            ? 'rgb(var(--c-gold))' : 'rgb(var(--c-faint))',
          opacity: dim ? 0.2 : 0.85,
        }}
        aria-label={`${person.firstName} ${person.lastName}`}
      />
    );
  }

  return (
    <div
      className="absolute"
      style={{
        left: x, top: y, width: NODE_W, height: NODE_H,
        opacity: dim ? 0.22 : 1,
        transition: 'opacity .45s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(person.id)}
        className="group relative block h-full w-full overflow-hidden rounded-[14px] px-2 pt-3 pb-2 text-center"
        style={{
          background: emphasised ? 'rgb(var(--c-paper-2))' : 'transparent',
          border: `1px solid ${
            tone === 'selected' ? 'rgb(var(--c-gold))'
            : tone === 'me' ? 'rgb(var(--c-zellige))'
            : emphasised ? 'rgb(var(--c-gold) / 0.45)'
            : 'transparent'
          }`,
          boxShadow: emphasised
            ? '0 2px 4px rgb(var(--c-shadow)/0.06), 0 20px 44px -22px rgb(var(--c-shadow)/0.45)'
            : 'none',
          transition: 'background-color .4s, border-color .4s, box-shadow .4s, transform .4s cubic-bezier(.22,1,.36,1)',
        }}
        aria-current={tone === 'selected' ? 'true' : undefined}
      >
        <span
          className="relative inline-block transition-transform duration-500 ease-editorial group-hover:scale-[1.055] group-focus-visible:scale-[1.055]"
          style={{ transformOrigin: 'center bottom' }}
        >
          <Portrait person={person} size={detail === 'full' ? 56 : 46} shape="arch" />
          {deceased && (
            <span
              aria-hidden="true"
              className="absolute -bottom-[3px] left-1/2 h-px -translate-x-1/2 rounded-full"
              style={{ width: 22, background: 'rgb(var(--c-faint) / 0.85)' }}
            />
          )}
        </span>

        <span
          className="mt-2 block w-full truncate serif text-[15px]"
          style={{ fontWeight: 400, lineHeight: '19px' }}
        >
          {person.firstName}
        </span>
        {detail === 'full' && (
          <>
            <span
              className="block w-full truncate text-[9.5px] uppercase"
              style={{ letterSpacing: '0.16em', color: 'rgb(var(--c-faint))', lineHeight: '13px' }}
            >
              {person.lastName}
            </span>
            {years && (
              <span
                className="block w-full truncate text-[10.5px] tabular-nums"
                style={{ color: 'rgb(var(--c-muted))', lineHeight: '16px' }}
              >
                {years}
              </span>
            )}
            {relationLabel && (
              <span
                className="block w-full truncate text-[9.5px] italic serif"
                style={{ color: 'rgb(var(--c-gold))', lineHeight: '14px' }}
              >
                {relationLabel}
              </span>
            )}
          </>
        )}
      </button>

      {hidden > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(person.id); }}
          className="absolute left-1/2 flex h-[22px] -translate-x-1/2 items-center rounded-full px-2 text-[10px] tabular-nums"
          style={{
            bottom: -13,
            background: 'rgb(var(--c-paper))',
            border: '1px solid rgb(var(--c-rule))',
            color: 'rgb(var(--c-muted))',
            letterSpacing: '0.04em',
          }}
          aria-label={
            collapsed
              ? `Show ${hidden} descendants of ${person.firstName}`
              : `Hide descendants of ${person.firstName}`
          }
        >
          {collapsed ? `+${hidden}` : '−'}
        </button>
      )}
    </div>
  );
});
