const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

const names = (query) => L.filterClients(L.CLIENTS, query).map((c) => c.name);

test('mock data: eight clients with unique ids and phones', () => {
  assert.equal(L.CLIENTS.length, 8);
  assert.equal(new Set(L.CLIENTS.map((c) => c.id)).size, 8);
  assert.equal(new Set(L.CLIENTS.map((c) => c.phone)).size, 8);
});

test('search: empty and whitespace-only query returns everyone', () => {
  assert.equal(names('').length, 8);
  assert.equal(names('   ').length, 8);
});

test('search: by name ignores case, quotes, extra spaces and yo', () => {
  assert.deepEqual(names('ромашка'), ['ООО "Ромашка"']);
  assert.deepEqual(names('ООО  ромашка'), ['ООО "Ромашка"']);
  assert.deepEqual(names('"Ромашка"'), ['ООО "Ромашка"']);
  assert.deepEqual(names('звёзда'), ['ООО "Звезда"']);
  assert.deepEqual(names('теплый дом'), ['ООО "Тёплый дом"']);
  assert.deepEqual(names('соколова'), ['ИП Соколова А. В.']);
  assert.equal(names('ооо').length, 6);
});

test('search: query of quotes only returns nothing', () => {
  assert.deepEqual(names('""'), []);
});

test('search: by phone in any format', () => {
  assert.deepEqual(names('9629053471'), ['ООО "Звезда"']);
  assert.deepEqual(names('962 905-34-71'), ['ООО "Звезда"']);
  assert.deepEqual(names('+7 (962) 905-34-71'), ['ООО "Звезда"']);
  assert.deepEqual(names('89629053471'), ['ООО "Звезда"']);
  assert.deepEqual(names('39-15'), ['ООО "Вектор"']);
});

test('search: by id fragment, case-insensitive', () => {
  assert.deepEqual(names('8d5013'), ['ООО "Вектор"']);
  assert.deepEqual(names('8D5013'), ['ООО "Вектор"']);
  assert.deepEqual(names('72d6c1f9-0e58'), ['ООО "Вектор"']);
});

test('search: mixed letter-digit query does not match via phone digits', () => {
  // ids are hex, so fragments with z/q can only match through phone digits
  assert.deepEqual(names('z6'), []);
  assert.deepEqual(names('q906'), []);
});

test('search: no match', () => {
  assert.deepEqual(names('несуществующий'), []);
});

test('phone input normalisation', () => {
  assert.equal(L.normalizePhoneDigits('+7 (906) 644-28-95'), '9066442895');
  assert.equal(L.normalizePhoneDigits('89066442895'), '9066442895');
  assert.equal(L.normalizePhoneDigits('9066442895'), '9066442895');
  assert.equal(L.normalizePhoneDigits('90664428951234'), '9066442895');
  assert.equal(L.normalizePhoneDigits('abc'), '');
});

test('phone formatting, including partial input', () => {
  assert.equal(L.formatPhone('9066442895'), '906 644-28-95');
  assert.equal(L.formatPhone('906'), '906');
  assert.equal(L.formatPhone('9066'), '906 6');
  assert.equal(L.formatPhone('9066442'), '906 644-2');
  assert.equal(L.formatPhone(''), '');
});

test('form validation: error texts', () => {
  assert.deepEqual(L.validateForm({ tariff: '', ban: '12', phone: '906', email: 'a@b' }), {
    tariff: 'Выберите тарифный план',
    ban: 'Введите 9 цифр',
    phone: 'Введите номер полностью',
    email: 'Проверьте адрес почты',
  });
});

test('form validation: valid form', () => {
  const form = { tariff: 'business', ban: '123456789', phone: '9066442895', email: ' user@example.ru ' };
  assert.deepEqual(L.validateForm(form), { tariff: '', ban: '', phone: '', email: '' });
  assert.equal(L.isFormValid(form), true);
});

test('form validation: rejects unknown tariff, spaces in email, 10-digit ban', () => {
  const ok = { tariff: 'business', ban: '123456789', phone: '9066442895', email: 'user@example.ru' };
  assert.equal(L.isFormValid({ ...ok, tariff: 'nope' }), false);
  assert.equal(L.isFormValid({ ...ok, email: 'us er@example.ru' }), false);
  assert.equal(L.isFormValid({ ...ok, ban: '1234567890' }), false);
});

test('availability: actions only for clients without PBX', () => {
  const by = (name) => L.CLIENTS.find((c) => c.name.includes(name));
  assert.equal(L.canConnect(by('Звезда')), true);
  assert.equal(L.canConnect(by('Вектор')), true);
  assert.equal(L.canConnect(by('Корытце')), false);
  assert.equal(L.canConnect(by('Ромашка')), false);
  assert.equal(L.canConnect(by('Коврики')), false);
  assert.equal(L.canConnect(by('Северный берег')), true);
  assert.equal(L.canConnect(by('Соколова')), false);
  assert.equal(L.canConnect(by('Тёплый дом')), false);
  assert.equal(L.canConnect({ hasPbx: true, crm: 'available' }), false);
  assert.equal(L.canRetry({ hasPbx: false, crm: 'error' }), true);
  assert.equal(L.canRetry({ hasPbx: true, crm: 'error' }), false);
});

test('outcome: success client connects, fail-first client fails once', () => {
  assert.equal(L.resolveOutcome({ outcome: 'success', attempts: 1 }), 'connected');
  assert.equal(L.resolveOutcome({ outcome: 'fail-first', attempts: 1 }), 'error');
  assert.equal(L.resolveOutcome({ outcome: 'fail-first', attempts: 2 }), 'connected');
});
