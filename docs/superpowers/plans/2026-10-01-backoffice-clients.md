# Backoffice Clients Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clickable prototype of the «Бэкофис.Контакт.ИИ» shell and the «Список клиентов» tab with the CRM S2 connection scenario.

**Architecture:** Static page, no build step. Pure logic (mock data, search, input normalisation, validation, outcome rules) lives in `logic.js`, which loads as a plain script in the browser (`window.Logic`) and as a CommonJS module under Node for unit tests. `app.js` owns DOM state and rendering. Markup and styles are written once in `index.html` / `styles.css`.

**Tech Stack:** HTML, CSS, vanilla JS (ES2018), Node built-in test runner (`node --test`) for `logic.js`.

**Spec:** `docs/superpowers/specs/2026-10-01-backoffice-clients-design.md`

## Global Constraints

- No bundler, no npm dependencies. `index.html` must work when opened by double click (`file://`).
- All UI copy is Russian and copied verbatim from the spec (toasts, badge labels, error texts, tooltip).
- Light theme only. Moon icon and profile button are rendered but inert.
- CRM S2 actions («Подключить», «Повторить») are never rendered for a client with `hasPbx: true`.
- Pending duration 3000 ms, toast duration 4000 ms.
- State lives in memory only; reload resets everything.
- Client names contain double quotes: every value interpolated into HTML goes through `escapeHtml`.

## Review Focus

1. Search by an ID fragment that mixes letters and digits (`a2`, `4f6a`) must not match clients through stray digits in their phone number: phone matching applies only when the query consists of phone characters. Pinned in Task 1.
2. A query made only of quotes (`""`) must return nothing, and a query made only of spaces must return everyone. Pinned in Task 1.
3. Pasting `+7 (906) 644-28-95` or `89066442895` into «Тарификационный номер» must yield `906 644-28-95`, not a truncated wrong number. Pinned in Task 1.
4. Opening the panel for a second client after abandoning a half-filled form must show an empty form with no error messages and a disabled button. Checked in Task 3.
5. Filtering the client out of view while its request is pending must not lose the result: clearing the search after 3 s shows the final status. Checked in Task 4.

---

### Task 1: Pure logic and unit tests

**Files:**
- Create: `logic.js`
- Test: `tests/logic.test.js`

**Interfaces:**
- Produces (`window.Logic` in browser, `module.exports` in Node):
  - `CLIENTS: Array<{id, name, phone, hasPbx, crm, outcome}>` where `phone` is 10 digits, `crm` is `'none' | 'available' | 'pending' | 'connected' | 'error'`, `outcome` is `null | 'success' | 'fail-first'`
  - `TARIFFS: Array<{id, name, hint}>`
  - `onlyDigits(value) -> string`
  - `formatPhone(digits) -> string` (`'9066442895'` to `'906 644-28-95'`, partial input allowed)
  - `normalizePhoneDigits(raw) -> string` (max 10 digits, leading 7/8 dropped when 11+ digits)
  - `matchesQuery(client, query) -> boolean`
  - `filterClients(clients, query) -> Array`
  - `validateForm({tariff, ban, phone, email}) -> {tariff, ban, phone, email}` (each value is an error text or `''`)
  - `isFormValid(form) -> boolean`
  - `canConnect(client) -> boolean`, `canRetry(client) -> boolean`
  - `resolveOutcome(client) -> 'connected' | 'error'` (reads `client.outcome` and `client.attempts`)

- [ ] **Step 1: Write the failing tests**

