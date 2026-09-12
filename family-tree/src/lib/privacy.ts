import type { Person, Role, Visibility, PrivateFieldKey } from '../domain/types';
import { isLiving } from '../domain/graph';

const RANK: Record<Role, number> = { viewer: 0, family: 1, editor: 2, admin: 3 };
const NEEDED: Record<Visibility, number> = { public: 0, family: 1, editors: 2, private: 3 };

/** Contact details are never shown below editor level, whatever the setting. */
const ALWAYS_SENSITIVE: PrivateFieldKey[] = ['email', 'phone', 'address'];

/**
 * Whether `role` may see a given field of a person.
 *
 * Living people are protected by default: a plain viewer sees a living
 * person's name and place in the tree, and nothing else.
 */
export function canSee(person: Person, field: PrivateFieldKey, role: Role): boolean {
  if (ALWAYS_SENSITIVE.includes(field) && RANK[role] < RANK.editor) return false;

  const override = person.privacy.fields?.[field];
  if (override) return RANK[role] >= NEEDED[override];

  if (isLiving(person) && RANK[role] < RANK.family) return false;
  return RANK[role] >= NEEDED[person.privacy.level];
}

/** Name and position in the tree — always visible, so the tree stays readable. */
export function canSeePerson(_person: Person, _role: Role): boolean {
  return true;
}

export function canEdit(role: Role): boolean {
  return RANK[role] >= RANK.editor;
}

export function canAdminister(role: Role): boolean {
  return role === 'admin';
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Viewer',
  family: 'Family member',
  editor: 'Editor',
  admin: 'Administrator',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  viewer: 'Sees names and how everyone connects. Details of living relatives stay hidden.',
  family: 'Sees dates, places and stories for the whole family.',
  editor: 'Can add and correct records, photographs and stories.',
  admin: 'Everything, including import, export and permissions.',
};

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: 'Anyone with the link',
  family: 'Family members',
  editors: 'Editors only',
  private: 'Administrators only',
};
