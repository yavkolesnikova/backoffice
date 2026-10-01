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
