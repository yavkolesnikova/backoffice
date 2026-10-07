(function (root) {
  'use strict';

  const ACTIONS = [
    { id: 'create', name: 'Создание УЗ билайнСРМ', source: 'backoffice' },
    { id: 'login', name: 'Вход в кабинет билайнСРМ', source: 's2' },
  ];

  const SOURCES = [
    { id: 'backoffice', name: 'Бэкофис' },
    { id: 's2', name: 'билайнСРМ' },
  ];

  const EMPLOYEES = ['ivanov', 'petrov', 'sidorova', 'kuznetsov', 'smirnova', 'volkov', 'morozova'];

  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function startOfDay(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function endOfDay(ms) {
    const d = new Date(ms);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function addDays(ms, count) {
    const d = new Date(ms);
    d.setDate(d.getDate() + count);
    return d.getTime();
  }

  // Day of month is clamped: 31 March minus one month is 28/29 February
  function addMonths(ms, count) {
    const d = new Date(ms);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + count);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d.getTime();
  }

  function formatDate(ms) {
    const d = new Date(ms);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function formatTime(ms) {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatDateTime(ms) {
    return `${formatDate(ms)} ${formatTime(ms)}:${pad(new Date(ms).getSeconds())}`;
  }

  function formatRange(from, to) {
    return `${formatDate(from)} ${formatTime(from)} - ${formatDate(to)} ${formatTime(to)}`;
  }

  function presets(now) {
    const today = startOfDay(now);
    const end = endOfDay(now);
    const yesterday = addDays(today, -1);
    return [
      { id: 'today', name: 'Сегодня', from: today, to: end },
      { id: 'yesterday', name: 'Вчера', from: yesterday, to: endOfDay(yesterday) },
      { id: 'last7', name: 'Последние 7 дней', from: addDays(today, -6), to: end },
      { id: 'last30', name: 'Последние 30 дней', from: addDays(today, -29), to: end },
      { id: 'last3m', name: 'Последние 3 месяца', from: addMonths(today, -3), to: end },
      { id: 'half', name: 'Полгода', from: addMonths(today, -6), to: end },
      { id: 'year', name: 'Год', from: addMonths(today, -12), to: end },
    ];
  }

  // Deterministic mock events over the year before `now`, denser towards `now`.
  // Account creation refers to a client from `clientIds`; logins have no client.
  function buildEvents(now, clientIds, count) {
    const ids = clientIds || [];
    let seed = 20260921;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const yearMinutes = 365 * 24 * 60;
    const events = [];
    for (let i = 0; i < (count || 90); i += 1) {
      const r = rand();
      const minutesAgo = Math.floor(r * r * yearMinutes);
      const action = ACTIONS[rand() < 0.45 ? 0 : 1];
      const client = ids[Math.floor(rand() * ids.length)];
      events.push({
        id: i + 1,
        employee: EMPLOYEES[Math.floor(rand() * EMPLOYEES.length)],
        time: now - minutesAgo * 60000 - Math.floor(rand() * 60000),
        action: action.id,
        source: action.source,
        clientId: action.id === 'create' && client ? client : null,
      });
    }
    return events.sort((a, b) => b.time - a.time);
  }

  function filterEvents(events, filters) {
    const query = String(filters.query || '').trim().toLowerCase();
    return events.filter((event) => event.time >= filters.from
      && event.time <= filters.to
      && (!filters.action || event.action === filters.action)
      && (!filters.source || event.source === filters.source)
      && (!query || event.employee.toLowerCase().includes(query)));
  }

  // start/end are slice bounds; an out-of-range page is clamped
  function paginate(total, page, size) {
    const pages = Math.max(1, Math.ceil(total / size));
    const current = Math.min(Math.max(1, page), pages);
    const start = (current - 1) * size;
    return { page: current, pages, start, end: Math.min(start + size, total) };
  }

  // Monday-first month cells: leading nulls, then day numbers
  function monthGrid(year, month) {
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const cells = new Array(offset).fill(null);
    for (let day = 1; day <= days; day += 1) cells.push(day);
    return cells;
  }

  function maskTime(raw) {
    const digits = String(raw).replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
  }

  function parseTime(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value));
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    return h <= 23 && m <= 59 ? { h, m } : null;
  }

  // edge 'start' | 'end': an empty or invalid time falls back to the day's edge
  function withTime(dayMs, value, edge) {
    const time = parseTime(value);
    if (!time) return edge === 'end' ? endOfDay(dayMs) : startOfDay(dayMs);
    const d = new Date(dayMs);
    if (edge === 'end') d.setHours(time.h, time.m, 59, 999);
    else d.setHours(time.h, time.m, 0, 0);
    return d.getTime();
  }

  const api = {
    ACTIONS, SOURCES, EMPLOYEES, MONTHS,
    startOfDay, endOfDay, addDays, addMonths,
    formatDate, formatTime, formatDateTime, formatRange,
    presets, buildEvents, filterEvents, paginate,
    monthGrid, maskTime, parseTime, withTime,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JournalLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
