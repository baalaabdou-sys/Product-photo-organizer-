import type { FamilyData, Person, Union, ParentChild, Story, FamilyEvent, Place, FamilyBranch } from '../domain/types';
import { emptyFamily } from '../domain/types';

/**
 * ─────────────────────────────────────────────────────────────
 * DEMONSTRATION DATA — NOT THE ABDERRAHMANE FAMILY.
 *
 * Every record here carries `metadata.demo = true`. The app labels it
 * plainly wherever it appears, and Settings → Import removes all of it in
 * one step. It exists only so the interface can be judged before the real
 * GEDCOM is imported.
 * ─────────────────────────────────────────────────────────────
 */
export const DEMO_SURNAME = 'Bennani';
export const DEMO_NOTICE =
  'A demonstration family, shown only so you can try the app. These are not real relatives.';

const t = Date.parse('2024-01-01');
const meta = (sourceId: string) => ({
  sourceId, source: 'demo' as const, createdAt: t, updatedAt: t, demo: true,
});

const person = (
  id: string,
  firstName: string,
  gender: Person['gender'],
  extra: Partial<Person> = {},
): Person => ({
  id,
  firstName,
  lastName: DEMO_SURNAME,
  gender,
  privacy: { level: 'family' },
  metadata: meta(id),
  ...extra,
});

const places: Place[] = [
  { id: 'pl_casa', name: 'Casablanca, Morocco', country: 'Morocco', lat: 33.5731, lon: -7.5898, metadata: { demo: true } },
  { id: 'pl_fes', name: 'Fès, Morocco', country: 'Morocco', lat: 34.0181, lon: -5.0078, metadata: { demo: true } },
  { id: 'pl_rabat', name: 'Rabat, Morocco', country: 'Morocco', lat: 34.0209, lon: -6.8416, metadata: { demo: true } },
  { id: 'pl_marrakech', name: 'Marrakech, Morocco', country: 'Morocco', lat: 31.6295, lon: -7.9811, metadata: { demo: true } },
  { id: 'pl_lyon', name: 'Lyon, France', country: 'France', lat: 45.764, lon: 4.8357, metadata: { demo: true } },
  { id: 'pl_montreal', name: 'Montréal, Canada', country: 'Canada', lat: 45.5019, lon: -73.5674, metadata: { demo: true } },
];

const at = (id: string) => {
  const p = places.find((x) => x.id === id)!;
  return { name: p.name, placeId: p.id };
};

