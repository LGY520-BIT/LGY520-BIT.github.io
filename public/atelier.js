// Deliberately browser-local: no fetch, tracking, AI upload, audio or notifications.
export const LIMITS = Object.freeze({ tasks: 100, taskLength: 200, noteLength: 20000, importBytes: 100000, minMinutes: 1, maxMinutes: 120 });
export const STORAGE_KEY = 'fieldnotes-atelier-v1';
const CIRCUMFERENCE = 2 * Math.PI * 98;
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value, allowed) => plainObject(value) && Object.keys(value).every(key => allowed.includes(key));
const validInteger = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

export function normalizeTaskText(value) {
  if (typeof value !== 'string') throw new Error('待办必须是文字。');
  const text = value.trim();
  if (!text || text.length > LIMITS.taskLength || /[\u0000-\u001f\u007f]/.test(text)) throw new Error('待办需为 1–200 个字符，不能包含控制字符。');
  return text;
}

export function validateTasks(value) {
  if (!Array.isArray(value) || value.length > LIMITS.tasks) throw new Error('最多保留 100 条待办。');
  const ids = new Set();
  return value.map(item => {
    if (!exactKeys(item, ['id', 'text', 'done', 'createdAt']) || Object.keys(item).length !== 4 || !validId(item.id) || ids.has(item.id) || typeof item.done !== 'boolean' || !validInteger(item.createdAt, 0, 8640000000000000)) throw new Error('待办数据格式不正确，或存在重复编号。');
    ids.add(item.id);
    return { id: item.id, text: normalizeTaskText(item.text), done: item.done, createdAt: item.createdAt };
  });
}

export function parseTaskImport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > LIMITS.importBytes) throw new Error('文件不能超过 100 KB。');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('这不是有效的 JSON 文件。'); }
  if (!exactKeys(data, ['version', 'type', 'todos']) || Object.keys(data).length !== 3 || data.version !== 1 || data.type !== 'fieldnotes-atelier-todos') throw new Error('请选择从本工坊导出的待办 JSON。');
  return validateTasks(data.todos);
}

export function exportTasks(tasks) {
  return JSON.stringify({ version: 1, type: 'fieldnotes-atelier-todos', todos: validateTasks(tasks) }, null, 2);
}

export function validateNote(value) {
  if (typeof value !== 'string' || value.length > LIMITS.noteLength || value.includes('\u0000')) throw new Error('便签最多 20,000 个字符，且不能包含空字符。');
  return value;
}

export function createTimer(minutes = 25) {
  if (!validInteger(minutes, LIMITS.minMinutes, LIMITS.maxMinutes)) throw new Error('时长应为 1–120 的整数分钟。');
  return { durationMinutes: minutes, remainingMs: minutes * 60000, endsAt: null, sessions: 0 };
}

export function validateTimer(value) {
  if (!exactKeys(value, ['durationMinutes', 'remainingMs', 'endsAt', 'sessions']) || Object.keys(value).length !== 4 || !validInteger(value.durationMinutes, 1, 120) || !validInteger(value.remainingMs, 0, value.durationMinutes * 60000) || !(value.endsAt === null || validInteger(value.endsAt, 0, 8640000000000000)) || !validInteger(value.sessions, 0, 1000000)) throw new Error('计时记录不正确。');
  return { durationMinutes: value.durationMinutes, remainingMs: value.remainingMs, endsAt: value.endsAt, sessions: value.sessions };
}

export function timerRemaining(timer, now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error('无效的当前时间。');
  return Math.max(0, Math.min(timer.durationMinutes * 60000, timer.endsAt === null ? timer.remainingMs : timer.endsAt - now));
}

export function tickTimer(timer, now = Date.now()) {
  const remainingMs = Math.round(timerRemaining(timer, now));
  const completed = timer.endsAt !== null && remainingMs === 0;
  return { timer: { ...timer, remainingMs, endsAt: completed ? null : timer.endsAt, sessions: Math.min(1000000, timer.sessions + (completed ? 1 : 0)) }, completed };
}