`tests/logic.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

const names = (query) => L.filterClients(L.CLIENTS, query).map((c) => c.name);

test('mock data: five clients with unique ids and phones', () => {
  assert.equal(L.CLIENTS.length, 5);
  assert.equal(new Set(L.CLIENTS.map((c) => c.id)).size, 5);
  assert.equal(new Set(L.CLIENTS.map((c) => c.phone)).size, 5);
});

test('search: empty and whitespace-only query returns everyone', () => {
  assert.equal(names('').length, 5);
  assert.equal(names('   ').length, 5);
});

test('search: by name ignores case, quotes, extra spaces and yo', () => {
  assert.deepEqual(names('ромашка'), ['ООО "Ромашка"']);
  assert.deepEqual(names('ООО  ромашка'), ['ООО "Ромашка"']);
  assert.deepEqual(names('"Ромашка"'), ['ООО "Ромашка"']);
  assert.deepEqual(names('звёзда'), ['ООО "Звезда"']);
  assert.equal(names('ооо').length, 5);
});

test('search: query of quotes only returns nothing', () => {
  assert.deepEqual(names('""'), []);
});

test('search: by phone in any format', () => {
  assert.deepEqual(names('9066442895'), ['ООО "Звезда"']);
  assert.deepEqual(names('906 644-28-95'), ['ООО "Звезда"']);
  assert.deepEqual(names('+7 (906) 644-28-95'), ['ООО "Звезда"']);
  assert.deepEqual(names('89066442895'), ['ООО "Звезда"']);
  assert.deepEqual(names('28-98'), ['ООО "Вектор"']);
});

test('search: by id fragment, case-insensitive', () => {
  assert.deepEqual(names('bb77cc'), ['ООО "Вектор"']);
  assert.deepEqual(names('BB77CC'), ['ООО "Вектор"']);
  assert.equal(names('3f2a1c90').length, 5);
});

test('search: mixed letter-digit query does not match via phone digits', () => {
  // 'a2' occurs in every id ('11aa22'), so use fragments absent from ids
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
  assert.equal(L.canConnect({ hasPbx: true, crm: 'available' }), false);
  assert.equal(L.canRetry({ hasPbx: false, crm: 'error' }), true);
  assert.equal(L.canRetry({ hasPbx: true, crm: 'error' }), false);
});

test('outcome: success client connects, fail-first client fails once', () => {
  assert.equal(L.resolveOutcome({ outcome: 'success', attempts: 1 }), 'connected');
  assert.equal(L.resolveOutcome({ outcome: 'fail-first', attempts: 1 }), 'error');
  assert.equal(L.resolveOutcome({ outcome: 'fail-first', attempts: 2 }), 'connected');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/logic.test.js`
Expected: FAIL with `Cannot find module '../logic.js'`

- [ ] **Step 3: Write the implementation**

`logic.js`:

```js
(function (root) {
  'use strict';

  const CLIENTS = [
    { id: '3f2a1c90-8b1e-4f6a-9c2d-11aa22bb33cc', name: 'ООО "Ромашка"', phone: '9066442894', hasPbx: true, crm: 'connected', outcome: null },
    { id: '3f2a1c90-8b1e-4f6a-9c2d-11aa22bb44cc', name: 'ООО "Корытце"', phone: '9066442896', hasPbx: true, crm: 'none', outcome: null },
    { id: '3f2a1c90-8b1e-4f6a-9c2d-11aa22bb55cc', name: 'ООО "Звезда"', phone: '9066442895', hasPbx: false, crm: 'available', outcome: 'success' },
    { id: '3f2a1c90-8b1e-4f6a-9c2d-11aa22bb66cc', name: 'ООО "Коврики"', phone: '9066442897', hasPbx: false, crm: 'connected', outcome: null },
    { id: '3f2a1c90-8b1e-4f6a-9c2d-11aa22bb77cc', name: 'ООО "Вектор"', phone: '9066442898', hasPbx: false, crm: 'available', outcome: 'fail-first' },
  ];

  const TARIFFS = [
    { id: 'start', name: 'Старт', hint: 'до 5 пользователей' },
    { id: 'business', name: 'Бизнес', hint: 'до 25 пользователей' },
    { id: 'pro', name: 'Профи', hint: 'до 100 пользователей' },
    { id: 'corporate', name: 'Корпоративный', hint: 'без ограничений' },
  ];

  function onlyDigits(value) {
    return String(value).replace(/\D/g, '');
  }

  function dropCountryPrefix(digits) {
    return digits.length >= 11 && (digits[0] === '7' || digits[0] === '8') ? digits.slice(1) : digits;
  }

  function normalizePhoneDigits(raw) {
    return dropCountryPrefix(onlyDigits(raw)).slice(0, 10);
  }

  function formatPhone(digits) {
    const d = String(digits);
    let out = d.slice(0, 3);
    if (d.length > 3) out += ' ' + d.slice(3, 6);
    if (d.length > 6) out += '-' + d.slice(6, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    return out;
  }

  function normalizeName(value) {
    return String(value)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/["'«»„“”]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const PHONE_QUERY = /^[\d\s()+-]+$/;

  function matchesQuery(client, query) {
    const q = String(query).trim();
    if (!q) return true;

    const name = normalizeName(q);
    if (name && normalizeName(client.name).includes(name)) return true;

    if (client.id.toLowerCase().includes(q.toLowerCase())) return true;

    if (PHONE_QUERY.test(q)) {
      const digits = dropCountryPrefix(onlyDigits(q));
      if (digits && client.phone.includes(digits)) return true;
    }
    return false;
  }

  function filterClients(clients, query) {
    return clients.filter((client) => matchesQuery(client, query));
  }

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validateForm(form) {
    return {
      tariff: TARIFFS.some((t) => t.id === form.tariff) ? '' : 'Выберите тарифный план',
      ban: /^\d{9}$/.test(form.ban) ? '' : 'Введите 9 цифр',
      phone: /^\d{10}$/.test(form.phone) ? '' : 'Введите номер полностью',
      email: EMAIL.test(String(form.email).trim()) ? '' : 'Проверьте адрес почты',
    };
  }

  function isFormValid(form) {
    const errors = validateForm(form);
    return Object.keys(errors).every((key) => !errors[key]);
  }

  function canConnect(client) {
    return !client.hasPbx && client.crm === 'available';
  }

  function canRetry(client) {
    return !client.hasPbx && client.crm === 'error';
  }

  function resolveOutcome(client) {
    return client.outcome === 'fail-first' && client.attempts < 2 ? 'error' : 'connected';
  }

  const api = {
    CLIENTS, TARIFFS,
    onlyDigits, normalizePhoneDigits, formatPhone,
    matchesQuery, filterClients,
    validateForm, isFormValid,
    canConnect, canRetry, resolveOutcome,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/logic.test.js`
