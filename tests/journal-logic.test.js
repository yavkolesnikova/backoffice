const test = require('node:test');
const assert = require('node:assert/strict');
const J = require('../journal-logic.js');

const at = (y, mo, d, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, mo - 1, d, h, mi, s, ms).getTime();
const NOW = at(2024, 8, 29, 14, 30);

test('formatting', () => {
  assert.equal(J.formatDate(at(2026, 9, 21)), '21.09.2026');
  assert.equal(J.formatDateTime(at(2026, 9, 21, 9, 22, 4)), '21.09.2026 09:22:04');
  assert.equal(J.formatRange(at(2026, 8, 21), at(2026, 9, 21, 23, 59, 59, 999)), '21.08.2026 00:00 - 21.09.2026 23:59');
});

test('addMonths clamps the day of month', () => {
  assert.equal(J.formatDate(J.addMonths(at(2024, 3, 31), -1)), '29.02.2024');
  assert.equal(J.formatDate(J.addMonths(at(2024, 1, 15), -2)), '15.11.2023');
});

test('presets match the mockup ranges for 29.08.2024', () => {
  const ranges = Object.fromEntries(J.presets(NOW).map((p) => [p.id, `${J.formatDate(p.from)} — ${J.formatDate(p.to)}`]));
  assert.deepEqual(ranges, {
    today: '29.08.2024 — 29.08.2024',
    yesterday: '28.08.2024 — 28.08.2024',
    last7: '23.08.2024 — 29.08.2024',
    last30: '31.07.2024 — 29.08.2024',
    last3m: '29.05.2024 — 29.08.2024',
    half: '29.02.2024 — 29.08.2024',
    year: '29.08.2023 — 29.08.2024',
  });
});

test('presets cover whole days', () => {
  const today = J.presets(NOW)[0];
  assert.equal(J.formatRange(today.from, today.to), '29.08.2024 00:00 - 29.08.2024 23:59');
  assert.equal(today.to - today.from, 86400000 - 1);
});

test('mock events: deterministic, newest first, within the last year', () => {
  const events = J.buildEvents(NOW);
  assert.equal(events.length, 90);
  assert.deepEqual(events, J.buildEvents(NOW));
  for (let i = 1; i < events.length; i += 1) assert.ok(events[i - 1].time >= events[i].time);
  assert.ok(events.every((e) => e.time <= NOW && e.time > J.addDays(NOW, -366)));
  assert.ok(events.every((e) => J.ACTIONS.find((a) => a.id === e.action).source === e.source));
});

test('mock events: account creation names a client, login does not', () => {
  const ids = ['a1', 'b2', 'c3'];
  const events = J.buildEvents(NOW, ids);
  assert.ok(events.some((e) => e.action === 'create'));
  assert.ok(events.every((e) => (e.action === 'create' ? ids.includes(e.clientId) : e.clientId === null)));
  assert.ok(J.buildEvents(NOW).every((e) => e.clientId === null));
});

test('filter: range bounds are inclusive', () => {
  const events = [{ time: 100, employee: 'ivanov', action: 'create', source: 'backoffice' }];
  assert.equal(J.filterEvents(events, { from: 100, to: 100 }).length, 1);
  assert.equal(J.filterEvents(events, { from: 101, to: 200 }).length, 0);
  assert.equal(J.filterEvents(events, { from: 0, to: 99 }).length, 0);
});

test('filter: action, source and employee query combine', () => {
  const events = [
    { time: 1, employee: 'ivanov', action: 'create', source: 'backoffice' },
    { time: 2, employee: 'petrov', action: 'login', source: 's2' },
    { time: 3, employee: 'Ivanova', action: 'login', source: 's2' },
  ];
  const run = (filters) => J.filterEvents(events, { from: 0, to: 10, ...filters }).map((e) => e.time);
  assert.deepEqual(run({}), [1, 2, 3]);
  assert.deepEqual(run({ action: 'login' }), [2, 3]);
  assert.deepEqual(run({ source: 'backoffice' }), [1]);
  assert.deepEqual(run({ query: '  IVAN ' }), [1, 3]);
  assert.deepEqual(run({ query: 'ivan', action: 'login' }), [3]);
  assert.deepEqual(run({ action: 'create', source: 's2' }), []);
});

test('paginate: slice bounds and clamping', () => {
  assert.deepEqual(J.paginate(100, 1, 10), { page: 1, pages: 10, start: 0, end: 10 });
  assert.deepEqual(J.paginate(23, 3, 10), { page: 3, pages: 3, start: 20, end: 23 });
  assert.deepEqual(J.paginate(23, 9, 10), { page: 3, pages: 3, start: 20, end: 23 });
  assert.deepEqual(J.paginate(23, 0, 10), { page: 1, pages: 3, start: 0, end: 10 });
  assert.deepEqual(J.paginate(10, 1, 10), { page: 1, pages: 1, start: 0, end: 10 });
  assert.deepEqual(J.paginate(0, 1, 10), { page: 1, pages: 1, start: 0, end: 0 });
});

test('month grid starts on Monday', () => {
  // 1 July 2022 is a Friday, 1 August 2022 is a Monday
  assert.deepEqual(J.monthGrid(2022, 6).slice(0, 6), [null, null, null, null, 1, 2]);
  assert.equal(J.monthGrid(2022, 6).length, 4 + 31);
  assert.equal(J.monthGrid(2022, 7)[0], 1);
  assert.equal(J.monthGrid(2024, 1).filter(Boolean).length, 29);
});

test('time mask and parsing', () => {
  assert.equal(J.maskTime('9'), '9');
  assert.equal(J.maskTime('093'), '09:3');
  assert.equal(J.maskTime('09:30'), '09:30');
  assert.equal(J.maskTime('09301'), '09:30');
  assert.equal(J.maskTime('ab'), '');
  assert.deepEqual(J.parseTime('09:30'), { h: 9, m: 30 });
  assert.equal(J.parseTime('24:00'), null);
  assert.equal(J.parseTime('12:60'), null);
  assert.equal(J.parseTime('9:3'), null);
  assert.equal(J.parseTime(''), null);
});

test('withTime: explicit time, and day-edge fallback when empty', () => {
  const day = at(2026, 9, 21);
  assert.equal(J.withTime(day, '09:30', 'start'), at(2026, 9, 21, 9, 30));
  assert.equal(J.withTime(day, '18:00', 'end'), at(2026, 9, 21, 18, 0, 59, 999));
  assert.equal(J.withTime(day, '', 'start'), at(2026, 9, 21));
  assert.equal(J.withTime(day, '', 'end'), at(2026, 9, 21, 23, 59, 59, 999));
});