export function toggleTimer(timer, now = Date.now()) {
  const current = tickTimer(timer, now).timer;
  if (timer.endsAt !== null && current.remainingMs > 0) return { ...current, endsAt: null };
  const remainingMs = current.remainingMs || current.durationMinutes * 60000;
  return { ...current, remainingMs, endsAt: now + remainingMs };
}

export function resetTimer(timer, minutes = timer.durationMinutes) {
  return { ...createTimer(minutes), sessions: timer.sessions };
}

export function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function defaultState() { return { version: 1, todos: [], note: '', timer: createTimer() }; }
export function parseSavedState(text) {
  if (text === null) return defaultState();
  const data = JSON.parse(text);
  if (!exactKeys(data, ['version', 'todos', 'note', 'timer']) || Object.keys(data).length !== 4 || data.version !== 1) throw new Error('本地工坊记录版本不正确。');
  return { version: 1, todos: validateTasks(data.todos), note: validateNote(data.note), timer: validateTimer(data.timer) };
}

export function noteMarkdown(note) {
  return `# 灵感便签\n\n${validateNote(note)}${note.endsWith('\n') ? '' : '\n'}`;
}

export function initAtelier(root) {
  let disposed = false;
  const objectUrls = new Set(), downloadTimers = new Set();
  const $ = selector => root.querySelector(selector);
  const storageStatus = $('[data-storage-status]');
  let state = defaultState(), storageAvailable = true, filter = 'all', pendingConfirm = null;
  try { state = parseSavedState(localStorage.getItem(STORAGE_KEY)); }
  catch { storageAvailable = false; storageStatus.textContent = '无法读取本地记录，已开启临时工作区。请先导出重要内容；不会覆盖原有记录。'; }
  const persist = () => {
    if (!storageAvailable) return false;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch { storageAvailable = false; storageStatus.textContent = '浏览器存储不可用或已满。当前内容暂留在页面中，请导出备份，不要刷新。'; return false; }
  };
  const message = text => { $('[data-todo-status]').textContent = text; };
  const download = (text, filename, type) => {
    const url = URL.createObjectURL(new Blob([text], { type })); objectUrls.add(url);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); objectUrls.delete(url); downloadTimers.delete(timer); }, 1000); downloadTimers.add(timer);
  };
  const dialog = $('[data-atelier-dialog]');
  function confirmAction(title, description, action) {
    $('[data-dialog-title]').textContent = title;
    $('[data-dialog-description]').textContent = description;
    pendingConfirm = action;
    dialog.showModal();
    $('[data-dialog-cancel]').focus();
  }
  $('[data-dialog-cancel]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { pendingConfirm = null; });
  $('[data-dialog-confirm]').addEventListener('click', () => { const action = pendingConfirm; pendingConfirm = null; dialog.close(); action?.(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });

  function renderTasks() {
    const list = $('[data-todo-list]'); list.replaceChildren();
    const shown = state.todos.filter(task => filter === 'all' || (filter === 'done' ? task.done : !task.done));
    const complete = state.todos.filter(task => task.done).length;
    $('[data-todo-count]').textContent = `${complete} / ${state.todos.length}`;
    $('[data-todo-clear]').disabled = complete === 0;
    $('[data-todo-empty]').hidden = shown.length !== 0;
    const empty = $('[data-todo-empty]');
    empty.querySelector('h3').textContent = state.todos.length ? (filter === 'done' ? '还没有完成的事项。' : '这一栏已经清空了。') : '先从一件小事开始。';
    empty.querySelector('p').textContent = state.todos.length ? '每一个小小的进展，都值得记下来。' : '写下来，就已经离完成近了一点。';
    for (const task of shown) {
      const item = document.createElement('li'); item.className = 'atelier-task-item'; item.dataset.done = String(task.done);
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'atelier-task-check'; checkbox.checked = task.done; checkbox.id = `atelier-task-${task.id}`; checkbox.setAttribute('aria-label', `标记${task.done ? '未完成' : '完成'}：${task.text}`);
      const label = document.createElement('label'); label.className = 'atelier-task-text'; label.htmlFor = checkbox.id; label.textContent = task.text;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'atelier-task-delete'; remove.textContent = '×'; remove.setAttribute('aria-label', `删除待办：${task.text}`);
      checkbox.addEventListener('change', () => { const next = state.todos.find(value => value.id === task.id); if (next) next.done = checkbox.checked; persist(); renderTasks(); message(checkbox.checked ? '又完成了一件小事。' : '已移回待完成。'); ($(`#atelier-task-${task.id}`) || $('[data-todo-input]')).focus(); });
      remove.addEventListener('click', () => { state.todos = state.todos.filter(value => value.id !== task.id); persist(); renderTasks(); message('已删除这条待办。'); $('[data-todo-input]').focus(); });
      item.append(checkbox, label, remove); list.append(item);
    }
  }
  $('[data-todo-form]').addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (state.todos.length >= LIMITS.tasks) throw new Error('已达到 100 条上限，请先导出或清理已完成事项。');
      const input = $('[data-todo-input]'), text = normalizeTaskText(input.value);
      const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      state.todos.push({ id, text, done: false, createdAt: Date.now() }); input.value = ''; persist(); renderTasks(); message('已记下一件小事。'); input.focus();
    } catch (error) { message(error.message); }
  });
  root.querySelectorAll('[data-todo-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.todoFilter;
    root.querySelectorAll('[data-todo-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); renderTasks();
  }));
  $('[data-todo-export]').addEventListener('click', () => { download(exportTasks(state.todos), '未完-待办备份.json', 'application/json;charset=utf-8'); message(`已导出 ${state.todos.length} 条待办。`); });
  $('[data-todo-import]').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > LIMITS.importBytes) throw new Error('文件不能超过 100 KB。');
      const text = await file.text(); if (disposed) return;
      const imported = parseTaskImport(text);
      confirmAction('用备份替换当前待办？', `已读取 ${imported.length} 条有效待办。确认后将替换当前 ${state.todos.length} 条待办；便签与计时不受影响。建议先导出当前记录。`, () => {
        state.todos = imported; filter = 'all'; root.querySelectorAll('[data-todo-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.todoFilter === 'all'))); persist(); renderTasks(); message(`已导入 ${imported.length} 条待办。`);
      });
    } catch (error) { message(error.message); }
  });
  $('[data-todo-clear]').addEventListener('click', () => {
    const count = state.todos.filter(task => task.done).length;
    if (count) confirmAction('收好这些已完成的小事？', `将清理 ${count} 条已完成事项，待完成事项不会改变。此操作不能撤销，可以先导出备份。`, () => { state.todos = state.todos.filter(task => !task.done); persist(); renderTasks(); message(`已清理 ${count} 条已完成事项。`); });
  });
  const note = $('[data-note-input]'); note.value = state.note;
  function noteCount() { $('[data-note-count]').textContent = `${note.value.length.toLocaleString('zh-CN')} / 20,000 字符`; }
  note.addEventListener('input', () => {
    try { state.note = validateNote(note.value); const saved = persist(); $('[data-note-saved]').textContent = saved ? `已保存 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '暂未保存，请下载备份'; }
    catch (error) { $('[data-note-saved]').textContent = error.message; }
    noteCount();
  });
  $('[data-note-download]').addEventListener('click', () => { download(noteMarkdown(note.value), '未完-灵感便签.md', 'text/markdown;charset=utf-8'); $('[data-note-saved]').textContent = '已下载 Markdown 副本'; });

  const timerDisplay = $('[data-timer-display]'), timerLabel = $('[data-timer-label]'), timerStatus = $('[data-timer-status]');
  function drawTimer() {
    const before = state.timer, update = tickTimer(before); state.timer = update.timer;
    if (update.completed) { persist(); timerStatus.textContent = '这一小段时间完成了。伸个懒腰，再决定下一步吧。'; }
    timerDisplay.textContent = formatTime(state.timer.remainingMs);
    timerLabel.textContent = state.timer.endsAt !== null ? '专注进行中' : (state.timer.remainingMs === 0 ? '这一段已完成' : state.timer.remainingMs < state.timer.durationMinutes * 60000 ? '已暂停，慢慢来' : '准备好就出发');
    $('[data-timer-toggle-label]').textContent = state.timer.endsAt !== null ? '暂停一下' : (state.timer.remainingMs === 0 ? '再开始一轮' : state.timer.remainingMs < state.timer.durationMinutes * 60000 ? '继续专注' : '开始专注');
    $('[data-timer-sessions]').textContent = String(state.timer.sessions);
    $('[data-timer-ring]').style.strokeDashoffset = String(CIRCUMFERENCE * (1 - state.timer.remainingMs / (state.timer.durationMinutes * 60000)));
    const durationInput = $('[data-timer-duration]');
    if (document.activeElement !== durationInput) durationInput.value = String(state.timer.durationMinutes);
    durationInput.disabled = state.timer.endsAt !== null;
    root.querySelectorAll('[data-timer-preset]').forEach(button => { button.disabled = state.timer.endsAt !== null; button.setAttribute('aria-pressed', String(Number(button.dataset.timerPreset) === state.timer.durationMinutes)); });
  }
  $('[data-timer-toggle]').addEventListener('click', () => {
    state.timer = toggleTimer(state.timer); persist(); drawTimer();
    timerStatus.textContent = state.timer.endsAt !== null ? '后台使用结束时间校准；不会播放声音或发送通知。' : '已经暂停。接下来的一小步，由你决定。';
  });
  $('[data-timer-reset]').addEventListener('click', () => { state.timer = resetTimer(state.timer); persist(); drawTimer(); timerStatus.textContent = '重新留出一段完整的时间。'; });
  function setDuration(minutes) {
    if (state.timer.endsAt !== null) return;
    try { state.timer = resetTimer(state.timer, minutes); persist(); drawTimer(); timerStatus.textContent = `已设为 ${minutes} 分钟，不会自动开始。`; }
    catch (error) { timerStatus.textContent = error.message; $('[data-timer-duration]').value = String(state.timer.durationMinutes); }
  }
  root.querySelectorAll('[data-timer-preset]').forEach(button => button.addEventListener('click', () => setDuration(Number(button.dataset.timerPreset))));
  $('[data-timer-duration]').addEventListener('change', event => setDuration(Number(event.target.value)));
  // The interval only redraws: the remaining time always derives from endsAt.
  const interval = setInterval(drawTimer, 500);
  const onStorage = event => { if (event.key === STORAGE_KEY) storageStatus.textContent = '另一个标签页修改了工坊记录。请先导出当前内容，避免多标签页互相覆盖。'; };
  const beforeRoute = event => { if (!persist() && !window.confirm('记录尚未保存。请先导出备份；确定仍要离开吗？')) event.preventDefault(); };
  document.addEventListener('visibilitychange', drawTimer);
  document.addEventListener('astro:before-preparation', beforeRoute);
  window.addEventListener('pagehide', persist);
  window.addEventListener('storage', onStorage);
  renderTasks(); noteCount(); drawTimer();
  const dispose = () => {
    if (disposed) return;
    disposed = true; persist(); pendingConfirm = null; clearInterval(interval);
    document.removeEventListener('visibilitychange', drawTimer);
    document.removeEventListener('astro:before-preparation', beforeRoute);
    window.removeEventListener('pagehide', persist); window.removeEventListener('storage', onStorage);
    downloadTimers.forEach(timer => clearTimeout(timer)); objectUrls.forEach(url => URL.revokeObjectURL(url));
    downloadTimers.clear(); objectUrls.clear(); if (dialog.open) dialog.close();
  };
  return { getState: () => structuredClone(state), dispose };
}

if (typeof document !== 'undefined') {
  const initialize = () => {
    const root = document.querySelector('[data-atelier]');
    return root ? initAtelier(root).dispose : undefined;
  };
  if (window.FieldnotesRoute) window.FieldnotesRoute.run('atelier', initialize);
  else initialize();
}