Expected: `pass 15`, `fail 0`

- [ ] **Step 5: Commit**

```bash
git add logic.js tests/logic.test.js
git commit -m "feat: add client search, form validation and outcome logic"
```

---

### Task 2: Page shell, table, search, tabs

**Files:**
- Create: `index.html`, `styles.css`, `app.js`

**Interfaces:**
- Consumes: `window.Logic` from Task 1.
- Produces in `app.js` (all inside one IIFE, used by Tasks 3 and 4):
  - `state = { clients, query, drawerClientId, form, touched, selectOpen, selectActive }`; each client is a copy of a `Logic.CLIENTS` entry plus `attempts: 0`
  - `el(id) -> HTMLElement`, `escapeHtml(text) -> string`, `findClient(id) -> client | undefined`, `emptyForm() -> {tariff, ban, phone, email}`
  - `renderTable()`
  - `handleAction(action, id)`: click dispatcher for elements with `data-action`; Tasks 3 and 4 add cases
  - DOM ids for the panel (already in markup): `overlay`, `drawer`, `drawer-close`, `drawer-cancel`, `drawer-submit`, `connect-form`, `d-name`, `d-id`, `d-phone`, `tariff`, `tariff-trigger`, `tariff-value`, `tariff-list`, `f-ban`, `f-phone`, `f-email`, `e-tariff`, `e-ban`, `e-phone`, `e-email`, `toast`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Бэкофис.Контакт.ИИ</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="topbar__logo">Бэкофис.Контакт.ИИ</div>
    <nav class="tabs" role="tablist">
      <button type="button" class="tab is-active" role="tab" aria-selected="true" data-tab="clients">Список клиентов</button>
      <button type="button" class="tab" role="tab" aria-selected="false" data-tab="journal">Журнал действий</button>
    </nav>
    <div class="topbar__actions" aria-hidden="true">
      <span class="icon-btn icon-btn--plain">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>
      </span>
      <span class="icon-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>
      </span>
    </div>
  </header>

  <main class="page">
    <section data-panel="clients">
      <h1 class="page__title">Клиенты Контакт.АИ</h1>
      <div class="search">
        <svg class="search__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
        <input id="search" class="search__input" type="text" placeholder="Поиск по названию, номеру или ID" autocomplete="off" aria-label="Поиск клиентов">
        <button id="search-clear" class="search__clear" type="button" aria-label="Очистить поиск" hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="col-name">Название</th>
              <th class="col-phone">Основной номер</th>
              <th class="col-id">ID</th>
              <th class="col-pbx">Наличие ОАТС</th>
              <th>CRM S2</th>
            </tr>
          </thead>
          <tbody id="clients-body"></tbody>
        </table>
      </div>
    </section>

    <section data-panel="journal" hidden>
      <h1 class="page__title">Журнал действий</h1>
      <p class="placeholder">Раздел в разработке</p>
    </section>
  </main>

  <div id="overlay" class="overlay"></div>

  <aside id="drawer" class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-hidden="true">
    <div class="drawer__head">
      <h2 id="drawer-title" class="drawer__title">Подключение CRM S2</h2>
      <button id="drawer-close" class="drawer__close" type="button" aria-label="Закрыть">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>
      </button>
    </div>

    <div class="drawer__body">
      <dl class="info">
        <div class="info__item"><dt>Клиент</dt><dd id="d-name"></dd></div>
        <div class="info__item"><dt>ID</dt><dd id="d-id"></dd></div>
        <div class="info__item">
          <dt>
            Основной номер
            <span class="hint" tabindex="0" aria-describedby="phone-tip">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.75" r=".5" fill="currentColor"/></svg>
              <span id="phone-tip" class="hint__tip" role="tooltip">Номер, на который зарегистрирован клиент в Контакт.ИИ. Он будет использоваться для входа в CRM S2 по Mobile ID.</span>
            </span>
          </dt>
          <dd id="d-phone"></dd>
        </div>
      </dl>

      <form id="connect-form" class="form" novalidate>
        <div class="field-group">
          <div class="select" id="tariff">
            <button type="button" class="field select__trigger" id="tariff-trigger" aria-haspopup="listbox" aria-expanded="false">
              <span class="field__label">Тарифный план</span>
              <span class="select__value" id="tariff-value"></span>
              <svg class="select__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <ul class="select__list" id="tariff-list" role="listbox" hidden></ul>
          </div>
          <p class="field__error" id="e-tariff"></p>
        </div>

        <div class="field-group">
          <label class="field">
            <input class="field__input" id="f-ban" type="text" inputmode="numeric" autocomplete="off" placeholder=" ">
            <span class="field__label">BAN (балансовый счёт)</span>
          </label>
          <p class="field__error" id="e-ban"></p>
        </div>

        <div class="field-group">
          <label class="field">
            <input class="field__input" id="f-phone" type="text" inputmode="tel" autocomplete="off" placeholder=" ">
            <span class="field__label">Тарификационный номер</span>
          </label>
          <p class="field__error" id="e-phone"></p>
        </div>

        <div class="field-group">
          <label class="field">
            <input class="field__input" id="f-email" type="text" inputmode="email" autocomplete="off" placeholder=" ">
            <span class="field__label">Контактная почта</span>
          </label>
          <p class="field__error" id="e-email"></p>
        </div>
      </form>
    </div>

    <div class="drawer__foot">
      <button type="button" id="drawer-cancel" class="btn btn--outline">Отменить</button>
      <button type="submit" form="connect-form" id="drawer-submit" class="btn btn--primary" disabled>Подключить</button>
    </div>
  </aside>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

  <script src="logic.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `styles.css`**

