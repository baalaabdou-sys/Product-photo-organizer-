import type { FamilyData } from '../domain/types';
import family from './family.json';

/**
 * The Abderrahmane family, as recorded in FamilyEcho (exported 25 Sep 2026).
 *
 * Transcribed from the FamilyEcho chart: names, gender and who is whose
 * parent and partner. The chart carries no dates or places, so none are
 * recorded here. Two unnamed parents appear in FamilyEcho as "Father of" /
 * "Mother of" Halima and keep that meaning.
 *
 * Unions and parentage are typed "unknown": the chart shows a partnership and
 * a parent link, not whether it was a marriage or a biological relationship.
 */
export function familyTree(): FamilyData {
  return JSON.parse(JSON.stringify(family)) as FamilyData;
}
