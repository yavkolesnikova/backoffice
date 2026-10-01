(function (root) {
  'use strict';

  const CLIENTS = [
    { id: 'a81f3c52-7d0e-4b9a-8c16-5e2f9d1b4a70', name: 'ООО "Ромашка"', phone: '9035174208', hasPbx: true, crm: 'connected', outcome: null },
    { id: '0c7de914-2b6a-4f83-9a51-d3e8b6f0c217', name: 'ООО "Корытце"', phone: '9054418830', hasPbx: true, crm: 'none', outcome: null },
    { id: '5b9e2f6d-41c8-4d37-b0a2-8f61c3e7d954', name: 'ООО "Звезда"', phone: '9629053471', hasPbx: false, crm: 'available', outcome: 'success' },
    { id: 'e3470ab8-96f1-4c25-8d7b-1a5c0f92e6b3', name: 'ООО "Коврики"', phone: '9091286650', hasPbx: false, crm: 'connected', outcome: null },
    { id: '72d6c1f9-0e58-43ab-b4c7-6f9a2e8d5013', name: 'ООО "Вектор"', phone: '9647703915', hasPbx: false, crm: 'available', outcome: 'fail-first' },
    { id: '9f04b7e3-5a2d-4e61-a8c9-37d1f6b0e842', name: 'ИП Соколова А. В.', phone: '9037764120', hasPbx: true, crm: 'connected', outcome: null },
    { id: '1d8a6e40-c3f7-4b92-95e0-b7248ac6f319', name: 'АО "Северный берег"', phone: '9605521347', hasPbx: false, crm: 'available', outcome: 'success' },
    { id: 'c65b2d97-f8e1-4a03-b6d4-0e9c7135a28f', name: 'ООО "Тёплый дом"', phone: '9683309172', hasPbx: true, crm: 'none', outcome: null },
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