```css
:root {
  --text: #1f2024;
  --muted: #6f7076;
  --logo: #5a5b61;
  --line: #d8d8dd;
  --field: #e9e9eb;
  --surface: #ffffff;
  --accent: #ffd12e;
  --accent-soft: #fff0b3;
  --green: #2aa84f;
  --blue: #1a6fe8;
  --red: #f4504a;
  --toast: #1f1f1f;
  --drawer-width: 320px;
}

*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

body {
  margin: 0;
  font-family: 'Golos Text', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
  font-size: 14px;
  line-height: 20px;
  color: var(--text);
  background: var(--surface);
}

button { font: inherit; color: inherit; }

/* Top bar */
.topbar {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid var(--line);
}
.topbar__logo { font-size: 24px; line-height: 32px; font-weight: 500; color: var(--logo); }
.topbar__actions { display: flex; align-items: center; gap: 16px; margin-left: auto; color: var(--muted); }

.tabs { display: flex; align-self: stretch; gap: 16px; margin-left: 32px; }
.tab {
  position: relative;
  padding: 0 16px;
  border: 0;
  background: none;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
}
.tab:hover { color: var(--text); }
.tab.is-active { color: var(--text); font-weight: 600; }
.tab.is-active::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 4px;
  border-radius: 4px 4px 0 0;
  background: var(--accent);
}

.icon-btn { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 8px; background: #f0f0f2; }
.icon-btn--plain { background: none; }

/* Page */
.page { padding: 32px 96px 96px; }
.page__title { margin: 0 0 24px; font-size: 32px; line-height: 44px; font-weight: 400; }
.placeholder { color: var(--muted); }

.search {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 760px;
  height: 48px;
  padding: 0 16px;
  margin-bottom: 24px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--field);
}
.search:focus-within { border-color: var(--text); }
.search__icon { flex: none; color: var(--muted); }
.search__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 16px;
  color: inherit;
}
.search__input::placeholder { color: var(--muted); }
.search__clear { display: grid; place-items: center; padding: 4px; border: 0; background: none; color: var(--muted); cursor: pointer; }
.search__clear:hover { color: var(--text); }

/* Table */
.table-wrap { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.table th, .table td { height: 53px; padding: 0 16px; text-align: left; vertical-align: middle; }
.table th { font-weight: 600; }
.table tbody tr { border-top: 1px solid var(--line); }
.table td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-name, .col-phone, .col-pbx { width: 173px; }
.col-id { width: 360px; }
.table__empty td { height: 120px; text-align: center; color: var(--muted); }
.table__empty .link { margin-left: 8px; }

.pbx { display: block; }
.crm { display: flex; align-items: center; gap: 40px; }

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  color: #fff;
}
.badge--green { background: var(--green); }
.badge--blue { background: var(--blue); }

.link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--blue);
  cursor: pointer;
}
.link:hover { text-decoration: underline; }

/* Drawer */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .45);
  opacity: 0;
  visibility: hidden;
  transition: opacity .2s, visibility .2s;
}
.overlay.is-open { opacity: 1; visibility: visible; }

.drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  width: var(--drawer-width);
  background: var(--surface);
  transform: translateX(100%);
  visibility: hidden;
  transition: transform .2s, visibility .2s;
}
.drawer.is-open { transform: none; visibility: visible; }
.drawer__head { display: flex; align-items: center; justify-content: space-between; padding: 24px 24px 16px; }
.drawer__title { margin: 0; font-size: 18px; line-height: 24px; font-weight: 600; }
.drawer__close { display: grid; place-items: center; padding: 2px; border: 0; background: none; color: var(--muted); cursor: pointer; }
.drawer__close:hover { color: var(--text); }
.drawer__body { flex: 1; padding: 0 24px 24px; overflow-y: auto; }
.drawer__foot { display: flex; gap: 16px; padding: 16px 24px 24px; border-top: 1px solid var(--line); }

.info { margin: 0 0 24px; padding-bottom: 24px; border-bottom: 1px solid var(--line); }
.info__item + .info__item { margin-top: 20px; }
.info dt { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.info dd { margin: 0; font-size: 16px; line-height: 22px; overflow-wrap: anywhere; }

.hint { position: relative; display: inline-grid; color: var(--muted); cursor: help; outline: 0; }
.hint__tip {
  position: absolute;
  top: calc(100% + 8px);
  right: -60px;
  z-index: 2;
  width: 240px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--toast);
  color: #fff;
  font-size: 13px;
  line-height: 18px;
  opacity: 0;
  visibility: hidden;
  transition: opacity .12s, visibility .12s;
}
.hint:hover .hint__tip, .hint:focus .hint__tip { opacity: 1; visibility: visible; }

/* Form */
.field-group { margin-bottom: 20px; }
.field {
  position: relative;
  display: block;
  width: 100%;
  height: 48px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--field);
  font-size: 16px;
}
.field:focus-within, .select__trigger:focus { border-color: var(--text); outline: 0; }
.field-group.has-error .field { border-color: var(--red); }
.field__input {
  width: 100%;
  height: 100%;
  padding: 18px 16px 4px;
  border: 0;
  border-radius: 8px;
  outline: 0;
  background: transparent;
  font: inherit;
  color: inherit;
}
.field__label {
  position: absolute;
  left: 16px;
  top: 13px;
  color: var(--muted);
  pointer-events: none;
  transform-origin: left top;
  transition: transform .12s;
}
.field__input:focus + .field__label,
.field__input:not(:placeholder-shown) + .field__label,
.select.is-open .field__label,
.select.is-filled .field__label { transform: translateY(-9px) scale(.75); }
.field__error { margin: 4px 16px 0; font-size: 12px; line-height: 16px; color: var(--red); }
.field__error:empty { display: none; }

.select { position: relative; }
.select__trigger { padding: 0; text-align: left; cursor: pointer; }
.select__value { position: absolute; left: 16px; right: 44px; top: 21px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.select__chevron { position: absolute; right: 16px; top: 13px; color: var(--muted); transition: transform .12s; }
.select.is-open .select__chevron { transform: rotate(180deg); }
.select__list {
  position: absolute;
  left: 0; right: 0;
  top: calc(100% + 4px);
  z-index: 3;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .12);
}
.select__option { display: flex; flex-direction: column; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
.select__option.is-active { background: var(--field); }
.select__option.is-selected .select__name { font-weight: 600; }
.select__name { font-size: 15px; }
.select__hint { font-size: 12px; line-height: 16px; color: var(--muted); }

.btn { flex: 1; height: 48px; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; }
.btn--outline { border: 1px solid var(--line); background: var(--surface); }
.btn--outline:hover { border-color: var(--muted); }
.btn--primary { border: 1px solid transparent; background: var(--accent); }
.btn--primary:disabled { background: var(--accent-soft); color: #a8a9ad; cursor: default; }

/* Toast */
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 10;
  width: 344px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--toast);
  color: #fff;
  transform: translate(-50%, 16px);
  opacity: 0;
  visibility: hidden;
  transition: opacity .2s, transform .2s, visibility .2s;
}
.toast.is-visible { transform: translate(-50%, 0); opacity: 1; visibility: visible; }
```

