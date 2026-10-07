(function () {
  'use strict';

  const J = window.JournalLogic;
  const ALL = { id: '', name: 'Все' };
  const DEFAULT_PRESET = 'last30';
  const PAGER_MIN_ROWS = 10;

  const now = Date.now();
  const presets = J.presets(now);

  const SELECTS = {
    action: { rootId: 'j-action', options: [ALL].concat(J.ACTIONS) },
  };

  const state = {
    // Only clients with the service already connected have an account
    events: J.buildEvents(now, window.Logic.CLIENTS
      .filter((client) => client.crm === 'connected')
      .map((client) => client.id)),
    from: 0,
    to: 0,
    presetId: null,
    action: '',
    query: '',
    page: 1,
    pages: 1,
    pageSize: 10,
    openSelect: null,
    picker: { open: false, tab: 'range', viewYear: 0, viewMonth: 0, start: null, end: null, timeFrom: '', timeTo: '', timeError: {} },
  };

  const ICONS = {
    prev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
    next: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    clock: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/></svg>',
  };

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
  }

  function nameOf(list, id) {
    return list.find((item) => item.id === id).name;
  }

  function applyPreset(id) {
    const preset = presets.find((item) => item.id === id);
    state.from = preset.from;
    state.to = preset.to;
    state.presetId = id;
  }

  // Table

  function renderPager(total, pg) {
    el('j-pager').hidden = total <= PAGER_MIN_ROWS;
    el('j-page-info').textContent = `${pg.start + 1}-${pg.end} из ${total}`;
    el('j-pager').querySelectorAll('[data-page]').forEach((button) => {
      const back = button.dataset.page === 'first' || button.dataset.page === 'prev';
      button.disabled = back ? pg.page === 1 : pg.page === pg.pages;
    });
  }

  // Any filter change returns to page 1; only the pager itself keeps the page
  function renderTable(keepPage) {
    const found = J.filterEvents(state.events, state);
    const pg = J.paginate(found.length, keepPage ? state.page : 1, state.pageSize);
    state.page = pg.page;
    state.pages = pg.pages;
    renderPager(found.length, pg);
    const rows = found.slice(pg.start, pg.end);
    const body = el('journal-body');
    if (!rows.length) {
      body.innerHTML = '<tr class="table__empty"><td colspan="4">Ничего не найдено'
        + '<button type="button" class="link" data-action="reset-filters">Сбросить фильтры</button></td></tr>';
      return;
    }
    body.innerHTML = rows.map((event) => `<tr>
      <td>${escapeHtml(event.employee)}</td>
      <td>${J.formatDateTime(event.time)}</td>
      <td>${escapeHtml(nameOf(J.ACTIONS, event.action))}</td>
      <td>${event.clientId ? escapeHtml(event.clientId) : '—'}</td>
    </tr>`).join('');
  }

  // Dropdown filters

  function renderSelect(name) {
    const config = SELECTS[name];
    const rootEl = el(config.rootId);
    const open = state.openSelect === name;
    rootEl.classList.toggle('is-open', open);
    rootEl.querySelector('.select__trigger').setAttribute('aria-expanded', String(open));
    rootEl.querySelector('.select__value').textContent = nameOf(config.options, state[name]);
    const list = rootEl.querySelector('.select__list');
    list.hidden = !open;
    list.innerHTML = config.options.map((option) => {
      const selected = option.id === state[name];
      return `<li class="select__option${selected ? ' is-selected is-active' : ''}" role="option" aria-selected="${selected}" data-id="${option.id}">`
        + `<span class="select__name">${escapeHtml(option.name)}</span></li>`;
    }).join('');
  }

  function renderFilters() {
    el('j-date-value').textContent = J.formatRange(state.from, state.to);
    Object.keys(SELECTS).forEach(renderSelect);
    el('j-search-clear').hidden = !state.query;
  }

  // Date range picker

  function dayClass(ms) {
    const p = state.picker;
    const end = p.end === null ? p.start : p.end;
    if (ms === p.start || ms === end) return 'day is-edge';
    if (p.start !== null && ms > p.start && ms < end) return 'day in-range';
    return 'day';
  }

  function monthHtml(year, month, side) {
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      .map((name) => `<span class="month__weekday">${name}</span>`).join('');
    const cells = J.monthGrid(year, month).map((day) => {
      if (!day) return '<span></span>';
      const ms = new Date(year, month, day).getTime();
      return `<button type="button" class="${dayClass(ms)}" data-day="${ms}">${day}</button>`;
    }).join('');
    const prev = side === 'left'
      ? `<button type="button" class="month__nav" data-nav="-1" aria-label="Предыдущий месяц">${ICONS.prev}</button>` : '<span></span>';
    const next = side === 'right'
      ? `<button type="button" class="month__nav" data-nav="1" aria-label="Следующий месяц">${ICONS.next}</button>` : '<span></span>';
    return `<div class="month">
      <div class="month__head">${prev}<span class="month__title">${J.MONTHS[month]} ${year}</span>${next}</div>
      <div class="month__grid">${weekdays}${cells}</div>
    </div>`;
  }

  function timeHtml(key, value) {
    const error = state.picker.timeError[key] ? ' has-error' : '';
    return `<label class="time${error}">${ICONS.clock}
      <input class="time__input" type="text" inputmode="numeric" maxlength="5" autocomplete="off"
        placeholder="Часы" aria-label="${key === 'from' ? 'Время начала' : 'Время окончания'}"
        data-time="${key}" value="${escapeHtml(value)}">
    </label>`;
  }

  function rangeHtml() {
    const p = state.picker;
    const right = new Date(p.viewYear, p.viewMonth + 1, 1);
    return `<div class="picker__months">
        ${monthHtml(p.viewYear, p.viewMonth, 'left')}
        ${monthHtml(right.getFullYear(), right.getMonth(), 'right')}
      </div>
      <div class="picker__times">${timeHtml('from', p.timeFrom)}${timeHtml('to', p.timeTo)}</div>
      <div class="picker__foot">
        <button type="button" class="btn btn--primary picker__save" data-save${p.start === null ? ' disabled' : ''}>Сохранить</button>
      </div>`;
  }

  function presetHtml() {
    return '<div class="presets">' + presets.map((preset) => `<button type="button"
        class="preset${preset.id === state.presetId ? ' is-active' : ''}" data-preset="${preset.id}">
        <span class="preset__name">${preset.name}</span>
        <span class="preset__range">${J.formatDate(preset.from)} — ${J.formatDate(preset.to)}</span>
      </button>`).join('') + '</div>';
  }

  function renderPicker() {
    const p = state.picker;
    const box = el('j-picker');
    box.hidden = !p.open;
    el('j-date').classList.toggle('is-open', p.open);
    el('j-date-trigger').setAttribute('aria-expanded', String(p.open));
    if (!p.open) {
      box.innerHTML = '';
      return;
    }
    const tab = (id, title) => `<button type="button" class="picker__tab${p.tab === id ? ' is-active' : ''}" data-tab="${id}">${title}</button>`;
    box.innerHTML = `<div class="picker__tabs">${tab('range', 'Интервал дат')}${tab('preset', 'Предустановленный')}</div>`
      + (p.tab === 'range' ? rangeHtml() : presetHtml());
  }

  function openPicker() {
    const p = state.picker;
    const timeFrom = J.formatTime(state.from);
    const timeTo = J.formatTime(state.to);
    const left = new Date(state.to);
    left.setDate(1);
    left.setMonth(left.getMonth() - 1);
    Object.assign(p, {
      open: true,
      tab: state.presetId ? 'preset' : 'range',
      viewYear: left.getFullYear(),
      viewMonth: left.getMonth(),
      start: J.startOfDay(state.from),
      end: J.startOfDay(state.to),
      timeFrom: timeFrom === '00:00' ? '' : timeFrom,
      timeTo: timeTo === '23:59' ? '' : timeTo,
      timeError: {},
    });
    state.openSelect = null;
    renderFilters();
    renderPicker();
  }

  function closePicker() {
    state.picker.open = false;
    renderPicker();
  }

  function pickDay(ms) {
    const p = state.picker;
    if (p.start === null || p.end !== null) {
      p.start = ms;
      p.end = null;
    } else if (ms < p.start) {
      p.end = p.start;
      p.start = ms;
    } else {
      p.end = ms;
    }
    renderPicker();
  }

  function shiftMonth(step) {
    const p = state.picker;
    const view = new Date(p.viewYear, p.viewMonth + step, 1);
    p.viewYear = view.getFullYear();
    p.viewMonth = view.getMonth();
    renderPicker();
  }

  function saveRange() {
    const p = state.picker;
    if (p.start === null) return;
    p.timeError = {
      from: Boolean(p.timeFrom) && !J.parseTime(p.timeFrom),
      to: Boolean(p.timeTo) && !J.parseTime(p.timeTo),
    };
    if (p.timeError.from || p.timeError.to) {
      renderPicker();
      return;
    }
    const from = J.withTime(p.start, p.timeFrom, 'start');
    const to = J.withTime(p.end === null ? p.start : p.end, p.timeTo, 'end');
    state.from = Math.min(from, to);
    state.to = Math.max(from, to);
    state.presetId = null;
    closePicker();
    renderFilters();
    renderTable();
  }

  function choosePreset(id) {
    applyPreset(id);
    closePicker();
    renderFilters();
    renderTable();
  }

  function resetFilters() {
    applyPreset(DEFAULT_PRESET);
    state.action = '';
    state.query = '';
    el('j-search').value = '';
    renderFilters();
    renderTable();
  }

  // Wiring

  el('j-date-trigger').addEventListener('click', () => {
    if (state.picker.open) closePicker(); else openPicker();
  });

  el('j-picker').addEventListener('click', (event) => {
    const target = event.target.closest('[data-tab], [data-nav], [data-day], [data-preset], [data-save]');
    if (!target) return;
    const data = target.dataset;
    if (data.tab) {
      state.picker.tab = data.tab;
      renderPicker();
    } else if (data.nav) shiftMonth(Number(data.nav));
    else if (data.day) pickDay(Number(data.day));
    else if (data.preset) choosePreset(data.preset);
    else saveRange();
  });

  // Time fields are updated in place: re-rendering the picker would drop focus
  el('j-picker').addEventListener('input', (event) => {
    const input = event.target.closest('[data-time]');
    if (!input) return;
    const key = input.dataset.time;
    input.value = J.maskTime(input.value);
    state.picker[key === 'from' ? 'timeFrom' : 'timeTo'] = input.value;
    state.picker.timeError[key] = false;
    input.closest('.time').classList.remove('has-error');
  });

  Object.keys(SELECTS).forEach((name) => {
    const rootEl = el(SELECTS[name].rootId);
    rootEl.querySelector('.select__trigger').addEventListener('click', () => {
      state.openSelect = state.openSelect === name ? null : name;
      if (state.picker.open) closePicker();
      renderFilters();
    });
    rootEl.querySelector('.select__list').addEventListener('click', (event) => {
      const option = event.target.closest('.select__option');
      if (!option) return;
      state[name] = option.dataset.id;
      state.openSelect = null;
      renderFilters();
      renderTable();
    });
  });

  el('j-search').addEventListener('input', (event) => {
    state.query = event.target.value;
    el('j-search-clear').hidden = !state.query;
    renderTable();
  });

  el('j-search-clear').addEventListener('click', () => {
    state.query = '';
    el('j-search').value = '';
    el('j-search-clear').hidden = true;
    renderTable();
    el('j-search').focus();
  });

  el('journal-body').addEventListener('click', (event) => {
    if (event.target.closest('[data-action="reset-filters"]')) resetFilters();
  });

  el('j-pager').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    const target = { first: 1, prev: state.page - 1, next: state.page + 1, last: state.pages }[button.dataset.page];
    state.page = target;
    renderTable(true);
  });

  el('j-page-size').addEventListener('change', (event) => {
    state.pageSize = Number(event.target.value);
    renderTable();
  });

  // composedPath keeps ancestors of nodes that a re-render has already detached
  document.addEventListener('click', (event) => {
    const path = event.composedPath();
    if (state.picker.open && !path.includes(el('j-date'))) closePicker();
    if (state.openSelect && !path.includes(el(SELECTS[state.openSelect].rootId))) {
      state.openSelect = null;
      renderFilters();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (state.picker.open) closePicker();
    if (state.openSelect) {
      state.openSelect = null;
      renderFilters();
    }
  });

  applyPreset(DEFAULT_PRESET);
  renderFilters();
  renderTable();
})();
