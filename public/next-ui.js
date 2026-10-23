/* Native shortcut center. No network, user-content parsing, or telemetry. */
(() => {
  'use strict';
  const normalize = value => typeof value === 'string' ? value.normalize('NFKC').toLocaleLowerCase('zh-CN').trim().slice(0,120) : '';
  const matches = (label, query) => normalize(query).split(/\s+/).filter(Boolean).every(token => normalize(label).includes(token));
  const nextIndex = (index, step, length) => length > 0 ? ((index + step) % length + length) % length : -1;
  const action = value => ['music','appearance','search'].includes(value) ? value : null;
  globalThis.NextGarden = Object.freeze({ normalize, matches, nextIndex, action });
  if (typeof document === 'undefined') return;
  const initialize = (scope) => {
    const on = (target, ...args) => scope ? scope.listen(target, ...args) : target?.addEventListener(...args);
    const delay = (...args) => scope ? scope.timeout(...args) : setTimeout(...args);

  const dialog = document.querySelector('[data-next-dialog]');
  if (!dialog || dialog.dataset.initialized) return;
  dialog.dataset.initialized = 'true';
  scope?.cleanup(() => { delete dialog.dataset.initialized; });
  const query = dialog.querySelector('[data-next-query]');
  const items = [...dialog.querySelectorAll('[data-next-item]')];
  const empty = dialog.querySelector('[data-next-empty]');
  let index = -1, returnFocus = null, afterClose = null;
  const visible = () => items.filter(item => !item.hidden);
  const select = (value, focus = false) => {
    const rows = visible();
    index = rows.length ? Math.max(0,Math.min(rows.length - 1,value)) : -1;
    items.forEach(item => { item.dataset.selected = String(item === rows[index]); });
    if (focus && rows[index]) { rows[index].focus(); rows[index].scrollIntoView?.({block:'nearest'}); }
  };
  const filter = () => {
    items.forEach(item => { item.hidden = !matches(item.dataset.nextItem, query.value); });
    if (empty) empty.hidden = visible().length !== 0;
    select(0);
  };
  const show = () => {
    if (dialog.open || document.querySelector('dialog[open]')) return;
    returnFocus = document.activeElement;
    query.value = ''; filter(); dialog.showModal(); query.focus();
  };
  const run = name => {
    const selector = {music:'[data-music-player] [data-music-toggle]',appearance:'[data-appearance-open]',search:'[data-open-search]'}[action(name)];
    if (!selector) return;
    const target = document.querySelector(selector);
    if (target) {
      if (name==='music' && target.getAttribute('aria-expanded')==='true') { target.focus(); return; }
      target.click();
    }
    else {
      const toast = document.querySelector('#toast');
      if (toast) { toast.textContent='这个功能暂时不可用，请刷新页面后重试。'; toast.classList.add('visible'); delay(()=>toast.classList.remove('visible'),3000); }
    }
  };
  const close = callback => {
    if (!dialog.open) { callback?.(); return; }
    afterClose = callback || null; dialog.close();
  };
  on(dialog, 'close', () => {
    const callback = afterClose; afterClose = null;
    if (callback) callback(); else returnFocus?.focus();
  });
  document.querySelectorAll('[data-next-open]').forEach(button => on(button, 'click',show));
  on(dialog.querySelector('[data-next-close]'), 'click',()=>close());
  document.querySelectorAll('[data-next-action]').forEach(button => on(button, 'click',()=>close(()=>run(button.dataset.nextAction))));
  on(query, 'input',filter);
  on(dialog, 'click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();
  });
  on(dialog, 'keydown',event=>{
    if(event.isComposing)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp') {
      event.preventDefault();
      const rows=visible(), current=rows.indexOf(document.activeElement);
      const base=current>=0?current:event.key==='ArrowDown'?-1:0;
      select(nextIndex(base,event.key==='ArrowDown'?1:-1,rows.length),true);
    } else if(event.key==='Enter'&&event.target===query) {
      event.preventDefault(); visible()[index]?.click();
    }
  });
  on(document, 'keydown',event=>{
    if(event.isComposing||event.repeat||event.key.toLowerCase()!=='k')return;
    if(event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();dialog.open?close():show();}
    // The existing Ctrl+K search remains the primary content search shortcut.
    else if(dialog.open&&(event.ctrlKey||event.metaKey)){event.preventDefault();event.stopImmediatePropagation();close(()=>run('search'));}
  },true);
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('next-ui', initialize);
  else initialize();
})();
