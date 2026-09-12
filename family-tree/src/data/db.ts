import Dexie, { type Table } from 'dexie';
import type { FamilyData } from '../domain/types';
import { emptyFamily } from '../domain/types';

export interface SettingRow { key: string; value: unknown }
export interface BlobRow { id: string; blob: Blob; thumb?: Blob }
export interface SnapshotRow { id?: number; at: number; reason: string; data: FamilyData }

/**
 * Local-first storage. The whole archive is one document — family trees are
 * small enough for that, and it makes atomic undo/restore trivial.
 * Media blobs live in their own table so the document stays light.
 */
class ArchiveDB extends Dexie {
  archive!: Table<{ id: string; data: FamilyData; updatedAt: number }, string>;
  settings!: Table<SettingRow, string>;
  blobs!: Table<BlobRow, string>;
  snapshots!: Table<SnapshotRow, number>;

  constructor() {
    super('abderrahmane-family-archive');
    this.version(1).stores({
      archive: 'id, updatedAt',
      settings: 'key',
      blobs: 'id',
      snapshots: '++id, at',
    });
  }
}

export const db = new ArchiveDB();

const ARCHIVE_ID = 'main';

let available: boolean | null = null;
/** Private-browsing and locked-down browsers can refuse IndexedDB entirely. */
export async function storageAvailable(): Promise<boolean> {
  if (available !== null) return available;
  try { await db.open(); available = true; }
  catch { available = false; }
  return available;
}

export async function loadArchive(): Promise<FamilyData | null> {
  if (!(await storageAvailable())) return null;
  try {
    const row = await db.archive.get(ARCHIVE_ID);
    return row?.data ?? null;
  } catch { return null; }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pending: FamilyData | null = null;

/** Debounced write — the tree is edited far more often than it is persisted. */
export function saveArchive(data: FamilyData): void {
  pending = data;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushArchive(), 400);
}

export async function flushArchive(): Promise<void> {
  if (!pending) return;
  const data = pending;
  pending = null;
  if (!(await storageAvailable())) return;
  try {
    await db.archive.put({ id: ARCHIVE_ID, data, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[archive] could not persist', err);
  }
}

/** A restore point taken before anything destructive (import, bulk delete). */
export async function snapshot(reason: string, data: FamilyData): Promise<void> {
  if (!(await storageAvailable())) return;
  try {
    await db.snapshots.add({ at: Date.now(), reason, data });
    const all = await db.snapshots.orderBy('at').toArray();
    if (all.length > 10) {
      await db.snapshots.bulkDelete(all.slice(0, all.length - 10).map((s) => s.id!));
    }
  } catch { /* a failed snapshot must never block the user's action */ }
}

export async function listSnapshots(): Promise<SnapshotRow[]> {
  if (!(await storageAvailable())) return [];
  try { return (await db.snapshots.orderBy('at').reverse().toArray()); }
  catch { return []; }
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (!(await storageAvailable())) return fallback;
  try {
    const row = await db.settings.get(key);
    return (row?.value as T) ?? fallback;
  } catch { return fallback; }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  if (!(await storageAvailable())) return;
  try { await db.settings.put({ key, value }); } catch { /* non-fatal */ }
}

export async function putBlob(id: string, blob: Blob, thumb?: Blob): Promise<void> {
  if (!(await storageAvailable())) return;
  try { await db.blobs.put({ id, blob, thumb }); } catch { /* non-fatal */ }
}

export async function getBlob(id: string): Promise<BlobRow | undefined> {
  if (!(await storageAvailable())) return undefined;
  try { return await db.blobs.get(id); } catch { return undefined; }
}

export async function deleteBlob(id: string): Promise<void> {
  if (!(await storageAvailable())) return;
  try { await db.blobs.delete(id); } catch { /* non-fatal */ }
}

export async function clearEverything(): Promise<void> {
  if (!(await storageAvailable())) return;
  await db.archive.clear();
  await db.blobs.clear();
  await db.snapshots.clear();
}

export const freshArchive = emptyFamily;
