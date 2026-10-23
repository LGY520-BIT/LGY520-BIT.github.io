/* Page-scoped UI resources. Persistent audio and the companion are not registered here. */
(() => {
  'use strict';
  if (globalThis.FieldnotesRoute || typeof document === 'undefined') return;
  const registrations = new Map();
  let ready = document.readyState !== 'loading';
  let swapping = false;

  const createScope = () => {
    let active = true;
    const cleanups = [], timers = new Set(), intervals = new Set(), frames = new Set();
    const scope = {
      get active() { return active; },
      cleanup(callback) {
        if (typeof callback !== 'function') return callback;
        if (active) cleanups.push(callback); else callback();
        return callback;
      },
      listen(target, type, listener, options) {
        if (!active || !target?.addEventListener) return;
        target.addEventListener(type, listener, options);
        scope.cleanup(() => target.removeEventListener?.(type, listener, options));
        return listener;
      },
      timeout(callback, delay, ...args) {
        if (!active) return 0;
        const id = setTimeout(() => { timers.delete(id); if (active) callback(...args); }, delay);
        timers.add(id);
        return id;
      },
      interval(callback, delay, ...args) {
        if (!active) return 0;
        const id = setInterval(() => { if (active) callback(...args); }, delay);
        intervals.add(id);
        return id;
      },
      frame(callback) {
        if (!active) return 0;
        const id = requestAnimationFrame(time => { frames.delete(id); if (active) callback(time); });
        frames.add(id);
        return id;
      },
      observe(observer, target, options) {
        if (!active || !observer || !target) return observer;
        observer.observe(target, options);
        scope.cleanup(() => observer.disconnect());
        return observer;
      },
      dispose() {
        if (!active) return;
        active = false;
        for (const id of timers) clearTimeout(id);
        for (const id of intervals) clearInterval(id);
        for (const id of frames) cancelAnimationFrame(id);
        timers.clear(); intervals.clear(); frames.clear();
        for (const cleanup of cleanups.reverse()) {
          try { cleanup(); } catch (error) { console.error('[route cleanup]', error); }
        }
        cleanups.length = 0;
      }
    };
    return scope;
  };
  const initialize = record => {
    if (!ready || swapping || !document.body || (record.body === document.body && record.scope?.active)) return;
    record.scope?.dispose();
    record.body = document.body;
    const scope = createScope();
    record.scope = scope;
    try { scope.cleanup(record.initialize(scope)); }
    catch (error) { scope.dispose(); console.error('[route init] ' + record.name, error); }
  };
  const run = (name, callback) => {
    if (typeof name !== 'string' || typeof callback !== 'function' || registrations.has(name)) return;
    const record = { name, initialize: callback, scope: null, body: null };
    registrations.set(name, record);
    initialize(record);
  };
  const load = () => {
    ready = true;
    swapping = false;
    for (const record of registrations.values()) initialize(record);
  };
  document.addEventListener('DOMContentLoaded', load, { once: true });
  document.addEventListener('astro:before-swap', () => {
    swapping = true;
    for (const record of registrations.values()) record.scope?.dispose();
  });
  document.addEventListener('astro:page-load', load);
  globalThis.FieldnotesRoute = Object.freeze({ run });
})();