const people: Person[] = [
  // Generation I
  person('d_omar', 'Omar', 'male', {
    birthDate: { value: '1901' }, birthPlace: at('pl_fes'),
    deathDate: { value: '1974-06' }, deathPlace: at('pl_fes'),
    burialPlace: at('pl_fes'),
    living: false,
    profession: 'Leather craftsman',
    company: 'His own workshop in the medina',
    interests: ['Calligraphy', 'Gardening'],
    biography:
      'Kept a leather workshop near the tannery quarter for more than forty years. Known in the family for never raising his voice and for the smell of cedar and wax that followed him home.',
  }),
  person('d_khadija', 'Khadija', 'female', {
    birthSurname: 'Tazi',
    birthDate: { value: '1908' }, birthPlace: at('pl_fes'),
    deathDate: { value: '1989' }, deathPlace: at('pl_casa'),
    living: false,
    profession: 'Weaver',
    interests: ['Embroidery', 'Poetry'],
    biography: 'Wove the blankets that three generations of the family were wrapped in as newborns.',
  }),

  // Generation II
  person('d_mohamed', 'Mohamed', 'male', {
    birthDate: { value: '1932-04-11' }, birthPlace: at('pl_fes'),
    deathDate: { value: '2011-01-22' }, deathPlace: at('pl_casa'),
    burialPlace: at('pl_casa'),
    living: false,
    profession: 'Schoolteacher',
    company: 'Lycée Mohammed V',
    interests: ['History', 'Chess', 'Long walks'],
    activities: ['Taught evening literacy classes for thirty years'],
    biography:
      'Moved to Casablanca at nineteen with one suitcase and a letter of introduction. Taught two generations of the neighbourhood to read, and kept every class photograph.',
  }),
  person('d_fatima', 'Fatima', 'female', {
    birthSurname: 'Alaoui',
    birthDate: { value: '1938-09-02' }, birthPlace: at('pl_rabat'),
    deathDate: { value: '2019-11-30' }, deathPlace: at('pl_casa'),
    living: false,
    profession: 'Midwife',
    interests: ['Cooking', 'Radio dramas'],
    biography: 'Delivered, by her own count, more than two thousand babies in Casablanca.',
  }),
  person('d_aicha', 'Aïcha', 'female', {
    birthDate: { value: '1936' }, birthPlace: at('pl_fes'),
    deathDate: { value: '2004' },
    living: false,
    profession: 'Seamstress',
  }),

  // Generation III
  person('d_rachid', 'Rachid', 'male', {
    birthDate: { value: '1961-03-17' }, birthPlace: at('pl_casa'),
    profession: 'Civil engineer',
    company: 'Ministry of Public Works',
    interests: ['Photography', 'Football'],
    biography: 'Photographed nearly every family gathering from 1979 onward. Most of the pictures in this archive are his.',
  }),
  person('d_samira', 'Samira', 'female', {
    birthSurname: 'Idrissi',
    birthDate: { value: '1965-07-24' }, birthPlace: at('pl_marrakech'),
    profession: 'Pharmacist',
    interests: ['Gardening'],
  }),
  person('d_leila', 'Leïla', 'female', {
    birthDate: { value: '1964-12-05' }, birthPlace: at('pl_casa'),
    profession: 'Architect',
    company: 'Independent practice, Lyon',
    interests: ['Ceramics', 'Cycling'],
    biography: 'Left for Lyon to study in 1983 and stayed. Returns every summer.',
  }),
  person('d_pierre', 'Pierre', 'male', {
    lastName: 'Garnier',
    birthDate: { value: '1962-02-18' }, birthPlace: at('pl_lyon'),
    profession: 'Music teacher',
  }),
  person('d_nadia', 'Nadia', 'female', {
    birthDate: { value: '1968' }, birthPlace: at('pl_casa'),
    profession: 'Journalist',
  }),

  // Generation IV
  person('d_youssef', 'Youssef', 'male', {
    nickname: 'Youss',
    birthDate: { value: '1992-05-09' }, birthPlace: at('pl_casa'),
    profession: 'Software developer',
    company: 'Remote',
    interests: ['Running', 'Old cameras'],
    activities: ['Started digitising the family photographs in 2021'],
    biography: 'Began scanning the boxes of photographs his grandfather left, which is how this archive started.',
  }),
  person('d_sara', 'Sara', 'female', {
    birthDate: { value: '1995-10-30' }, birthPlace: at('pl_casa'),
    profession: 'Doctor',
    interests: ['Swimming'],
  }),
  person('d_ines', 'Inès', 'female', {
    lastName: 'Garnier',
    birthDate: { value: '1994-08-14' }, birthPlace: at('pl_lyon'),
    profession: 'Marine biologist',
    interests: ['Diving', 'Illustration'],
  }),
  person('d_karim', 'Karim', 'male', {
    lastName: 'Garnier',
    birthDate: { value: '1997-01-26' }, birthPlace: at('pl_montreal'),
    profession: 'Student',
  }),

  // Generation V
  person('d_amine', 'Amine', 'male', {
    birthDate: { value: '2021-06-03' }, birthPlace: at('pl_casa'),
  }),
];

const unions: Union[] = [
  {
    id: 'du_1', personA: 'd_omar', personB: 'd_khadija', type: 'marriage',
    startDate: { value: '1929' }, place: at('pl_fes'),
    metadata: { sourceId: 'du_1', demo: true, createdAt: t, updatedAt: t },
  },
  {
    id: 'du_2', personA: 'd_mohamed', personB: 'd_fatima', type: 'marriage',
    startDate: { value: '1959-08-15' }, place: at('pl_casa'),
    metadata: { sourceId: 'du_2', demo: true, createdAt: t, updatedAt: t },
  },
  {
    id: 'du_3', personA: 'd_rachid', personB: 'd_samira', type: 'marriage',
    startDate: { value: '1990-06-02' }, place: at('pl_casa'),
    metadata: { sourceId: 'du_3', demo: true, createdAt: t, updatedAt: t },
  },
  {
    id: 'du_4', personA: 'd_pierre', personB: 'd_leila', type: 'marriage',
    startDate: { value: '1991-09-21' }, place: at('pl_lyon'),
    metadata: { sourceId: 'du_4', demo: true, createdAt: t, updatedAt: t },
  },
  {
    id: 'du_5', personA: 'd_youssef', personB: 'd_ines', type: 'partnership',
    startDate: { value: '2019' },
    metadata: { sourceId: 'du_5', demo: true, createdAt: t, updatedAt: t },
  },
];

const link = (parentId: string, childId: string, unionId?: string): ParentChild => ({
  id: `dpc_${parentId}_${childId}`,
  parentId, childId, type: 'biological', unionId,
  metadata: { demo: true, createdAt: t },
});

const parentage: ParentChild[] = [
  link('d_omar', 'd_mohamed', 'du_1'), link('d_khadija', 'd_mohamed', 'du_1'),
  link('d_omar', 'd_aicha', 'du_1'), link('d_khadija', 'd_aicha', 'du_1'),

  link('d_mohamed', 'd_rachid', 'du_2'), link('d_fatima', 'd_rachid', 'du_2'),
  link('d_mohamed', 'd_leila', 'du_2'), link('d_fatima', 'd_leila', 'du_2'),
  link('d_mohamed', 'd_nadia', 'du_2'), link('d_fatima', 'd_nadia', 'du_2'),

  link('d_rachid', 'd_youssef', 'du_3'), link('d_samira', 'd_youssef', 'du_3'),
  link('d_rachid', 'd_sara', 'du_3'), link('d_samira', 'd_sara', 'du_3'),

  link('d_pierre', 'd_ines', 'du_4'), link('d_leila', 'd_ines', 'du_4'),
  link('d_pierre', 'd_karim', 'du_4'), link('d_leila', 'd_karim', 'du_4'),

  link('d_youssef', 'd_amine', 'du_5'), link('d_ines', 'd_amine', 'du_5'),
];