- [ ] **Step 3: Write `app.js`**

```js
(function () {
  'use strict';

  const L = window.Logic;

  function emptyForm() {
    return { tariff: '', ban: '', phone: '', email: '' };
  }

  const state = {
    clients: L.CLIENTS.map((client) => ({ ...client, attempts: 0 })),
    query: '',
    drawerClientId: null,
    form: emptyForm(),
    touched: {},
    selectOpen: false,
    selectActive: 0,
  };

  const ICONS = {
    check: '<svg class="pbx" width="24" height="24" viewBox="0 0 24 24" aria-label="Есть"><circle cx="12" cy="12" r="12" fill="#2aa84f"/><path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg class="pbx" width="24" height="24" viewBox="0 0 24 24" aria-label="Нет"><circle cx="12" cy="12" r="12" fill="#f4504a"/><path d="m8.5 8.5 7 7m0-7-7 7" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
    retry: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4h-4"/></svg>',
  };

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
  }

  function findClient(id) {
    return state.clients.find((client) => client.id === id);
  }

  // Table

  function crmCell(client) {
    const id = escapeHtml(client.id);
    switch (client.crm) {
      case 'available':
        return L.canConnect(client)
          ? `<button type="button" class="link" data-action="connect" data-id="${id}">Подключить</button>`
          : '—';
      case 'pending':
        return '<span class="badge badge--blue">Подключение</span>';
      case 'connected':
        return '<span class="badge badge--green">Подключено</span>';
      case 'error':
        return '<span class="badge badge--blue">Ошибка подключения</span>' + (L.canRetry(client)
          ? `<button type="button" class="link" data-action="retry" data-id="${id}">${ICONS.retry}Повторить</button>`
          : '');
      default:
        return '—';
    }
  }

  function renderTable() {
    const rows = L.filterClients(state.clients, state.query);
    const body = el('clients-body');
    if (!rows.length) {
      body.innerHTML = '<tr class="table__empty"><td colspan="5">Ничего не найдено'
        + '<button type="button" class="link" data-action="reset-search">Сбросить поиск</button></td></tr>';
      return;
    }
    body.innerHTML = rows.map((client) => `<tr>
      <td>${escapeHtml(client.name)}</td>
      <td>${escapeHtml(L.formatPhone(client.phone))}</td>
      <td>${escapeHtml(client.id)}</td>
      <td>${client.hasPbx ? ICONS.check : ICONS.cross}</td>
      <td><div class="crm">${crmCell(client)}</div></td>
    </tr>`).join('');
  }

  // Search

  function setQuery(value) {
    state.query = value;
    el('search-clear').hidden = !value;
    renderTable();
  }

  function resetSearch() {
    el('search').value = '';
    setQuery('');
    el('search').focus();
  }

  // Tabs

  function showTab(name) {
    document.querySelectorAll('.tab').forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
  }

  // Actions

  function handleAction(action, id) {
    switch (action) {
      case 'reset-search': resetSearch(); break;
    }
  }

  // Wiring

  el('search').addEventListener('input', (event) => setQuery(event.target.value));
  el('search-clear').addEventListener('click', resetSearch);

  document.querySelector('.tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (tab) showTab(tab.dataset.tab);
  });

  el('clients-body').addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (target) handleAction(target.dataset.action, target.dataset.id);
  });

  renderTable();
})();
```

