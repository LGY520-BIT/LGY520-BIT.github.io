/* The persistent native audio owns playback. This controller only renders and scrubs. */
(() => {
  'use strict';
  if (window.FieldnotesVinyl) { window.FieldnotesVinyl.init(); return; }
  const init = () => {
    const root = document.querySelector('[data-music-player]');
    if (!root || root.dataset.vinylReady) return;
    const rotor = root.querySelector('[data-vinyl-rotor]');
    const deck = root.querySelector('[data-vinyl-deck]');
    const audio = root.querySelector('[data-music-audio]');
    const seek = root.querySelector('[data-music-seek]');
    if (!rotor || !deck || !audio || !seek) return;
    root.dataset.vinylReady = 'true';
    const session = root.closest('[data-music-session]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const forced = window.matchMedia('(forced-colors: active)');
    let angle = 0, last = performance.now(), frame = 0, dragging = null, waiting = false;
    let turning = !audio.paused && !audio.ended;
    // 33⅓ RPM = 200 degrees / second. One manual turn scrubs twelve seconds.
    const normalAngle = value => ((value % 360) + 360) % 360;
    const duration = () => Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const clock = seconds => { const value = Math.floor(Math.max(0, seconds)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; };
    const quiet = () => reduced.matches || forced.matches || document.documentElement.dataset.motion === 'quiet' || document.documentElement.dataset.uiHidden === 'yes';
    const visible = () => !document.hidden && root.isConnected !== false && (!session || session.dataset.musicLocation !== 'dock') && !root.querySelector('[data-music-panel]')?.hidden;
    const settle = () => {
      const now = performance.now();
      if (turning && !dragging) angle = normalAngle(angle + Math.max(0, now - last) * .2);
      last = now;
    };
    const render = () => { rotor.style.setProperty('--vinyl-angle', `${angle.toFixed(3)}deg`); };
    const syncAccessible = () => {
      const total = duration(), value = Math.max(0, Math.min(total, Number(audio.currentTime) || 0));
      rotor.setAttribute('aria-valuemax', String(Math.round(total * 10) / 10));
      rotor.setAttribute('aria-valuenow', String(Math.round(value * 10) / 10));
      rotor.setAttribute('aria-valuetext', total ? `${clock(value)} / ${clock(total)}` : '尚未载入歌曲');
      rotor.setAttribute('aria-disabled', String(!total));
    };
    const cancelFrame = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
    const animate = () => {
      frame = 0;
      settle();
      if (!visible() || quiet() || dragging || !turning) return;
      render();
      frame = requestAnimationFrame(animate);
    };
    const refresh = () => {
      settle();
      turning = !audio.paused && !audio.ended && !waiting && !audio.error;
      deck.dataset.vinylPlaying = String(turning);
      cancelFrame();
      // No animation loop when the deck is hidden, docked or motion is reduced.
      if (visible() && !quiet() && !dragging) {
        render();
        if (turning) frame = requestAnimationFrame(animate);
      }
      syncAccessible();
    };
    const setTime = value => {
      const total = duration();
      if (!total || !Number.isFinite(value)) return;
      seek.value = String(Math.max(0, Math.min(total, value)) / total * 1000);
      // Use the existing seek control so lyrics, persistence and timeline stay in sync.
      seek.dispatchEvent(new Event('input', { bubbles: true }));
      syncAccessible();
    };
    const pointerAngle = event => {
      const rect = rotor.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2), y = event.clientY - (rect.top + rect.height / 2);
      return Math.hypot(x, y) < 12 ? null : Math.atan2(y, x) * 180 / Math.PI;
    };
    const finishDrag = (event, cancelled = false) => {
      if (!dragging || event.pointerId !== dragging.id) return;
      const id = dragging.id;
      dragging = null;
      deck.dataset.vinylDragging = 'false';
      try { if (rotor.hasPointerCapture(id)) rotor.releasePointerCapture(id); } catch { /* Capture can end outside this page. */ }
      last = performance.now();
      if (!cancelled) syncAccessible();
      refresh();
    };
    rotor.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false || dragging || !duration()) return;
      const point = pointerAngle(event);
      if (point === null) return;
      settle(); cancelFrame();
      dragging = { id: event.pointerId, point, time: Math.max(0, Math.min(duration(), Number(audio.currentTime) || 0)) };
      deck.dataset.vinylDragging = 'true';
      rotor.focus({ preventScroll: true });
      try { rotor.setPointerCapture(event.pointerId); } catch { /* Pointer events still work until it leaves the disc. */ }
      event.preventDefault();
    });
    rotor.addEventListener('pointermove', event => {
      if (!dragging || event.pointerId !== dragging.id) return;
      const point = pointerAngle(event);
      if (point === null) { dragging.point = null; return; }
      if (dragging.point === null) { dragging.point = point; return; }
      const delta = ((point - dragging.point + 540) % 360) - 180;
      dragging.point = point;
      angle = normalAngle(angle + delta);
      render();
      dragging.time = Math.max(0, Math.min(duration(), dragging.time + delta / 360 * 12));
      setTime(dragging.time);
      event.preventDefault();
    });
    rotor.addEventListener('pointerup', event => finishDrag(event));
    rotor.addEventListener('pointercancel', event => finishDrag(event, true));
    rotor.addEventListener('lostpointercapture', event => finishDrag(event, true));
    rotor.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const current = Number(audio.currentTime) || 0;
      const changes = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -30, PageUp: 30 };
      if (Object.hasOwn(changes, event.key)) { event.preventDefault(); setTime(current + changes[event.key]); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setTime(event.key === 'Home' ? 0 : duration()); }
      else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) root.querySelector('[data-music-play]')?.click(); }
    });
    audio.addEventListener('play', () => { waiting = false; refresh(); });
    audio.addEventListener('playing', () => { waiting = false; refresh(); });
    audio.addEventListener('waiting', () => { settle(); waiting = true; refresh(); });
    for (const type of ['pause', 'ended', 'error', 'emptied']) audio.addEventListener(type, refresh);
    for (const type of ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked']) audio.addEventListener(type, syncAccessible);
    document.addEventListener('visibilitychange', refresh);
    document.addEventListener('astro:after-swap', refresh);
    document.addEventListener('astro:page-load', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('pagehide', () => { settle(); cancelFrame(); });
    reduced.addEventListener('change', refresh);
    forced.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion', 'data-ui-hidden'] });
    if (session) new MutationObserver(refresh).observe(session, { attributes: true, attributeFilter: ['data-music-location'] });
    refresh();
  };
  window.FieldnotesVinyl = { init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  document.addEventListener('astro:page-load', init);
})();
