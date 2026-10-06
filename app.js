(() => {
  'use strict';

  const STORAGE_KEY = 'todo-app.v1';
  const FILTERS = {
    all: () => true,
    active: (todo) => !todo.completed,
    completed: (todo) => todo.completed,
  };

  const $ = (selector) => document.querySelector(selector);
  const els = {
    form: $('#new-todo-form'),
    title: $('#new-todo-title'),
    due: $('#new-todo-due'),
    main: $('#main'),
    toggleAll: $('#toggle-all'),
    list: $('#todo-list'),
    count: $('#todo-count'),
    clearCompleted: $('#clear-completed'),
    empty: $('#empty'),
    filterLinks: document.querySelectorAll('.filters a'),
  };

  let todos = load();
  let filter = 'all';
  let editingId = null;

  // ---- 永続化 ----

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // ストレージが使えない環境（プライベートモード等）ではメモリ上だけで動かす
    }
  }

  function commit() {
    save();
    render();
  }

  // ---- 操作 ----

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function addTodo(title, due) {
    todos.push({ id: newId(), title, due: due || null, completed: false, createdAt: Date.now() });
    commit();
  }

  function updateTodo(id, changes) {
    todos = todos.map((todo) => (todo.id === id ? { ...todo, ...changes } : todo));
    commit();
  }

  function removeTodo(id) {
    todos = todos.filter((todo) => todo.id !== id);
    commit();
  }

  // ---- 日付 ----

  function todayString() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDue(due) {
    const [, m, d] = due.split('-').map(Number);
    return `${m}/${d}`;
  }

  // ---- 描画 ----

  function render() {
    const today = todayString();
    const visible = todos.filter(FILTERS[filter]);
    const activeCount = todos.filter(FILTERS.active).length;
    const completedCount = todos.length - activeCount;

    els.list.replaceChildren(...visible.map((todo) => renderItem(todo, today)));

    els.main.hidden = todos.length === 0;
    els.empty.hidden = todos.length !== 0;
    els.toggleAll.checked = todos.length > 0 && activeCount === 0;
    els.count.textContent = `残り ${activeCount} 件`;
    els.clearCompleted.hidden = completedCount === 0;
    els.filterLinks.forEach((a) => a.classList.toggle('selected', a.dataset.filter === filter));

    const editInput = els.list.querySelector('.todo-edit');
    if (editInput) {
      editInput.focus();
      editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    }
  }

  function renderItem(todo, today) {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.completed ? ' completed' : '');
    li.dataset.id = todo.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'toggle';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', '完了');
    li.append(checkbox);

    if (todo.id === editingId) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'todo-edit';
      input.maxLength = 200;
      input.value = todo.title;
      li.append(input);
    } else {
      const title = document.createElement('span');
      title.className = 'todo-title';
      title.textContent = todo.title;
      li.append(title);
    }

    if (todo.due) {
      const due = document.createElement('span');
      due.className = 'due';
      if (!todo.completed && todo.due < today) due.classList.add('overdue');
      else if (!todo.completed && todo.due === today) due.classList.add('today');
      due.textContent = formatDue(todo.due);
      due.title = `期限: ${todo.due}`;
      li.append(due);
    }

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete';
    del.textContent = '×';
    del.setAttribute('aria-label', '削除');
    li.append(del);

    return li;
  }

  // ---- 編集 ----

  function startEdit(id) {
    editingId = id;
    render();
  }

  function finishEdit(input, { cancel = false } = {}) {
    const id = input.closest('.todo-item').dataset.id;
    if (editingId !== id) return; // Esc 後の blur などで二重に呼ばれた場合
    editingId = null;

    const title = input.value.trim();
    if (cancel) render();
    else if (title) updateTodo(id, { title });
    else removeTodo(id);
  }

  // ---- イベント ----

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.title.value.trim();
    if (!title) return;
    addTodo(title, els.due.value);
    els.title.value = '';
    els.due.value = '';
    els.title.focus();
  });

  els.toggleAll.addEventListener('change', () => {
    const completed = els.toggleAll.checked;
    todos = todos.map((todo) => ({ ...todo, completed }));
    commit();
  });

  els.clearCompleted.addEventListener('click', () => {
    todos = todos.filter(FILTERS.active);
    commit();
  });

  els.list.addEventListener('change', (e) => {
    if (!e.target.classList.contains('toggle')) return;
    const id = e.target.closest('.todo-item').dataset.id;
    updateTodo(id, { completed: e.target.checked });
  });

  els.list.addEventListener('click', (e) => {
    if (!e.target.classList.contains('delete')) return;
    removeTodo(e.target.closest('.todo-item').dataset.id);
  });

  els.list.addEventListener('dblclick', (e) => {
    if (!e.target.classList.contains('todo-title')) return;
    startEdit(e.target.closest('.todo-item').dataset.id);
  });

  els.list.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('todo-edit') || e.isComposing) return;
    if (e.key === 'Enter') finishEdit(e.target);
    else if (e.key === 'Escape') finishEdit(e.target, { cancel: true });
  });

  els.list.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('todo-edit')) finishEdit(e.target);
  });

  // 別タブでの変更を反映
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    todos = load();
    editingId = null;
    render();
  });

  // URL のハッシュ（#/active など）で絞り込み
  function applyHash() {
    const name = location.hash.replace(/^#\/?/, '');
    filter = Object.hasOwn(FILTERS, name) ? name : 'all';
    render();
  }

  window.addEventListener('hashchange', applyHash);
  applyHash();
})();