- [ ] **Step 4: Verify in the browser**

Open `index.html`. Expected:
- Header, title, search field and table match the mockup; five rows; «Звезда» and «Вектор» show the «Подключить» link; «Корытце» shows `—`; «Ромашка» and «Коврики» show the green badge.
- Typing `звезда` leaves one row; `+7 906 644 28 98` leaves «Вектор»; `bb44` leaves «Корытце»; `zzz` shows «Ничего не найдено» with «Сбросить поиск», which restores five rows and clears the field. The clear cross appears only when the field is non-empty.
- «Журнал действий» shows «Раздел в разработке»; «Список клиентов» returns to the table with the query preserved.
- Browser console has no errors.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css app.js
git commit -m "feat: add page shell, clients table, search and tabs"
```

---

### Task 3: Connection panel and form

**Files:**
- Modify: `app.js` (add a panel section before `// Actions`; extend `handleAction`; extend wiring)

**Interfaces:**
- Consumes: `state`, `el`, `findClient`, `emptyForm`, `handleAction` from Task 2; `Logic.TARIFFS`, `validateForm`, `isFormValid`, `canConnect`, `onlyDigits`, `normalizePhoneDigits`, `formatPhone` from Task 1.
- Produces: `openDrawer(id)`, `closeDrawer()`, `renderForm()`, `touchAll()`. The form's `submit` event is left for Task 4.

- [ ] **Step 1: Add the panel code**

Insert before the `// Actions` comment in `app.js`:

