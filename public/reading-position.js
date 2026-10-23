/* Article-only reading progress. No network requests or automatic scrolling. */
(() => {
  'use strict';
  const KEY = 'cosmic-reading-position-v1';
  const limit = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
  const validPath = path => typeof path === 'string' && /^\/posts\/[a-z0-9][a-z0-9-]{0,100}\/$/.test(path);
  const clean = value => {
    if (!value || !validPath(value.path) || typeof value.anchor !== 'string' || value.anchor.length > 300 ||
        /[\u0000-\u001f]/.test(value.anchor) || !Number.isFinite(value.offset) || value.offset < 0 || value.offset > 1 ||
        !Number.isFinite(value.ratio) || value.ratio < 0 || value.ratio > 1 || !Number.isFinite(value.at) || value.at < 0) return null;
    return { path: value.path, anchor: value.anchor, offset: value.offset, ratio: value.ratio, at: value.at };
  };
  const read = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw || raw.length > 100000) return [];
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.positions)) return [];
      const unique = new Map();
      for (const record of data.positions.slice(0, 1000).map(clean).filter(Boolean).sort((a, b) => b.at - a.at)) {
        if (!unique.has(record.path)) unique.set(record.path, record);
        if (unique.size === 30) break;
      }
      return [...unique.values()];
    } catch { return []; }
  };

  const initialize = scope => {
    const article = document.querySelector('[data-article-info]');
    const prose = article?.querySelector('.article-grid .prose');
    const path = location.pathname;
    if (!prose || !validPath(path)) return;
    const on = (target, ...args) => scope ? scope.listen(target, ...args) : target?.addEventListener(...args);
    const later = (callback, ms) => scope ? scope.timeout(callback, ms) : setTimeout(callback, ms);
    const frame = callback => scope ? scope.frame(callback) : requestAnimationFrame(callback);
    const percent = article.querySelector('[data-reading-percent]');
    const resume = article.querySelector('[data-reading-resume]');
    const resumeButton = article.querySelector('[data-resume-reading]');
    const dismissButton = article.querySelector('[data-dismiss-resume]');
    const headings = [...prose.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')].slice(0, 2000);
    const links = [...article.querySelectorAll('.article-toc a[href^="#"]')].map(link => {
      try { return { link, id: decodeURIComponent(link.getAttribute('href').slice(1)) }; }
      catch { return { link, id: '' }; }
    });
    const linkedIds = new Set(links.map(item => item.id).filter(Boolean));
    const previous = read().find(record => record.path === path);
    let pending = null, timer = 0, scheduled = false, intentUntil = 0, pointerHeld = false;
    let lastY = window.scrollY || 0;
    const line = () => Math.min(120, Math.max(72, (window.innerHeight || 800) * 0.15));
    const geometry = () => {
      const y = window.scrollY || 0, rect = prose.getBoundingClientRect();
      const top = rect.top + y, bottom = top + rect.height;
      return { y, top, bottom, positions: headings.map(heading => ({ heading, top: heading.getBoundingClientRect().top + y })) };
    };
    const capture = () => {
      const g = geometry(), readingY = g.y + line();
      const current = [...g.positions].reverse().find(item => item.top <= readingY);
      const start = current?.top ?? g.top;
      const next = g.positions.find(item => item.top > start + 0.5);
      const end = next?.top ?? g.bottom;
      return { path, anchor: current?.heading.id || '', offset: limit((readingY - start) / Math.max(1, end - start)),
        ratio: limit((g.y - g.top + line()) / Math.max(1, g.bottom - g.top - (window.innerHeight || 800) + line())), at: Date.now() };
    };
    const paint = () => {
      scheduled = false;
      const position = capture();
      if (percent) percent.textContent = Math.round(position.ratio * 100) + '%';
      const g = geometry(), readingY = g.y + line();
      const listed = g.positions.filter(item => linkedIds.has(item.heading.id));
      const active = [...listed].reverse().find(item => item.top <= readingY)?.heading || listed[0]?.heading;
      for (const { link, id } of links) {
        if (id && active?.id === id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    };
    const schedulePaint = () => { if (!scheduled) { scheduled = true; frame(paint); } };
    const save = () => {
      if (timer) clearTimeout(timer);
      timer = 0;
      if (!pending) return;
      const record = pending; pending = null;
      try {
        const positions = [record, ...read().filter(item => item.path !== path)].slice(0, 30);
        localStorage.setItem(KEY, JSON.stringify({ version: 1, positions }));
      } catch { /* Reading remains usable when storage is unavailable. */ }
    };
    const remember = () => {
      pending = capture();
      if (resume) resume.hidden = true;
      if (!timer) timer = later(save, 400);
    };
    const intent = () => { intentUntil = Date.now() + 1500; };
    on(window, 'wheel', intent, { passive: true });
    on(window, 'touchmove', intent, { passive: true });
    on(window, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) intent();
    });
    on(window, 'pointerdown', event => {
      pointerHeld = event.button === 0 && event.clientX >= document.documentElement.clientWidth - 20;
      if (pointerHeld) intent();
    }, { passive: true });
    on(window, 'pointermove', () => { if (pointerHeld) intent(); }, { passive: true });
    on(window, 'pointerup', () => { pointerHeld = false; }, { passive: true });
    on(window, 'scroll', () => {
      const y = window.scrollY || 0;
      if (Date.now() <= intentUntil && Math.abs(y - lastY) >= 2) remember();
      lastY = y;
      schedulePaint();
    }, { passive: true });
    on(window, 'resize', schedulePaint, { passive: true });
    on(document, 'fieldnotes:reading-preferences', () => {
      intentUntil = 0;
      // A pending snapshot already represents genuine reading; flush it before layout changes.
      save();
      schedulePaint();
    });
    on(window, 'pagehide', save);
    on(document, 'visibilitychange', () => { if (document.hidden) save(); });
    for (const { link } of links) on(link, 'click', intent);
    if (previous && previous.ratio >= 0.05 && previous.ratio < 0.98 && !location.hash && resume && resumeButton) {
      resume.hidden = false;
      resumeButton.textContent = '继续上次阅读 · ' + Math.round(previous.ratio * 100) + '%';
    } else if (resume) resume.hidden = true;
    on(resumeButton, 'click', () => {
      if (!previous || location.hash) { if (resume) resume.hidden = true; return; }
      const g = geometry(), section = g.positions.find(item => item.heading.id === previous.anchor);
      const start = section?.top ?? (previous.anchor ? null : g.top);
      const next = start === null ? null : g.positions.find(item => item.top > start + 0.5);
      const target = start === null
        ? g.top + previous.ratio * Math.max(1, g.bottom - g.top - (window.innerHeight || 800) + line()) - line()
        : start + previous.offset * Math.max(1, (next?.top ?? g.bottom) - start) - line();
      // Explicit instant navigation avoids motion and honors a changed font or reading width.
      window.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
      const focusTarget = section?.heading || [...g.positions].reverse().find(item => item.top <= target + line())?.heading || prose;
      if (typeof focusTarget.focus === 'function') {
        if (focusTarget.getAttribute('tabindex') === null) {
          focusTarget.setAttribute('tabindex', '-1');
          scope?.cleanup(() => { if (focusTarget.getAttribute('tabindex') === '-1') focusTarget.removeAttribute('tabindex'); });
        }
        focusTarget.focus({ preventScroll: true });
      }
      lastY = window.scrollY || 0;
      intentUntil = 0;
      if (resume) resume.hidden = true;
      schedulePaint();
    });
    on(dismissButton, 'click', () => { if (resume) resume.hidden = true; });
    on(window, 'hashchange', () => { if (location.hash && resume) resume.hidden = true; schedulePaint(); });
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(schedulePaint);
      if (scope) scope.observe(observer, prose);
      else observer.observe(prose);
    }
    scope?.cleanup(save);
    paint();
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('reading-position', initialize);
  else initialize();
})();
