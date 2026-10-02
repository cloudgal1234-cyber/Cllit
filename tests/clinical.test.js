const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/clinical.js');
const Seed = require('../js/data.js');

const drug = id => Seed.DRUGS.find(d => d.id === id);
const david = Seed.PATIENTS.find(p => p.id === '034567891'); // אלרגי לפניצילין
const child = Seed.PATIENTS.find(p => p.id === '121212120');

test('אימות ת.ז ישראלית', () => {
  assert.ok(C.isValidIsraeliId('034567891'));
  assert.ok(!C.isValidIsraeliId('034567890'));
  assert.ok(!C.isValidIsraeliId('abc'));
  for (const p of Seed.PATIENTS) assert.ok(C.isValidIsraeliId(p.id), p.id);
});

test('אלרגיה ישירה ורגישות צולבת', () => {
  const w = C.checkAllergies(david, drug('D04'));
  assert.strictEqual(w[0].level, 'severe');
  const cross = C.checkAllergies(david, drug('D06'));
  assert.strictEqual(cross.length, 1);
  assert.strictEqual(cross[0].level, 'moderate');
  assert.deepStrictEqual(C.checkAllergies(david, drug('D01')), []);
});

test('הגבלת גיל', () => {
  assert.strictEqual(C.checkAge(child, drug('D20'))[0].level, 'severe');
  assert.deepStrictEqual(C.checkAge(david, drug('D20')), []);
});

test('אינטראקציות מול תרופות פעילות וכפילות טיפולית', () => {
  const w = C.checkInteractions([drug('D02')], [drug('D19'), drug('D15')], Seed.INTERACTIONS);
  assert.ok(w.some(x => x.level === 'severe' && x.msg.includes('וורפרין')));
  assert.ok(w.some(x => x.msg.includes('רמיפריל')));
  const dup = C.checkInteractions([drug('D02'), drug('D03')], [], Seed.INTERACTIONS);
  assert.ok(dup.some(x => x.type === 'duplicate'));
  // אין אזהרה על זוג ישן-ישן
  assert.deepStrictEqual(C.checkInteractions([drug('D01')], [drug('D19'), drug('D20')], Seed.INTERACTIONS), []);
});

test('השתתפות עצמית', () => {
  assert.strictEqual(C.copay(drug('D01'), 'בסיסי', 1).perPack, 10);
  assert.strictEqual(C.copay(drug('D28'), 'בסיסי', 2).total, 63);
  assert.strictEqual(C.copay(drug('D32'), 'פלטינום', 1).perPack, 57.85);
  assert.strictEqual(C.copay(drug('D32'), 'בסיסי', 1).covered, false);
});

test('סטטוס מרשם וזכאות לניפוק חוזר', () => {
  const now = new Date('2026-01-31T12:00:00Z');
  const rx = { date: '2026-01-01', validUntil: '2026-04-01', items: [
    { drugId: 'D11', repeats: 3, dispenses: ['2026-01-20T10:00:00Z'] },
    { drugId: 'D15', repeats: 1, dispenses: [] },
  ] };
  assert.strictEqual(C.prescriptionStatus(rx, now), 'נופק חלקית');
  assert.strictEqual(C.itemDispensable(rx, rx.items[0], now).ok, false);
  assert.strictEqual(C.itemDispensable(rx, rx.items[0], new Date('2026-02-20')).ok, true);
  assert.strictEqual(C.itemDispensable(rx, rx.items[1], now).ok, true);
  assert.strictEqual(C.prescriptionStatus(rx, new Date('2026-05-01')), 'פג תוקף');
  assert.strictEqual(C.prescriptionStatus({ ...rx, cancelled: true }, now), 'בוטל');
});

test('תוקף מרשם: סם מסוכן 10 ימים, כרוני לפי ניפוקים', () => {
  const byId = Object.fromEntries(Seed.DRUGS.map(d => [d.id, d]));
  assert.strictEqual(C.prescriptionValidityDays([{ drugId: 'D29', repeats: 1 }], byId), 10);
  assert.strictEqual(C.prescriptionValidityDays([{ drugId: 'D11', repeats: 6 }], byId), 180);
});
