(() => {
  'use strict';
  const safePostPath = (value) => typeof value === 'string' && /^\/posts\/[a-z0-9][a-z0-9-]{0,100}\/$/.test(value);
  const safeGalleryImage = (value) => typeof value === 'string' && /^\/images\/cosmic\/(kaguya|iroha|yachiyo|story)\.webp$/.test(value);
  const normalizeDensity = (value) => value === 'compact' ? 'compact' : 'comfortable';
  const choosePath = (values, random = Math.random) => {
    if (!Array.isArray(values)) return null;
    const paths = [...new Set(values.filter(safePostPath))].slice(0, 1000);
    if (!paths.length) return null;
    const number = Number(random());
    return paths[Math.min(paths.length - 1, Math.max(0, Math.floor((Number.isFinite(number) ? number : 0) * paths.length)))];
  };
  const latestReading = (records, validPaths) => {
    if (!Array.isArray(records) || !Array.isArray(validPaths)) return null;
    return records.slice(0,100).filter(record => record && safePostPath(record.path) && validPaths.includes(record.path) && typeof record.title === 'string' && Number.isFinite(Number(record.at)))
      .sort((a,b) => Number(b.at)-Number(a.at)).map(record => ({ path: record.path, title: record.title.slice(0,200) }))[0] || null;
  };
  globalThis.MoonlightRefinement = Object.freeze({ safePostPath, safeGalleryImage, normalizeDensity, choosePath, latestReading });
  if (typeof document === 'undefined') return;
  const initialize = (scope) => {
    const on = (target, ...args) => scope ? scope.listen(target, ...args) : target?.addEventListener(...args);

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
  const appearance = $('[data-appearance-dialog]');
  const feedback = $('[data-appearance-feedback]');
  const applyDensity = (value, save = false) => {
    const density = normalizeDensity(value);
    document.documentElement.dataset.density = density;
    $$('[data-density]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.density === density)));
    if (save) {
      try { localStorage.setItem('cosmic-density', density); if (feedback) feedback.textContent = '显示密度已保存到当前浏览器。'; }
      catch { if (feedback) feedback.textContent = '已改变当前页面，但浏览器存储不可用，刷新后不会保留。'; }
    }
  };
  applyDensity(read('cosmic-density', 'comfortable'));
  $$('[data-density]').forEach(button => on(button, 'click', () => applyDensity(button.dataset.density, true)));
  $$('[data-appearance-open]').forEach(button => on(button, 'click', () => { if (!appearance?.open) appearance?.showModal(); }));
  on($('[data-appearance-close]'), 'click', () => appearance?.close());
  on(appearance, 'click', event => { if (event.target === appearance) { const rect=appearance.getBoundingClientRect(); if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) appearance.close(); } });
  const randomButton = $('[data-random-post]');
  const paths = parse(randomButton?.dataset.postPaths || '[]', []);
  on(randomButton, 'click', () => { const target=choosePath(paths); if(target) { if(globalThis.FieldnotesNavigate) void globalThis.FieldnotesNavigate(target); else location.assign(target); } });
  if (randomButton && !choosePath(paths)) { randomButton.disabled=true; randomButton.textContent='暂时没有公开文章'; }
  const continueLink = $('[data-continue-reading]');
  if (continueLink) {
    const recent = latestReading(parse(read('cosmic-recent-v1', '[]'), []), Array.isArray(paths)?paths:[]);
    if (recent) {
      continueLink.href=recent.path;
      const label = continueLink.querySelector('span');
      if (label?.firstChild) label.firstChild.textContent='继续上次的阅读 ';
      else { const text = [...(continueLink.childNodes || [])].find(node => node.nodeType === 3 && node.textContent.trim()); if (text) text.textContent='继续上次的阅读 '; }
      const detail = continueLink.querySelector('small');
      if (detail) detail.textContent=recent.title;
      continueLink.setAttribute('aria-label','继续阅读：'+recent.title);
    }
  }
  const lightbox = $('[data-gallery-dialog]');
  const gallery = $$('[data-gallery-open]').map(button => ({
    button, src:button.dataset.gallerySrc, title:button.dataset.galleryTitle || '月光画廊', caption:button.dataset.galleryCaption || ''
  })).filter(item=>safeGalleryImage(item.src));
  let active=0, returnFocus=null;
  const show = index => {
    if (!gallery.length || !lightbox) return;
    active=(index%gallery.length+gallery.length)%gallery.length;
    const item=gallery[active], image=$('[data-gallery-image]');
    image.src=item.src; image.alt=item.title;
    $('[data-gallery-title]').textContent=item.title;
    $('[data-gallery-caption]').textContent=item.caption;
    $('[data-gallery-counter]').textContent=`${active+1} / ${gallery.length}`;
    if (!lightbox.open) lightbox.showModal();
  };
  gallery.forEach((item,index) => on(item.button, 'click', () => { returnFocus=item.button; show(index); }));
  on($('[data-gallery-close]'), 'click',()=>lightbox?.close());
  on($('[data-gallery-prev]'), 'click',()=>show(active-1));
  on($('[data-gallery-next]'), 'click',()=>show(active+1));
  on(lightbox, 'keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();show(active-1);}if(event.key==='ArrowRight'){event.preventDefault();show(active+1);}});
  on(lightbox, 'close',()=>{returnFocus?.focus();});
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('refined', initialize);
  else initialize();
})();