```js
  // Connection panel

  const FIELDS = ['tariff', 'ban', 'phone', 'email'];

  function renderForm() {
    const errors = L.validateForm(state.form);
    FIELDS.forEach((key) => {
      const message = state.touched[key] ? errors[key] : '';
      const node = el('e-' + key);
      node.textContent = message;
      node.closest('.field-group').classList.toggle('has-error', Boolean(message));
    });
    el('drawer-submit').disabled = !L.isFormValid(state.form);
  }

  function touchAll() {
    FIELDS.forEach((key) => { state.touched[key] = true; });
    renderForm();
  }

  function renderSelect() {
    const selected = L.TARIFFS.find((tariff) => tariff.id === state.form.tariff);
    el('tariff-value').textContent = selected ? selected.name : '';
    el('tariff').classList.toggle('is-filled', Boolean(selected));
    el('tariff').classList.toggle('is-open', state.selectOpen);
    el('tariff-trigger').setAttribute('aria-expanded', String(state.selectOpen));
    const list = el('tariff-list');
    list.hidden = !state.selectOpen;
    list.innerHTML = L.TARIFFS.map((tariff, index) => {
      const isSelected = tariff.id === state.form.tariff;
      const classes = 'select__option'
        + (index === state.selectActive ? ' is-active' : '')
        + (isSelected ? ' is-selected' : '');
      return `<li class="${classes}" role="option" aria-selected="${isSelected}" data-id="${tariff.id}">`
        + `<span class="select__name">${escapeHtml(tariff.name)}</span>`
        + `<span class="select__hint">${escapeHtml(tariff.hint)}</span></li>`;
    }).join('');
  }

  function openSelect() {
    state.selectOpen = true;
    state.selectActive = Math.max(0, L.TARIFFS.findIndex((tariff) => tariff.id === state.form.tariff));
    renderSelect();
  }

  function closeSelect() {
    if (!state.selectOpen) return;
    state.selectOpen = false;
    state.touched.tariff = true;
    renderSelect();
    renderForm();
  }

  function chooseTariff(id) {
    state.form.tariff = id;
    closeSelect();
    el('tariff-trigger').focus();
  }

  function moveActive(step) {
    const count = L.TARIFFS.length;
    state.selectActive = (state.selectActive + step + count) % count;
    renderSelect();
  }

  function openDrawer(id) {
    const client = findClient(id);
    if (!client || !L.canConnect(client)) return;
    state.drawerClientId = id;
    state.form = emptyForm();
    state.touched = {};
    state.selectOpen = false;
    el('d-name').textContent = client.name;
    el('d-id').textContent = client.id;
    el('d-phone').textContent = L.formatPhone(client.phone);
    el('f-ban').value = '';
    el('f-phone').value = '';
    el('f-email').value = '';
    renderSelect();
    renderForm();
    el('overlay').classList.add('is-open');
    el('drawer').classList.add('is-open');
    el('drawer').setAttribute('aria-hidden', 'false');
    el('tariff-trigger').focus();
  }

  function closeDrawer() {
    state.drawerClientId = null;
    state.selectOpen = false;
    renderSelect();
    el('overlay').classList.remove('is-open');
    el('drawer').classList.remove('is-open');
    el('drawer').setAttribute('aria-hidden', 'true');
  }

  function bindInput(id, key, normalize, format) {
    const input = el(id);
    input.addEventListener('input', () => {
      state.form[key] = normalize(input.value);
      const shown = format(state.form[key]);
      if (input.value !== shown) input.value = shown;
      renderForm();
    });
    input.addEventListener('blur', () => {
      state.touched[key] = true;
      renderForm();
    });
  }
```

- [ ] **Step 2: Extend `handleAction`**

Replace the `handleAction` function with:

```js
  function handleAction(action, id) {
    switch (action) {
      case 'reset-search': resetSearch(); break;
      case 'connect': openDrawer(id); break;
    }
  }
```

- [ ] **Step 3: Add the wiring**

Insert before the final `renderTable();` call:

```js
  const same = (value) => value;
  bindInput('f-ban', 'ban', (value) => L.onlyDigits(value).slice(0, 9), same);
  bindInput('f-phone', 'phone', L.normalizePhoneDigits, L.formatPhone);
  bindInput('f-email', 'email', same, same);

  el('tariff-trigger').addEventListener('click', () => {
    if (state.selectOpen) closeSelect(); else openSelect();
  });

  el('tariff-trigger').addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!state.selectOpen) openSelect();
      else moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if ((event.key === 'Enter' || event.key === ' ') && state.selectOpen) {
      event.preventDefault();
      chooseTariff(L.TARIFFS[state.selectActive].id);
    }
  });

  el('tariff-list').addEventListener('click', (event) => {
    const option = event.target.closest('.select__option');
    if (option) chooseTariff(option.dataset.id);
  });

  document.addEventListener('click', (event) => {
    if (state.selectOpen && !event.target.closest('#tariff')) closeSelect();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (state.selectOpen) closeSelect();
    else if (state.drawerClientId) closeDrawer();
  });

  el('drawer-close').addEventListener('click', closeDrawer);
  el('drawer-cancel').addEventListener('click', closeDrawer);
  el('overlay').addEventListener('click', closeDrawer);
```

