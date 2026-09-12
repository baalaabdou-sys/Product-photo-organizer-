/* ─────────────────────────────────────────────────────────────
   Domain model. Deliberately independent of any presentation.
   ───────────────────────────────────────────────────────────── */

export type ID = string;

export type Gender = 'male' | 'female' | 'other' | 'unknown';

/** Field-level privacy. Enforced by selectors, never by the UI alone. */
export type Visibility = 'public' | 'family' | 'editors' | 'private';

export type Role = 'viewer' | 'family' | 'editor' | 'admin';

/** A partially-known historical date. Genealogy is rarely exact. */
export interface FuzzyDate {
  /** ISO-ish: "1948", "1948-03", "1948-03-17" */
  value: string;
  /** about / before / after / estimated */
  qualifier?: 'about' | 'before' | 'after' | 'estimated';
  /** Original text as written in the source (GEDCOM, a note, a headstone). */
  original?: string;
}

export interface PlaceRef {
  /** Free text as recorded, e.g. "Casablanca, Morocco" */
  name: string;
  placeId?: ID;
}

export interface PrivacySettings {
  /** Default for this person's detail fields. */
  level: Visibility;
  /** Per-field overrides, e.g. { email: 'private' } */
  fields?: Partial<Record<PrivateFieldKey, Visibility>>;
}

export type PrivateFieldKey =
  | 'birthDate' | 'birthPlace' | 'deathDate' | 'deathPlace'
  | 'burialDate' | 'burialPlace' | 'profession' | 'company'
  | 'interests' | 'activities' | 'biography'
  | 'email' | 'phone' | 'address';

export interface Person {
  id: ID;
  firstName: string;
  middleNames?: string;
  lastName: string;
  /** Surname at birth, where it differs (maiden name). */
  birthSurname?: string;
  nickname?: string;
  gender: Gender;

  photoId?: ID;

  birthDate?: FuzzyDate;
  birthPlace?: PlaceRef;
  deathDate?: FuzzyDate;
  deathPlace?: PlaceRef;
  burialDate?: FuzzyDate;
  burialPlace?: PlaceRef;
  /** Explicit when known; otherwise inferred from deathDate / age. */
  living?: boolean;

  profession?: string;
  company?: string;
  interests?: string[];
  activities?: string[];
  biography?: string;

  /** Contact details — always privacy-gated, never placed in a URL. */
  email?: string;
  phone?: string;
  address?: string;

  branchIds?: ID[];
  privacy: PrivacySettings;

  metadata: {
    /** Identifier from the import source, preserved for re-import matching. */
    sourceId?: string;
    source?: 'demo' | 'gedcom' | 'json' | 'csv' | 'manual';
    createdAt: number;
    updatedAt: number;
    /** Marks records from the bundled demonstration tree. */
    demo?: boolean;
    notes?: string;
  };
}

export type UnionType = 'marriage' | 'partnership' | 'engaged' | 'divorced' | 'unknown';

/** A partnership between two people. Children hang off the union. */
export interface Union {
  id: ID;
  personA: ID;
  personB: ID;
  type: UnionType;
  startDate?: FuzzyDate;
  endDate?: FuzzyDate;
  place?: PlaceRef;
  metadata: { sourceId?: string; demo?: boolean; createdAt: number; updatedAt: number };
}

export type ParentageType = 'biological' | 'adoptive' | 'step' | 'foster' | 'guardian' | 'unknown';

export interface ParentChild {
  id: ID;
  parentId: ID;
  childId: ID;
  type: ParentageType;
  /** The union this child belongs to, when known. */
  unionId?: ID;
  metadata: { demo?: boolean; createdAt: number };
}

export type MediaKind = 'photo' | 'document' | 'audio' | 'video';

export interface MediaTag {
  personId: ID;
  /** Normalised 0–1 face box, for tagging people inside photographs. */
  box?: { x: number; y: number; w: number; h: number };
}

export interface Media {
  id: ID;
  kind: MediaKind;
  title?: string;
  /** Object URL or data URL; blobs live in IndexedDB. */
  src?: string;
  /** Small pre-scaled version used everywhere but the full viewer. */
  thumb?: string;
  mime?: string;
  width?: number;
  height?: number;
  date?: FuzzyDate;
  place?: PlaceRef;
  caption?: string;
  tags: MediaTag[];
  privacy: Visibility;
  metadata: { demo?: boolean; createdAt: number; addedBy?: string };
}

export interface Story {
  id: ID;
  title: string;
  body: string;
  date?: FuzzyDate;
  place?: PlaceRef;
  /** People this story belongs to. */
  personIds: ID[];
  mediaIds: ID[];
  privacy: Visibility;
  metadata: { demo?: boolean; createdAt: number; updatedAt: number; author?: string };
}

export type EventKind =
  | 'birth' | 'death' | 'marriage' | 'divorce' | 'burial'
  | 'move' | 'graduation' | 'career' | 'family' | 'memory' | 'other';

export interface FamilyEvent {
  id: ID;
  kind: EventKind;
  title: string;
  description?: string;
  date: FuzzyDate;
  place?: PlaceRef;
  personIds: ID[];
  mediaIds?: ID[];
  privacy: Visibility;
  metadata: { demo?: boolean; derived?: boolean; createdAt: number };
}

export interface Place {
  id: ID;
  name: string;
  country?: string;
  lat?: number;
  lon?: number;
  /** Precise addresses stay hidden unless permissions allow. */
  precise?: boolean;
  metadata: { demo?: boolean };
}

export interface FamilyBranch {
  id: ID;
  name: string;
  /** Person the branch descends from. */
  rootPersonId?: ID;
  /** 'zellige' | 'gold' | 'ink' — restrained, never a rainbow. */
  tone: 'gold' | 'zellige' | 'ink';
  metadata: { demo?: boolean };
}

export interface FamilyData {
  people: Person[];
  unions: Union[];
  parentage: ParentChild[];
  media: Media[];
  stories: Story[];
  events: FamilyEvent[];
  places: Place[];
  branches: FamilyBranch[];
}

export const emptyFamily = (): FamilyData => ({
  people: [], unions: [], parentage: [], media: [],
  stories: [], events: [], places: [], branches: [],
});
