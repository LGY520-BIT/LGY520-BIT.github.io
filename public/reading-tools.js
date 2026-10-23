/* Small, page-scoped article tools. No article content or reading data is sent. */
(() => {
  'use strict';
  const initialized = new WeakSet();
  const initialize = (scope) => {
    const article = document.querySelector('article[data-article-info]');
    const prose = article?.querySelector('.article-grid .prose');
    if (!prose || initialized.has(prose)) return;
    initialized.add(prose);
    let alive = true, queued = false;
    const buttons = [], wrappers = [], cleanups = [];
    const active = () => alive && scope?.active !== false && prose.isConnected;
    const cleanup = callback => scope ? scope.cleanup(callback) : cleanups.push(callback);
    const on = (target, type, callback, options) => {
      if (scope) return scope.listen(target, type, callback, options);
      target?.addEventListener?.(type, callback, options);
      cleanups.push(() => target?.removeEventListener?.(type, callback, options));
    };
    const timeout = (callback, delay) => {
      if (scope) return scope.timeout(callback, delay);
      const id = setTimeout(() => { if (active()) callback(); }, delay);
      cleanups.push(() => clearTimeout(id));
      return id;
    };
    const frame = callback => {
      if (scope) return scope.frame(callback);
      const id = requestAnimationFrame(() => { if (active()) callback(); });
      cleanups.push(() => cancelAnimationFrame(id));
      return id;
    };
    const feedback = article.querySelector('[data-reading-feedback]');
    const status = message => { if (active() && feedback?.isConnected) feedback.textContent = message; };

    for (const heading of [...prose.querySelectorAll('h2[id], h3[id]')].slice(0, 2000)) {
      if (!heading.id || heading.querySelector('[data-reading-section-copy]')) continue;
      const label = heading.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) || '章节';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'reading-section-copy';
      button.setAttribute('data-reading-section-copy', '');
      button.setAttribute('data-pagefind-ignore', '');
      button.setAttribute('aria-label', '复制章节链接：' + label);
      button.title = '复制章节链接';
      button.textContent = '#';
      let request = 0;
      on(button, 'click', async () => {
        if (!active() || !button.isConnected || button.disabled) return;
        const current = ++request;
        button.disabled = true;
        button.textContent = '#';
        try {
          if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
          // A fragment share must not include searches, access tokens or route state.
          const url = location.origin + location.pathname + '#' + encodeURIComponent(heading.id);
          await navigator.clipboard.writeText(url);
          if (!active() || !button.isConnected || current !== request) return;
          button.textContent = '✓';
          status('已复制章节链接');
          timeout(() => {
            if (active() && button.isConnected && current === request) button.textContent = '#';
          }, 1500);
        } catch {
          if (active() && button.isConnected && current === request) status('复制失败，可使用目录定位章节');
        } finally {
          if (active() && button.isConnected && current === request) button.disabled = false;
        }
      });
      heading.append(button);
      buttons.push(button);
    }

    for (const table of [...prose.querySelectorAll('table')].slice(0, 2000)) {
      if (!table.parentNode || table.parentElement?.classList.contains('reading-table-scroll')) continue;
      const wrapper = document.createElement('div');
      wrapper.className = 'reading-table-scroll';
      wrapper.setAttribute('data-reading-table-scroll', '');
      table.parentNode.insertBefore(wrapper, table);
      wrapper.append(table);
      wrappers.push({ wrapper, table });
    }
    const measure = () => {
      queued = false;
      if (!active()) return;
      for (const { wrapper, table } of wrappers) {
        if (!wrapper.isConnected || table.parentNode !== wrapper) continue;
        const overflowing = wrapper.scrollWidth > wrapper.clientWidth + 1;
        if (overflowing) {
          wrapper.setAttribute('tabindex', '0');
          wrapper.setAttribute('role', 'region');
          wrapper.setAttribute('aria-label', table.querySelector('caption')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) || '文章表格');
        } else {
          // Removing a tab stop does not move an already focused reader.
          wrapper.removeAttribute('tabindex');
          wrapper.removeAttribute('role');
          wrapper.removeAttribute('aria-label');
        }
      }
    };
    const schedule = () => { if (active() && !queued) { queued = true; frame(measure); } };
    on(window, 'resize', schedule, { passive: true });
    on(document, 'fieldnotes:reading-preferences', schedule);
    on(prose, 'load', schedule, true);
    on(document.fonts, 'loadingdone', schedule);
    if (typeof ResizeObserver === 'function' && wrappers.length) {
      const observer = new ResizeObserver(schedule);
      observer.observe(prose);
      for (const { wrapper, table } of wrappers) { observer.observe(wrapper); observer.observe(table); }
      cleanup(() => observer.disconnect());
    }
    cleanup(() => {
      alive = false;
      initialized.delete(prose);
      for (const button of buttons) button.remove();
      for (const { wrapper, table } of wrappers) {
        if (!wrapper.parentNode || table.parentNode !== wrapper) continue;
        // Keep the original table, caption and any nodes inserted by the reader.
        const parent = wrapper.parentNode;
        while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
        wrapper.remove();
      }
    });
    measure();
    schedule();
    if (!scope) on(document, 'astro:before-swap', () => {
      for (const callback of cleanups.reverse()) callback();
      cleanups.length = 0;
    }, { once: true });
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('reading-tools', initialize);
  else initialize();
})();