- [ ] **Step 4: Verify in the browser**

Reload `index.html`. Expected:
- «Подключить» at «Звезда» opens the panel with name, ID and `906 644-28-95`; page is dimmed; button «Подключить» is pale and disabled.
- Hovering `i` shows the tooltip with the Mobile ID sentence.
- Tariff list opens with four plans and their hints; arrows move the highlight, Enter selects, the label floats up; Esc with the list open closes only the list and shows «Выберите тарифный план» if nothing was chosen.
- BAN accepts digits only, stops at 9; leaving it with 5 digits shows «Введите 9 цифр» and a red border; completing it clears the error.
- Phone field formats while typing; pasting `+7 (906) 644-28-95` gives `906 644-28-95`.
- Email `abc` then blur shows «Проверьте адрес почты»; `a@b.ru` clears it.
- With four valid fields the button turns bright yellow.
- Review Focus 4: fill half the form with errors visible, close with the cross, open «Вектор»: form is empty, no errors, button disabled, client data is «Вектор»'s.
- Cross, «Отменить», overlay click and Esc each close the panel.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add CRM S2 connection panel with validated form"
```

---

### Task 4: Connection flow, toast, retry

**Files:**
- Modify: `app.js` (add a flow section before `// Actions`; extend `handleAction`; add submit wiring)

**Interfaces:**
- Consumes: `state`, `el`, `findClient`, `renderTable`, `closeDrawer`, `touchAll`, `handleAction`; `Logic.isFormValid`, `canConnect`, `canRetry`, `resolveOutcome`.
- Produces: `showToast(text)`, `startConnection(id, toastText)`.

- [ ] **Step 1: Add the flow code**

Insert before the `// Actions` comment:

```js
  // Connection flow

  const PENDING_MS = 3000;
  const TOAST_MS = 4000;
  const TOAST_SENT = 'Заявка на подключение CRM S2 успешно отправлена';
  const TOAST_RESENT = 'Заявка на повторное подключение CRM S2 успешно отправлена';
  let toastTimer = null;

  function showToast(text) {
    const toast = el('toast');
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), TOAST_MS);
  }

  function startConnection(id, toastText) {
    const client = findClient(id);
    if (!client) return;
    client.crm = 'pending';
    client.attempts += 1;
    renderTable();
    showToast(toastText);
    setTimeout(() => {
      client.crm = L.resolveOutcome(client);
      renderTable();
    }, PENDING_MS);
  }

  function submitForm() {
    if (!L.isFormValid(state.form)) {
      touchAll();
      return;
    }
    const client = findClient(state.drawerClientId);
    if (!client || !L.canConnect(client)) return;
    client.request = { ...state.form };
    closeDrawer();
    startConnection(client.id, TOAST_SENT);
  }

  function retryConnection(id) {
    const client = findClient(id);
    if (client && L.canRetry(client)) startConnection(id, TOAST_RESENT);
  }
```

- [ ] **Step 2: Extend `handleAction`**

Replace the `handleAction` function with:

```js
  function handleAction(action, id) {
    switch (action) {
      case 'reset-search': resetSearch(); break;
      case 'connect': openDrawer(id); break;
      case 'retry': retryConnection(id); break;
    }
  }
```

- [ ] **Step 3: Add the submit wiring**

Insert before the final `renderTable();` call:

```js
  el('connect-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitForm();
  });
```

- [ ] **Step 4: Verify in the browser**

Reload `index.html`. Expected:
- «Звезда»: fill the form, «Подключить». Panel closes, toast «Заявка на подключение CRM S2 успешно отправлена» for about 4 s, blue badge «Подключение», after about 3 s green «Подключено». No link remains.
- «Вектор»: same start, after about 3 s «Ошибка подключения» plus «Повторить». Click: toast «Заявка на повторное подключение CRM S2 успешно отправлена», «Подключение», then «Подключено».
- Pressing Enter inside a text field with a valid form submits; with an invalid form it shows all errors and keeps the panel open.
- Review Focus 5: reload, submit «Звезда», immediately type `ромашка` in search, wait 4 s, clear search: «Звезда» shows «Подключено».
- «Ромашка», «Корытце», «Коврики» never show a link.
- Console has no errors.

- [ ] **Step 5: Run unit tests and commit**

Run: `node --test tests/logic.test.js`
Expected: `pass 15`, `fail 0`

```bash
git add app.js
git commit -m "feat: add CRM S2 connection flow with toast and retry"
```
