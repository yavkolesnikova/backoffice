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

  function setHintOpen(open) {
    el('phone-hint').classList.toggle('is-open', open);
    el('phone-hint').setAttribute('aria-expanded', String(open));
  }

  function isHintOpen() {
    return el('phone-hint').classList.contains('is-open');
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
    setHintOpen(false);
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

  // Actions

  function handleAction(action, id) {
    switch (action) {
      case 'reset-search': resetSearch(); break;
      case 'connect': openDrawer(id); break;
      case 'retry': retryConnection(id); break;
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
    if (event.target.closest('#phone-hint')) setHintOpen(!isHintOpen());
    else setHintOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (isHintOpen()) setHintOpen(false);
    else if (state.selectOpen) closeSelect();
    else if (state.drawerClientId) closeDrawer();
  });

  el('drawer-close').addEventListener('click', closeDrawer);
  el('drawer-cancel').addEventListener('click', closeDrawer);
  el('overlay').addEventListener('click', closeDrawer);

  el('connect-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitForm();
  });

  renderTable();
})();
