/* First-party Cyber Moon effects. Fixed preferences only; ephemeral bounded particles. */
(() => {
  'use strict';
  const names = ['cursor', 'click', 'stars'];
  const normalize = (value) => value === 'off' ? 'off' : 'on';
  const policy = (preferences, constraints) => {
    const suspended = constraints.hidden || constraints.reduced || constraints.forced || constraints.quiet;
    return {
      cursor: !suspended && constraints.fine && preferences.cursor === 'on' ? 'on' : 'off',
      click: !suspended && constraints.fine && !constraints.privatePage && preferences.click === 'on' ? 'on' : 'off',
      stars: !suspended && constraints.home && preferences.stars === 'on' ? 'on' : 'off'
    };
  };
  const api = { normalize, policy, maxParticles: 18 };
  globalThis.CyberMoonEffects = api;
  if (typeof document === 'undefined') return;
  const initialize = () => {
  const root = document.documentElement;
  const layer = document.querySelector('[data-cyber-layer]');
  const particleLayer = document.querySelector('[data-cyber-clicks]');
  if (!layer || !particleLayer) return;
  const media = {
    reduced: matchMedia('(prefers-reduced-motion: reduce)'),
    forced: matchMedia('(forced-colors: active)'),
    fine: matchMedia('(hover: hover) and (pointer: fine)')
  };
  const preferences = {};
  let storageAvailable = true;
  for (const name of names) {
    try { preferences[name] = normalize(localStorage.getItem('cosmic-effects-' + name)); }
    catch { preferences[name] = 'on'; storageAvailable = false; }
  }
  const inputs = [...document.querySelectorAll('[data-cyber-toggle]')];
  const statuses = [...document.querySelectorAll('[data-cyber-status]')];
  const particles = new Map();
  let effective = {}, disposed = false;
  const privatePage = /^\/(?:studio|atelier)(?:\/|$)/.test(location.pathname);
  const clearParticles = () => {
    for (const [element, timer] of particles) { clearTimeout(timer); element.remove(); }
    particles.clear();
  };
  const removeParticle = (element) => {
    const timer = particles.get(element);
    if (timer === undefined) return;
    clearTimeout(timer); particles.delete(element); element.remove();
  };
  const apply = () => {
    if (disposed) return;
    const constraints = {
      hidden: document.hidden, reduced: media.reduced.matches, forced: media.forced.matches,
      fine: media.fine.matches, quiet: root.dataset.motion === 'quiet', privatePage,
      home: location.pathname === '/'
    };
    effective = policy(preferences, constraints);
    for (const name of names) root.dataset['cyber' + name[0].toUpperCase() + name.slice(1)] = effective[name];
    root.dataset.cyberHidden = String(document.hidden);
    if (effective.click !== 'on') clearParticles();
    inputs.forEach((input) => { input.checked = preferences[input.dataset.cyberToggle] === 'on'; });
    const reasons = [];
    if (constraints.reduced) reasons.push('系统减少动态效果：装饰暂停');
    if (constraints.forced) reasons.push('系统高对比模式：装饰暂停');
    if (constraints.quiet) reasons.push('静止模式：装饰暂停');
    if (!constraints.fine) reasons.push('当前不是精细鼠标设备：保留原生光标与点击反馈');
    if (privatePage) reasons.push('写作／私人内容页：点击粒子关闭');
    if (!constraints.home) reasons.push('首页以外不显示星屑');
    if (!storageAvailable) reasons.push('浏览器存储不可用：开关仅对本页有效');
    const text = reasons.length ? reasons.join('；') + '。偏好仍保留。' : '设置跨页保存。系统减少动态效果、静止模式优先；不记录鼠标轨迹或输入。';
    statuses.forEach((status) => { status.textContent = text; });
  };
  const controls = [];
  for (const input of inputs) {
    const name = input.dataset.cyberToggle;
    if (!names.includes(name)) continue;
    const handler = () => {
      preferences[name] = input.checked ? 'on' : 'off';
      try { localStorage.setItem('cosmic-effects-' + name, preferences[name]); }
      catch { storageAvailable = false; }
      apply();
    };
    input.addEventListener('change', handler); controls.push([input, handler]);
  }
  const excluded = 'input,textarea,select,button,dialog,[contenteditable],[role=textbox],[data-companion-panel],[data-music-player],[data-private],[data-atelier],[data-studio],[aria-disabled=true]';
  const onClick = (event) => {
    if (effective.click !== 'on' || event.button !== 0 || event.isPrimary === false || (event.pointerType && event.pointerType !== 'mouse') || event.target?.closest?.(excluded)) return;
    // Coordinates exist only on short-lived DOM nodes; they are never collected into history.
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    if (event.clientX < 0 || event.clientY < 0 || event.clientX > innerWidth || event.clientY > innerHeight) return;
    for (const kind of ['ring', 'moon', 'petal']) {
      if (particles.size >= api.maxParticles) break;
      const element = document.createElement('i');
      element.className = 'cyber-click-particle'; element.dataset.kind = kind;
      element.textContent = kind === 'moon' ? '☾' : '';
      element.setAttribute('aria-hidden', 'true');
      element.style.setProperty('--cyber-x', event.clientX + 'px');
      element.style.setProperty('--cyber-y', event.clientY + 'px');
      element.style.setProperty('--cyber-dx', (kind === 'petal' ? 18 : -16) + 'px');
      element.style.setProperty('--cyber-dy', (kind === 'petal' ? -29 : -35) + 'px');
      element.style.setProperty('--cyber-rotate', (kind === 'petal' ? 110 : -22) + 'deg');
      particleLayer.append(element);
      particles.set(element, setTimeout(() => removeParticle(element), 900));
      element.addEventListener('animationend', () => removeParticle(element), { once: true });
    }
  };
  const onStorage = (event) => {
    if (event.key === null) {
      for (const name of names) preferences[name] = 'on';
    } else {
      const name = names.find((item) => event.key === 'cosmic-effects-' + item);
      if (name) preferences[name] = normalize(event.newValue);
    }
    apply();
  };
  const observer = new MutationObserver(apply);
  observer.observe(root, { attributes: true, attributeFilter: ['data-motion'] });
  const mediaListeners = Object.values(media).map((query) => {
    if (query.addEventListener) query.addEventListener('change', apply);
    else query.addListener(apply);
    return query;
  });
  const onHide = () => {
    clearParticles();
    if (!disposed) {
      root.dataset.cyberHidden = 'true';
      effective = { cursor: 'off', click: 'off', stars: 'off' };
      for (const name of names) root.dataset['cyber' + name[0].toUpperCase() + name.slice(1)] = 'off';
    }
  };
  const onShow = () => apply();
  document.addEventListener('pointerdown', onClick, { passive: true });
  document.addEventListener('visibilitychange', apply);
  addEventListener('storage', onStorage);
  addEventListener('pagehide', onHide);
  addEventListener('pageshow', onShow);
  api.dispose = () => {
    disposed = true; clearParticles(); observer.disconnect();
    document.removeEventListener('pointerdown', onClick);
    document.removeEventListener('visibilitychange', apply);
    removeEventListener('storage', onStorage); removeEventListener('pagehide', onHide); removeEventListener('pageshow', onShow);
    controls.forEach(([input, handler]) => input.removeEventListener('change', handler));
    mediaListeners.forEach((query) => { if (query.removeEventListener) query.removeEventListener('change', apply); else query.removeListener(apply); });
    names.forEach((name) => { root.dataset['cyber' + name[0].toUpperCase() + name.slice(1)] = 'off'; });
  };
  apply();
  return api.dispose;
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('cyber-effects', initialize);
  else initialize();
})();
