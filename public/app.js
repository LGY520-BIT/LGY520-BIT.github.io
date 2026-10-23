(() => {
  const initialize = (scope) => {
    const on = (target, ...args) => scope ? scope.listen(target, ...args) : target?.addEventListener(...args);
    const delay = (...args) => scope ? scope.timeout(...args) : setTimeout(...args);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toast = (text) => {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(window.fieldnotesToast);
    window.fieldnotesToast = delay(() => el.classList.remove('visible'), 2600);
  };
  const syncThemeChrome = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    $('.theme-toggle')?.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
    $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171923' : '#fffaf2');
    $$('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === (dark ? 'dark' : 'light'))));
  };
  syncThemeChrome();
  const chooseTheme = (theme) => {
    if (!['dark', 'light'].includes(theme)) return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('fieldnotes-theme', theme); } catch {}
    syncThemeChrome();
  };
  $$('[data-theme-choice]').forEach(button => on(button, 'click', () => chooseTheme(button.dataset.themeChoice)));
  on($('.theme-toggle'), 'click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    chooseTheme(theme);
  });
  on($('.menu-toggle'), 'click', () => {
    const open = $('#main-nav').classList.toggle('open');
    $('.menu-toggle').setAttribute('aria-expanded', String(open));
    $('.menu-toggle').setAttribute('aria-label', open ? '收起导航' : '展开导航');
  });
  on(document, 'keydown', e => {
    if (e.key === 'Escape' && $('#main-nav')?.classList.contains('open')) {
      $('#main-nav').classList.remove('open');
      $('.menu-toggle').setAttribute('aria-expanded', 'false');
      $('.menu-toggle').setAttribute('aria-label', '展开导航');
    }
  });
  const filters = $$('[data-filter]');
  if (filters.length) {
    const items = $$('.post-item');
    const params = new URLSearchParams(location.search);
    let category = params.get('category') || 'all';
    let tag = params.get('tag');
    if (!filters.some(b => b.dataset.filter === category)) category = 'all';
    const apply = () => {
      let count = 0;
      for (const item of items) {
        const tags = JSON.parse(item.dataset.tags || '[]');
        const visible = (category === 'all' || item.dataset.category === category) && (!tag || tags.includes(tag));
        item.hidden = !visible;
        if (visible) count++;
      }
      for (const button of filters) {
        const active = button.dataset.filter === category;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      }
      if ($('#post-count')) $('#post-count').textContent = String(count);
      if ($('.empty-state')) $('.empty-state').hidden = count !== 0;
      if ($('#active-tag')) {
        const el = $('#active-tag');
        el.replaceChildren();
        el.hidden = !tag;
        if (tag) {
          const button = document.createElement('button');
          button.className = 'active-tag';
          button.textContent = '# ' + tag + ' ×';
          button.setAttribute('aria-label', '清除标签筛选：' + tag);
          on(button, 'click', () => { tag = null; updateUrl(); apply(); });
          el.append(button);
        }
      }
    };
    const updateUrl = () => {
      if (!location.pathname.startsWith('/archive')) return;
      const next = new URL(location.href);
      next.search = '';
      if (category !== 'all') next.searchParams.set('category', category);
      if (tag) next.searchParams.set('tag', tag);
      history.replaceState(null, '', next);
    };
    filters.forEach(button => on(button, 'click', () => { category = button.dataset.filter; tag = null; updateUrl(); apply(); }));
    apply();
  }
  const dialog = $('#search-dialog');
  const input = $('#search-input');
  const results = $('#search-results');
  const categoryInput = $('#search-category');
  const sortInput = $('#search-sort');
  const searchStatus = $('#search-status');
  const clearSearch = $('[data-search-clear]');
  const moreSearch = $('[data-search-more]');
  const INDEX_LIMIT = 4 * 1024 * 1024;
  let searchSeq = 0, debounce = 0, composing = false, alive = true;
  let utilitiesPromise, indexPromise, preparedIndex, indexController, returnFocus;
  let found = [], links = [], selected = -1, shown = 12, resultQuery = '';
  const activeSearch = () => alive && scope?.active !== false && dialog?.isConnected !== false && results?.isConnected !== false;
  const currentSearch = seq => activeSearch() && dialog?.open && seq === searchSeq;
  const announce = text => { if (searchStatus) searchStatus.textContent = text; };
  const busySearch = busy => results?.setAttribute('aria-busy', String(busy));
  const invalidateSearch = () => { ++searchSeq; clearTimeout(debounce); debounce = 0; };
  const abortIndex = () => { const controller = indexController; indexController = null; indexPromise = null; controller?.abort(); };
  scope?.cleanup(() => {
    alive = false; invalidateSearch(); abortIndex(); clearTimeout(window.fieldnotesToast);
  });
  const hint = text => {
    if (!results) return;
    const p = document.createElement('p'); p.className = 'search-hint'; p.textContent = text;
    results.replaceChildren(p); found = []; links = []; selected = -1;
    if (moreSearch) moreSearch.hidden = true;
  };
  const syncClear = () => { if (clearSearch) clearSearch.hidden = !input?.value; };
  const selectResult = (index, focus = false) => {
    selected = links.length ? Math.max(0, Math.min(links.length - 1, index)) : -1;
    links.forEach((link, i) => { link.dataset.searchSelected = String(i === selected); });
    if (focus && links[selected]) { links[selected].focus(); links[selected].scrollIntoView?.({ block: 'nearest' }); }
  };
  const openSearch = () => {
    if (!dialog || !input || !results || !activeSearch()) return false;
    const other = $('dialog[open]');
    if (!dialog.open && other && other !== dialog) return false;
    const reopening = !dialog.open;
    if (reopening) { returnFocus = document.activeElement; dialog.showModal(); }
    input.focus(); syncClear();
    if (reopening && (input.value.trim() || categoryInput?.value && categoryInput.value !== 'all')) scheduleSearch(true);
    return true;
  };
  $$('[data-open-search]').forEach(button => on(button, 'click', openSearch));
  on(document, 'keydown', event => {
    if (!event.isComposing && !event.repeat && !event.altKey && !event.shiftKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      if (openSearch()) event.preventDefault();
    }
  });
  on($('[data-close-search]'), 'click', () => dialog?.close());
  on(dialog, 'cancel', event => { if (composing || event.isComposing) event.preventDefault(); });
  on(dialog, 'close', () => {
    composing = false; invalidateSearch(); abortIndex(); busySearch(false); announce('');
    if (activeSearch() && returnFocus?.isConnected !== false && !$('dialog[open]')) returnFocus?.focus();
    returnFocus = null;
  });
  on(dialog, 'click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  const getSearchUtilities = async () => {
    if (!utilitiesPromise) utilitiesPromise = import('/search-utils.mjs');
    try { return await utilitiesPromise; } catch (error) { utilitiesPromise = null; throw error; }
  };
  const readPublicIndex = async (response, signal) => {
    if (!response.ok) throw Error('index unavailable');
    const type = response.headers?.get?.('content-type');
    if (type && !type.toLowerCase().includes('application/json')) throw Error('unexpected index type');
    const length = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(length) && length > INDEX_LIMIT) throw Error('index too large');
    if (response.body?.getReader) {
      const reader = response.body.getReader(), decoder = new TextDecoder(); let bytes = 0, text = '';
      const cancel = () => { void reader.cancel().catch(() => {}); };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > INDEX_LIMIT) { await reader.cancel(); throw Error('index too large'); }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        return JSON.parse(text);
      } finally { signal.removeEventListener('abort', cancel); reader.releaseLock?.(); }
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > INDEX_LIMIT) throw Error('index too large');
    return JSON.parse(text);
  };
  const getPublicIndex = async api => {
    if (preparedIndex) return preparedIndex;
    if (indexPromise) return indexPromise;
    const controller = new AbortController(); indexController = controller;
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = () => reject(Error('index cancelled')); controller.signal.addEventListener('abort', rejectAbort, { once: true }); });
    const timer = delay(() => controller.abort(), 8000);
    const pending = Promise.race([
      (async () => {
        const response = await fetch('/search-index.json', { signal: controller.signal, credentials: 'same-origin', redirect: 'error', cache: 'no-cache' });
        const raw = await readPublicIndex(response, controller.signal);
        return api.prepareIndex(raw);
      })(), aborted
    ]);
    indexPromise = pending;
    try {
      const value = await pending;
      if (!activeSearch() || controller.signal.aborted) throw Error('index cancelled');
      preparedIndex = value; return value;
    } finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', rejectAbort);
      if (indexPromise === pending) indexPromise = null;
      if (indexController === controller) indexController = null;
    }
  };
  const highlighted = (node, text, api) => {
    for (const part of api.highlightSegments(String(text || ''), resultQuery)) {
      const span = document.createElement(part.match ? 'mark' : 'span'); span.textContent = part.text; node.append(span);
    }
  };
  const renderSearchResults = api => {
    results.replaceChildren(); links = []; selected = -1;
    for (const item of found.slice(0, shown)) {
      const link = document.createElement('a'); link.className = 'search-result'; link.href = item.url;
      link.dataset.searchSelected = 'false';
      const title = document.createElement('strong'); highlighted(title, item.title, api);
      const description = document.createElement('p'); highlighted(description, item.excerpt ?? api.excerptFor(item, resultQuery), api);
      const meta = document.createElement('small'); meta.className = 'search-result-meta';
      let date = '';
      if (item.date) try { date = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(item.date)); } catch {}
      meta.textContent = [item.category, date].filter(Boolean).join(' · ');
      link.append(title, meta, description); results.append(link); links.push(link);
    }
    announce('找到 ' + found.length + ' 篇文章' + (found.length > links.length ? '，已显示 ' + links.length + ' 篇' : ''));
    if (moreSearch) { moreSearch.hidden = found.length <= links.length; moreSearch.textContent = '再看 ' + Math.min(12, found.length - links.length) + ' 篇'; }
  };
  const search = async (query, category, sort, seq) => {
    try {
      const api = await getSearchUtilities(); if (!currentSearch(seq)) return;
      const index = await getPublicIndex(api); if (!currentSearch(seq)) return;
      found = api.searchDocuments(index, query, { category, sort }); resultQuery = query; shown = 12;
      busySearch(false);
      if (!found.length) { hint('没有找到相关文字，换个关键词或分类试试'); announce('没有找到相关文章'); return; }
      renderSearchResults(api);
    } catch {
      if (!currentSearch(seq)) return;
      busySearch(false); hint('搜索暂时不可用，请重试或到文章归档浏览'); announce('搜索暂时不可用');
    }
  };
  const scheduleSearch = (immediate = false) => {
    invalidateSearch(); if (!input || !dialog?.open || !results) return;
    input.value = input.value.slice(0, 120); syncClear();
    const query = input.value.normalize('NFKC').replace(/\s+/g, ' ').trim();
    const category = categoryInput?.value || 'all', sort = sortInput?.value === 'recent' ? 'recent' : 'relevance';
    if (!query && category === 'all') { busySearch(false); hint('输入关键词，或选择一个分类'); announce(''); return; }
    hint('正在翻找笔记…'); busySearch(true); announce('正在搜索');
    const seq = searchSeq;
    if (immediate) void search(query, category, sort, seq);
    else debounce = delay(() => { debounce = 0; void search(query, category, sort, seq); }, 180);
  };
  on(input, 'compositionstart', () => { composing = true; invalidateSearch(); busySearch(false); hint('输入完成后搜索'); announce(''); });
  on(input, 'compositionend', () => { composing = false; scheduleSearch(); });
  on(input, 'input', event => {
    syncClear(); invalidateSearch();
    if (!composing && !event.isComposing) scheduleSearch();
  });
  on(categoryInput, 'change', () => { if (!composing) scheduleSearch(true); });
  on(sortInput, 'change', () => { if (!composing) scheduleSearch(true); });
  on(clearSearch, 'click', () => { if (!input) return; input.value = ''; composing = false; scheduleSearch(true); input.focus(); });
  on(moreSearch, 'click', async () => {
    const seq = searchSeq, oldCount = links.length;
    try {
      const api = await getSearchUtilities(); if (!currentSearch(seq)) return;
      shown += 12; renderSearchResults(api);
      if (moreSearch.hidden && document.activeElement === moreSearch && links[oldCount]) selectResult(oldCount, true);
    } catch {}
  });
  on(results, 'focusin', event => { const index = links.indexOf(event.target); if (index >= 0) selectResult(index); });
  on(dialog, 'keydown', event => {
    if (composing || event.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || !links.length) return;
    const index = links.indexOf(document.activeElement), fromInput = event.target === input;
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (fromInput || index >= 0)) {
      event.preventDefault(); const step = event.key === 'ArrowDown' ? 1 : -1;
      selectResult(fromInput ? (step > 0 ? 0 : links.length - 1) : (index + step + links.length) % links.length, true);
    } else if ((event.key === 'Home' || event.key === 'End') && index >= 0) {
      event.preventDefault(); selectResult(event.key === 'Home' ? 0 : links.length - 1, true);
    } else if (event.key === 'Enter' && fromInput && !event.repeat) {
      event.preventDefault(); links[selected >= 0 ? selected : 0]?.click();
    }
  });
  $$('[data-copy-link]').forEach(button => on(button, 'click', async () => {
    try { await navigator.clipboard.writeText(location.origin + location.pathname); toast('文章链接已复制'); }
    catch { toast('当前环境无法复制，请从浏览器地址栏复制链接'); }
  }));
  $$('.prose pre').forEach(pre => {
    const code = $('code', pre);
    if (!code) return;
    const button = document.createElement('button'); button.className = 'copy-code'; button.textContent = '复制'; button.setAttribute('aria-label', '复制代码');
    on(button, 'click', async () => { try { await navigator.clipboard.writeText(code.textContent); button.textContent = '已复制'; delay(()=>button.textContent='复制',2000); } catch { toast('复制不可用，请手动选中代码'); } });
    pre.append(button);
  });
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('app', initialize);
  else initialize();
})();