const stories: Story[] = [
  {
    id: 'ds_1',
    title: 'The workshop in the medina',
    body:
      'The workshop was two rooms deep and never fully lit. Omar worked at the front, where the light came in, and the back was stacked to the ceiling with hides waiting to be cut.\n\nHe had a habit of testing leather by folding it once against his thumb and listening. If it made no sound he would put it aside without explanation. None of his children ever learned what he was listening for, and by the time anyone thought to ask, he was gone.\n\nThe workshop closed in 1974. The tools went to his eldest son, and are in a wooden case in Casablanca still.',
    date: { value: '1974', qualifier: 'about' },
    place: at('pl_fes'),
    personIds: ['d_omar', 'd_mohamed'],
    mediaIds: [],
    privacy: 'family',
    metadata: { demo: true, createdAt: t, updatedAt: t, author: 'Demonstration record' },
  },
  {
    id: 'ds_2',
    title: 'How Mohamed and Fatima met',
    body:
      'They met at a wedding in Rabat in 1958, where neither of them knew more than three people. Fatima was there as the bride\'s cousin; Mohamed had come with a colleague and spent most of the evening near the door.\n\nHe wrote to her twice before she answered. The second letter, which she kept, is four lines long and mostly about the weather in Casablanca.\n\nThey married the following August.',
    date: { value: '1958' },
    place: at('pl_rabat'),
    personIds: ['d_mohamed', 'd_fatima'],
    mediaIds: [],
    privacy: 'family',
    metadata: { demo: true, createdAt: t, updatedAt: t, author: 'Demonstration record' },
  },
  {
    id: 'ds_3',
    title: 'Summers on the Lyon train',
    body:
      'From 1992 onward the children were put on the train to Lyon every July. Leïla met them at Part-Dieu with a cardboard sign, which was unnecessary but became a tradition.\n\nThe rule was that nobody spoke French at breakfast and nobody spoke Arabic at dinner. It worked better than anyone expected.',
    date: { value: '1992', qualifier: 'about' },
    place: at('pl_lyon'),
    personIds: ['d_leila', 'd_youssef', 'd_ines', 'd_karim'],
    mediaIds: [],
    privacy: 'family',
    metadata: { demo: true, createdAt: t, updatedAt: t, author: 'Demonstration record' },
  },
];

const events: FamilyEvent[] = [
  {
    id: 'de_1', kind: 'move',
    title: 'Mohamed moved to Casablanca',
    description: 'Left Fès at nineteen to take a teaching post.',
    date: { value: '1951' }, place: at('pl_casa'),
    personIds: ['d_mohamed'], privacy: 'family', metadata: { demo: true, createdAt: t },
  },
  {
    id: 'de_2', kind: 'graduation',
    title: 'Leïla qualified as an architect',
    date: { value: '1989' }, place: at('pl_lyon'),
    personIds: ['d_leila'], privacy: 'family', metadata: { demo: true, createdAt: t },
  },
  {
    id: 'de_3', kind: 'family',
    title: 'The last full family gathering in Fès',
    description: 'Four generations in one courtyard — the photograph from that afternoon hangs in two houses.',
    date: { value: '1998-07' }, place: at('pl_fes'),
    personIds: ['d_khadija', 'd_mohamed', 'd_fatima', 'd_rachid', 'd_leila', 'd_nadia', 'd_youssef'],
    privacy: 'family', metadata: { demo: true, createdAt: t },
  },
  {
    id: 'de_4', kind: 'memory',
    title: 'The photographs were scanned',
    description: 'Youssef began digitising eleven boxes of prints and negatives.',
    date: { value: '2021-09' }, place: at('pl_casa'),
    personIds: ['d_youssef', 'd_rachid'], privacy: 'family', metadata: { demo: true, createdAt: t },
  },
];

const branches: FamilyBranch[] = [
  { id: 'db_paternal', name: 'Paternal line', rootPersonId: 'd_omar', tone: 'gold', metadata: { demo: true } },
  { id: 'db_maternal', name: 'Maternal line', rootPersonId: 'd_khadija', tone: 'zellige', metadata: { demo: true } },
  { id: 'db_lyon', name: 'The Lyon branch', rootPersonId: 'd_leila', tone: 'ink', metadata: { demo: true } },
];

export function demoFamily(): FamilyData {
  return JSON.parse(JSON.stringify({
    ...emptyFamily(),
    people, unions, parentage, stories, events, places, branches,
  })) as FamilyData;
}

/** The person a first-time visitor is set as, so "How are we related?" works. */
export const DEMO_ME = 'd_youssef';
