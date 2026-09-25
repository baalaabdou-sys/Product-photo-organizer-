/**
 * Logic checks that do not need a browser: GEDCOM round-trip fidelity,
 * kinship naming, and the safeguards against impossible data.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let pass = 0, fail = 0;
const eq = (actual, expected, label) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); }
};
const ok = (cond, label) => eq(Boolean(cond), true, label);

const { parseGedcom } = await import('../.testbuild/gedcom/parse.js');
const { toGedcom, toJson } = await import('../.testbuild/gedcom/serialize.js');
const { FamilyGraph } = await import('../.testbuild/domain/graph.js');
const { describeRelationship, findPath } = await import('../.testbuild/domain/relationships.js');
const { reviewFamily } = await import('../.testbuild/domain/validate.js');
const family = JSON.parse(readFileSync(new URL('../src/data/family.json', import.meta.url), 'utf8'));
const { buildPreview, applyImport } = await import('../.testbuild/gedcom/import.js');
const { formatDate, parseGedcomDate, toGedcomDate } = await import('../.testbuild/domain/dates.js');

console.log('\nGEDCOM dates');
eq(parseGedcomDate('17 MAR 1948').value, '1948-03-17', 'day/month/year');
eq(parseGedcomDate('ABT 1901').qualifier, 'about', 'ABT qualifier');
eq(parseGedcomDate('BEF 1900').qualifier, 'before', 'BEF qualifier');
eq(parseGedcomDate('BET 1910 AND 1915').value, '1910', 'BET takes the first year');
eq(formatDate(parseGedcomDate('2 SEP 1938')), '2 September 1938', 'formats for reading');
eq(toGedcomDate(parseGedcomDate('17 MAR 1948')), '17 MAR 1948', 'date round-trips');

console.log('\nGEDCOM parsing');
const GED = readFileSync(new URL('./fixture.ged', import.meta.url), 'utf8');
const rep = parseGedcom(GED);
eq(rep.counts.people, 9, 'parses every individual');
eq(rep.counts.unions, 3, 'parses every family');
const g = new FamilyGraph(rep.data);
const byName = (f) => [...g.people.values()].find((p) => p.firstName === f);
const omar = byName('Omar'), hassan = byName('Hassan'), amina = byName('Amina');
const nabil = byName('Nabil'), salma = byName('Salma'), tariq = byName('Tariq');
ok(omar && hassan && amina && nabil && salma && tariq, 'every name imported');
eq(g.parents(hassan.id).map((p) => p.firstName).sort(), ['Omar', 'Zahra'], 'parent links');
eq(g.children(omar.id).map((p) => p.firstName).sort(), ['Hassan', 'Latifa'], 'child links');
eq(g.partners(omar.id).map((p) => p.firstName), ['Zahra'], 'marriage link');
eq(omar.birthPlace.name, 'Fes, Morocco', 'birthplace');
eq(g.generations, 3, 'generation count');

console.log('\nKinship naming');
const rel = (a, b) => describeRelationship(g, a.id, b.id).label;
eq(rel(nabil, omar), 'Grandfather', 'grandfather');
eq(rel(omar, nabil), 'Grandson', 'grandson');
eq(rel(nabil, hassan), 'Father', 'father');
eq(rel(nabil, salma), 'Sister', 'sister');
eq(rel(nabil, byName('Latifa')), 'Aunt', 'aunt');
eq(rel(nabil, tariq), 'First cousin', 'first cousin');
eq(rel(byName('Latifa'), nabil), 'Nephew', 'nephew');
eq(describeRelationship(g, nabil.id, tariq.id).sentence, 'Nabil and Tariq are first cousins.', 'cousin sentence');
eq(rel(hassan, amina), 'Wife', 'spouse');
eq(rel(nabil, nabil), 'This is you', 'self');
const path = findPath(g, nabil.id, tariq.id);
eq(path.length, 5, 'cousin path is five people');
eq(path[0], nabil.id, 'path starts at the viewer');
eq(path[path.length - 1], tariq.id, 'path ends at the target');

console.log('\nGEDCOM export round-trip');
const out = toGedcom(rep.data);
const back = parseGedcom(out);
eq(back.counts.people, rep.counts.people, 'people survive the round-trip');
eq(back.counts.unions, rep.counts.unions, 'unions survive the round-trip');
const g2 = new FamilyGraph(back.data);
const nabil2 = [...g2.people.values()].find((p) => p.firstName === 'Nabil');
const omar2 = [...g2.people.values()].find((p) => p.firstName === 'Omar');
eq(describeRelationship(g2, nabil2.id, omar2.id).label, 'Grandfather', 'relationships survive the round-trip');
eq(g2.parents(nabil2.id).map((p) => p.firstName).sort(), ['Amina', 'Hassan'], 'parent links survive');
ok(out.startsWith('0 HEAD'), 'header');
ok(out.trimEnd().endsWith('0 TRLR'), 'trailer');

console.log('\nSafeguards');
const bad = JSON.parse(JSON.stringify(rep.data));
// Child born before the parent.
bad.people.find((p) => p.firstName === 'Nabil').birthDate = { value: '1890' };
const issues = reviewFamily(bad);
ok(issues.some((i) => i.id.startsWith('child-older')), 'catches a child born before a parent');
// Circular ancestry.
const cyc = JSON.parse(JSON.stringify(rep.data));
cyc.parentage.push({ id: 'x', parentId: nabil.id, childId: omar.id, type: 'biological', metadata: { createdAt: 0 } });
ok(reviewFamily(cyc).some((i) => i.severity === 'error' && i.id.startsWith('cycle')), 'catches circular ancestry');
const cycG = new FamilyGraph(cyc);
ok(cycG.generations > 0, 'a cyclic graph still lays out rather than hanging');
ok(cycG.wouldCreateCycle(nabil.id, omar.id) || true, 'cycle predicate runs');
ok(new FamilyGraph(rep.data).wouldCreateCycle(nabil.id, omar.id) === true, 'predicts a cycle before it is made');
ok(new FamilyGraph(rep.data).wouldCreateCycle(omar.id, nabil.id) === false, 'allows a legitimate parent link');

console.log('\nThe Abderrahmane family');
const fg = new FamilyGraph(family);
eq(family.people.length, 76, 'all 76 people from the FamilyEcho chart');
eq(fg.generations, 5, 'five generations');
eq(fg.componentCount, 1, 'everyone is connected to everyone else');
eq(reviewFamily(family).filter((i) => i.severity === 'error').length, 0, 'no integrity errors');
const fam = (n) => [...fg.people.values()].filter((p) => p.firstName === n);
const halima = fam('حليمة')[0];
eq(fg.partners(halima.id).map((p) => p.firstName), ['محمد'], 'Halima married Mohamed');
eq(fg.children(halima.id).length, 7, 'Halima and Mohamed had seven children');
const abderrahmane = fam('عبدالرحمان')[0];
eq(describeRelationship(fg, abderrahmane.id, halima.id).label, 'Grandmother', 'Halima is Abderrahmane\'s grandmother');

// A stand-in archive of flagged demonstration records, to test their removal.
const demo = JSON.parse(JSON.stringify(rep.data));
for (const p of demo.people) { p.id = `demo_${p.id}`; p.metadata.demo = true; p.metadata.sourceId = undefined; p.firstName += 'x'; }
demo.parentage = []; demo.unions = [];

console.log('\nImport merge');
const file = { name: 'family.ged', text: async () => GED };
const preview = await buildPreview(file, demo);
eq(preview.counts.people, 9, 'preview counts the incoming people');
eq(preview.existingCount, demo.people.length, 'preview reports what is already stored');
const merged = applyImport(demo, preview, { strategy: 'merge', removeDemo: true });
eq(merged.data.people.length, 9, 'merging with removeDemo leaves only the imported family');
ok(merged.data.people.every((p) => !p.metadata.demo), 'no demo records survive');
const kept = applyImport(demo, preview, { strategy: 'merge', removeDemo: false });
eq(kept.data.people.length, demo.people.length + 9, 'merging without removeDemo keeps both');
const replaced = applyImport(demo, preview, { strategy: 'replace', removeDemo: false });
eq(replaced.data.people.length, 9, 'replace starts from the file');
// Re-importing the same file must not duplicate anyone.
const preview2 = await buildPreview(file, merged.data);
const twice = applyImport(merged.data, preview2, { strategy: 'merge', removeDemo: false });
eq(twice.data.people.length, 9, 're-importing the same file adds nobody');
eq(twice.summary.added, 0, 're-import adds nothing');

console.log('\nJSON backup round-trip');
const json = JSON.parse(toJson(rep.data));
eq(json.data.people.length, 9, 'json holds every person');
const jsonFile = { name: 'backup.json', text: async () => JSON.stringify(json) };
const jp = await buildPreview(jsonFile, { people: [], unions: [], parentage: [], media: [], stories: [], events: [], places: [], branches: [] });
eq(jp.counts.people, 9, 'json re-imports');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
