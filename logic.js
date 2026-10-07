(function (root) {
  'use strict';

  // users: people inside the client organisation; the first one owns the main number
  const CLIENTS = [
    { id: 'a81f3c52-7d0e-4b9a-8c16-5e2f9d1b4a70', name: 'ООО "Ромашка"', phone: '9035174208', hasPbx: true, crm: 'connected', outcome: null, users: [
      { id: 'd25b97cd-676e-4805-ad1e-ee24525eb1bd', name: 'Иванов Сергей Петрович', phone: '9035174208' },
      { id: '2fd343d4-fc7e-45ec-b357-45b1fd7727e9', name: 'Петрова Мария Игоревна', phone: '9167023418' },
      { id: 'e365a5a0-015c-421d-aac8-043971815562', name: 'Кузнецов Алексей Дмитриевич', phone: '9255810364' },
    ] },
    { id: '0c7de914-2b6a-4f83-9a51-d3e8b6f0c217', name: 'ООО "Корытце"', phone: '9054418830', hasPbx: true, crm: 'none', outcome: null, users: [
      { id: 'e0286bf6-c429-4050-b0c8-7dd0d141abc6', name: 'Смирнова Ольга Николаевна', phone: '9054418830' },
      { id: 'c7cdfcd1-0fee-4bdf-9a95-2f77716be691', name: 'Волков Дмитрий Андреевич', phone: '9852267149' },
    ] },
    { id: '5b9e2f6d-41c8-4d37-b0a2-8f61c3e7d954', name: 'ООО "Звезда"', phone: '9629053471', hasPbx: false, crm: 'available', outcome: 'success', users: [
      { id: '22f8fccf-d5e6-4cd1-ace3-a119eb80f4f7', name: 'Морозов Игорь Валентинович', phone: '9629053471' },
      { id: '9f96cb70-ccef-4ab1-875a-83c95a05d312', name: 'Сидорова Елена Сергеевна', phone: '9264418052' },
      { id: 'abe3e413-00a9-410a-9bef-bc734fe8801c', name: 'Фёдоров Павел Ильич', phone: '9037120586' },
      { id: 'ba8c705c-e98e-49f8-b004-cabded78ec6e', name: 'Лебедева Анастасия Олеговна', phone: '9150648823' },
    ] },
    { id: 'e3470ab8-96f1-4c25-8d7b-1a5c0f92e6b3', name: 'ООО "Коврики"', phone: '9091286650', hasPbx: false, crm: 'connected', outcome: null, users: [
      { id: 'adb2414b-0b0c-4c03-8841-095203fc6d32', name: 'Новиков Артём Романович', phone: '9091286650' },
    ] },
    { id: '72d6c1f9-0e58-43ab-b4c7-6f9a2e8d5013', name: 'ООО "Вектор"', phone: '9647703915', hasPbx: false, crm: 'available', outcome: 'fail-first', users: [
      { id: '658bf091-4af6-4019-a262-99d6233bac50', name: 'Егоров Константин Юрьевич', phone: '9647703915' },
      { id: '9af836f3-f66c-46fc-b296-5804fb96ed59', name: 'Павлова Ирина Александровна', phone: '9998470261' },
    ] },
    { id: '9f04b7e3-5a2d-4e61-a8c9-37d1f6b0e842', name: 'ИП Соколова А. В.', phone: '9037764120', hasPbx: true, crm: 'connected', outcome: null, users: [
      { id: '9c68d6a5-9506-4588-81c6-78f53c4e3b00', name: 'Соколова Анна Викторовна', phone: '9037764120' },
    ] },
    { id: '1d8a6e40-c3f7-4b92-95e0-b7248ac6f319', name: 'АО "Северный берег"', phone: '9605521347', hasPbx: false, crm: 'available', outcome: 'success', users: [
      { id: '7b899d86-1bd0-4508-99e7-289d7586023f', name: 'Григорьев Максим Олегович', phone: '9605521347' },
      { id: '351372d4-7ce1-43e0-bf99-dfa4eb8fa470', name: 'Козлова Татьяна Владимировна', phone: '9851137604' },
      { id: '21bdd7a6-ad6c-4ad6-972d-3771d06315e8', name: 'Иванов Олег Сергеевич', phone: '9269385510' },
    ] },
    { id: 'c65b2d97-f8e1-4a03-b6d4-0e9c7135a28f', name: 'ООО "Тёплый дом"', phone: '9683309172', hasPbx: true, crm: 'none', outcome: null, users: [
      { id: 'a65ea2a7-a373-42eb-bdf6-2708113278f0', name: 'Белова Наталья Евгеньевна', phone: '9683309172' },
      { id: 'fa291130-3ba3-4497-be45-013629464bbd', name: 'Орлов Никита Степанович', phone: '9167745093' },
    ] },
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

  // Words may come in any order: "ромашка ооо" finds 'ООО "Ромашка"'
  function nameWords(query) {
    return normalizeName(query).split(' ').filter(Boolean);
  }

  function phoneQueryDigits(query) {
    return PHONE_QUERY.test(query) ? dropCountryPrefix(onlyDigits(query)) : '';
  }

  // A client (organisation) is searched by name and id, its users by phone
  const CLIENT_FIELDS = ['name', 'id'];
  const USER_FIELDS = ['phone'];

  function fieldMatches(record, field, q) {
    if (field === 'name') {
      const words = nameWords(q);
      const name = normalizeName(record.name);
      return words.length > 0 && words.every((word) => name.includes(word));
    }
    if (field === 'id') return record.id.toLowerCase().includes(q.toLowerCase());
    const digits = phoneQueryDigits(q);
    return Boolean(digits) && record.phone.includes(digits);
  }

  function matchesQuery(record, query, fields) {
    const q = String(query).trim();
    if (!q) return true;
    return fields.some((field) => fieldMatches(record, field, q));
  }

  function matchedUsers(client, query) {
    if (!String(query).trim()) return [];
    return client.users.filter((user) => matchesQuery(user, query, USER_FIELDS)).map((user) => user.id);
  }

  function filterClients(clients, query) {
    return clients.filter((client) => matchesQuery(client, query, CLIENT_FIELDS) || matchedUsers(client, query).length > 0);
  }

  // Character ranges [start, end) to highlight in the displayed name, formatted phone and id
  function highlights(record, query, fields) {
    const q = String(query).trim();
    const result = { name: [], phone: [], id: [] };
    if (!q) return result;

    // Lowercasing and ё→е keep string length, so indexes map back to the original name
    if (fields.includes('name') && fieldMatches(record, 'name', q)) {
      const name = record.name.toLowerCase().replace(/ё/g, 'е');
      nameWords(q).forEach((word) => {
        const at = name.indexOf(word);
        if (at >= 0) result.name.push([at, at + word.length]);
      });
    }

    const idAt = fields.includes('id') ? record.id.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (idAt >= 0) result.id.push([idAt, idAt + q.length]);

    const digits = fields.includes('phone') ? phoneQueryDigits(q) : '';
    const digitAt = digits ? record.phone.indexOf(digits) : -1;
    if (digitAt >= 0) {
      // Map digit positions onto the formatted phone, which adds a space and dashes
      const positions = [];
      formatPhone(record.phone).split('').forEach((ch, index) => {
        if (/\d/.test(ch)) positions.push(index);
      });
      result.phone.push([positions[digitAt], positions[digitAt + digits.length - 1] + 1]);
    }
    return result;
  }

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const LOGIN_MAX = 255;

  function loginError(value) {
    const login = String(value).trim();
    if (!login) return 'Введите логин';
    return login.length > LOGIN_MAX ? `Не больше ${LOGIN_MAX} символов` : '';
  }

  function validateForm(form) {
    return {
      tariff: TARIFFS.some((t) => t.id === form.tariff) ? '' : 'Выберите тарифный план',
      ban: /^\d{9}$/.test(form.ban) ? '' : 'Введите 9 цифр',
      phone: /^\d{10}$/.test(form.phone) ? '' : 'Введите номер полностью',
      email: EMAIL.test(String(form.email).trim()) ? '' : 'Проверьте адрес почты',
      login: loginError(form.login),
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
    CLIENT_FIELDS, USER_FIELDS,
    matchesQuery, matchedUsers, filterClients, highlights,
    validateForm, isFormValid,
    canConnect, canRetry, resolveOutcome,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
