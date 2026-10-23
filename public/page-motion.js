/* Reversible, route-local presentation. Never hide content or touch persistent media. */
(() => {
  'use strict';
  const KEY = 'unfinished-page-motion-v1';
  const valid = value => ['soft','snappy','off'].includes(value);
  const initialize = scope => {
    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    let preference = valid(root.dataset.pageMotion) ? root.dataset.pageMotion : 'soft';
    try { const saved = localStorage.getItem(KEY); if (valid(saved)) preference = saved; } catch {}
    const controls = [...document.querySelectorAll('[data-page-motion-choice]')];
    const status = document.querySelector('[data-page-motion-status]');
    const active = new Set(), cards = new Map(), rendered = new Set();
    let observer = null, disposed = false;
    const disabled = () => disposed || !scope.active || preference === 'off' || reduced.matches || forced.matches || root.dataset.motion === 'quiet' || document.visibilityState === 'hidden';
    const blocked = element => !element?.isConnected || element.hidden || element.closest?.('[hidden],dialog,form,[inert],[data-music-session],[data-companion],[data-site-wallpaper]') || element.contains?.(document.activeElement);
    const stop = state => { if (state?.animation) { state.animation.cancel(); active.delete(state.animation); state.animation = null; } };
    const cancel = () => { for (const animation of active) animation.cancel(); active.clear(); for (const state of cards.values()) state.animation = null; observer?.disconnect(); };
    const play = (element, delay = 0, state = null, subtle = false) => {
      if (disabled() || blocked(element) || typeof element.animate !== 'function') return;
      // Independent translate avoids overwriting existing card hover transforms.
      try {
        const animation = element.animate([{opacity:subtle ? .6 : .24,translate:subtle?'0 6px':'0 14px'},{opacity:1,translate:'0 0'}],
          {duration:subtle?240:preference === 'snappy' ? 300 : 560,delay,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
        active.add(animation);
        if (state) state.animation = animation;
        const release = () => {
          // A reverse-finished backwards fill still owns opacity/translate.
          // Remove the native effect before forgetting it, for every target.
          animation.cancel();
          active.delete(animation);
          if (state?.animation === animation) state.animation = null;
        };
        animation.finished.then(release,release);
      } catch { /* Unsupported animation engines keep the normal readable page. */ }
    };
    const startObserver = () => {
      if (disabled() || !observer) return;
      for (const element of cards.keys()) observer.observe(element);
    };
    const sync = () => {
      root.dataset.pageMotion = preference;
      controls.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.pageMotionChoice === preference)));
      if (status) status.textContent = reduced.matches || root.dataset.motion === 'quiet' ? '减少动态已启用' : '';
      if (disabled()) cancel(); else startObserver();
    };
    scope.cleanup(() => { disposed = true; cancel(); cards.clear(); rendered.clear(); });
    controls.forEach(button => scope.listen(button,'click',() => {
      if (!valid(button.dataset.pageMotionChoice)) return;
      preference = button.dataset.pageMotionChoice;
      try { localStorage.setItem(KEY,preference); } catch {}
      cancel(); sync();
    }));
    scope.listen(window,'storage',event => { if (event.key === KEY || event.key === null) { preference = valid(event.newValue) ? event.newValue : 'soft'; cancel(); sync(); } });
    scope.listen(reduced,'change',sync); scope.listen(forced,'change',sync);
    scope.listen(document,'visibilitychange',sync);
    scope.listen(window,'pagehide',cancel);
    scope.listen(window,'pageshow',event => { if (event.persisted) { cancel(); sync(); } });
    scope.listen(document,'focusin',event => {
      for (const [element,state] of cards) if (element.contains?.(event.target)) stop(state);
    });
    if (typeof MutationObserver === 'function') {
      const changes = new MutationObserver(sync);
      changes.observe(root,{attributes:true,attributeFilter:['data-motion']}); scope.cleanup(() => changes.disconnect());
    }
    // Working screens get only a restrained heading entry, never moving controls.
    const privatePage = /^\/(?:studio|atelier|media|history)(?:\/|$)/.test(location.pathname);
    const entry = document.querySelector(privatePage
      ? '#main .studio-intro > div:first-child, #main .atelier-intro > div:first-child, #main .media-heading > div:first-child, #main .history-hero > div:first-child'
      : '#main .page-intro, #main .anime-hero, #main .music-room__intro, #main .links-hero, #main .gallery-heading, #main .space-identity-copy, #main .article-heading, #main .dreamscape-worknote, #main .not-found');
    const entryState = {inside:true,animation:null,key:'',subtle:privatePage};
    play(entry,0,entryState,privatePage);
    if (!privatePage) {
      const selector = '#main .scrap-world-title, #main .scrap-clock-card, #main .scrap-room-link, #main .next-post-card, #main .anime-card, #main .gallery-card, #main .project-card, #main .link-card, #main .library-entry, #main .related-card, #main .space-columns .space-card, #main .about-layout .quote-note';
      const keyFor = element => {
        const list = element.closest('.links-grid,.library-list,#anime-grid');
        if (!list) return '';
        const id = element.dataset.linkId || element.querySelector('h2 a,h3 a')?.getAttribute('href');
        return id ? `${list.getAttribute('class')}:${list.hasAttribute('data-saved-list')?'saved':'other'}:${id}` : '';
      };
      const collect = () => {
        if (disposed || !scope.active) return;
        for (const [element,state] of cards) if (!element.isConnected) { stop(state); observer?.unobserve(element); cards.delete(element); }
        for (const element of document.querySelectorAll(selector)) {
          if (cards.has(element) || cards.size >= 64 || element.closest('dialog,form,[data-music-session],[data-companion],[data-site-wallpaper]') || element.querySelector('input,textarea,[contenteditable]')) continue;
          const key = keyFor(element);
          cards.set(element,{inside:!!key && rendered.has(key),animation:null,key,subtle:false});
          if (!disabled()) observer?.observe(element);
        }
      };
      if (typeof IntersectionObserver === 'function') {
        observer = new IntersectionObserver(entries => {
          if (disabled()) return;
          let index = 0;
          for (const entry of entries) {
            const state = cards.get(entry.target);
            if (!state) continue;
            // A 15% entry / completely-out exit dead band avoids edge flicker.
            if ((entry.isIntersecting && (entry.intersectionRatio ?? 1) < .15) || entry.isIntersecting === state.inside) continue;
            state.inside = entry.isIntersecting;
            if (blocked(entry.target)) { stop(state); continue; }
            if (!state.inside) {
              if (state.animation?.playState === 'running' && state.animation.playbackRate > 0) state.animation.reverse();
              else stop(state);
            } else {
              if (state.key && rendered.size < 256) rendered.add(state.key);
              if (state.animation?.playState === 'running' && state.animation.playbackRate < 0) state.animation.reverse();
              else { stop(state); play(entry.target,Math.min(index++,3) * (preference === 'snappy' ? 25 : 45),state); }
            }
          }
        },{threshold:[0,.15],rootMargin:'0px 0px -24px 0px'});
      }
      collect();
      if (entry && !cards.has(entry)) cards.set(entry,entryState);
      // Only observe list replacements, never the whole document or input changes.
      if (typeof MutationObserver === 'function') {
        const lists = document.querySelectorAll('#main .links-grid, #main .library-list, #main #anime-grid');
        if (lists.length) {
          const changes = new MutationObserver(collect);
          for (const list of lists) changes.observe(list,{childList:true});
          scope.cleanup(() => changes.disconnect());
        }
      }
    } else {
      // Included in cancellation/focus cleanup, but no viewport observer on editors.
      if (entry) cards.set(entry,entryState);
    }
    sync();
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('page-motion',initialize);
})();
