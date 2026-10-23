/* Persistent music presentation only: never change the underlying audio session. */
(() => {
  'use strict';
  if (window.FieldnotesFloatingWidgets) { window.FieldnotesFloatingWidgets.sync(); return; }
  const key = 'fieldnotes-music-widget-v1';
  const profilesKey = 'fieldnotes-music-widget-devices-v1';
  const session = document.querySelector('[data-music-session]');
  const player = session?.querySelector('[data-music-player]');
  const handle = player?.querySelector('[data-music-dock-drag]');
  const size = player?.querySelector('[data-music-dock-scale]');
  const fold = player?.querySelector('[data-music-dock-fold]');
  if (!session || !player || !handle || !size || !fold) return;
  const read = () => { try { const backup = sessionStorage.getItem(key); if (backup !== null) return backup; } catch {} try { return localStorage.getItem(key); } catch { return null; } };
  const clean = raw => {
    let value; try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch {}
    if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
    return { x: Number.isFinite(value.x) ? value.x : null, y: Number.isFinite(value.y) ? value.y : null, scale: [.7, .85, 1].includes(value.scale) ? value.scale : .85, folded: value.folded === true };
  };
  const profileRead = () => { try { const value=JSON.parse(sessionStorage.getItem(profilesKey) || localStorage.getItem(profilesKey) || 'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:null; } catch { return null; } };
  let profiles=profileRead();if(!profiles||typeof profiles!=='object'||Array.isArray(profiles))profiles={};
  const device=()=>innerWidth<=600?'mobile':'desktop';
  const legacy=clean(read());
  const profileState=name=>profiles[name]?clean(profiles[name]):clean(name==='desktop'?legacy:{scale:legacy.scale,folded:legacy.folded});
  let deviceName=device(),state = profileState(deviceName), drag = null, suppressClick = false, boundsQueued = false;
  const coarsePointer = window.matchMedia?.('(any-pointer: coarse)');
  // A saved desktop size must never shrink the actual touch hit areas.
  const touchPresentation = () => coarsePointer?.matches === true || innerWidth <= 600;
  const write=(name,value)=>{try{localStorage.setItem(name,value);try{sessionStorage.removeItem(name);}catch{}}catch{try{sessionStorage.setItem(name,value);}catch{}}};
  const persist = () => {
    profiles[deviceName]={...state};write(profilesKey,JSON.stringify(profiles));
    // Keep the original desktop preference readable by earlier versions; mobile
    // movement never overwrites it merely because the window became narrow.
    if(deviceName==='desktop')write(key,JSON.stringify(state));
  };
  const switchDevice=()=>{const next=device();if(next===deviceName)return;profiles[deviceName]={...state};deviceName=next;state=profileState(next);};
  const docked = () => session.dataset.musicLocation === 'dock';
  const visible = () => document.documentElement.dataset.uiHidden !== 'yes';
  const place = (x, y, remember = false) => {
    if (!docked() || !visible()) return;
    const rect = session.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    state.x = Math.max(8, Math.min(Math.max(8, innerWidth - rect.width - 8), Number.isFinite(x) ? x : rect.left));
    state.y = Math.max(8, Math.min(Math.max(8, innerHeight - rect.height - 8), Number.isFinite(y) ? y : rect.top));
    session.style.left = `${state.x}px`; session.style.top = `${state.y}px`; session.style.right = 'auto'; session.style.bottom = 'auto';
    if (remember) persist();
  };
  const sync = () => {
    switchDevice();
    player.dataset.dockFolded = state.folded ? 'yes' : 'no';
    fold.setAttribute('aria-expanded', String(!state.folded)); fold.setAttribute('aria-label', state.folded ? '展开音乐条' : '收起音乐条');
    const touch = touchPresentation();
    session.dataset.widgetTouch = touch ? 'yes' : 'no';
    session.dataset.widgetDevice = deviceName;
    session.style.setProperty('--music-widget-scale', String(state.scale));
    session.style.setProperty('--music-widget-effective-scale', String(touch ? 1 : state.scale));
    size.textContent = `${Math.round(state.scale * 100)}%`; size.setAttribute('aria-label', `${deviceName==='mobile'?'手机':touch?'桌面':'音乐'}插件${deviceName==='mobile'?'宽度':'大小'} ${Math.round(state.scale * 100)}%；点击切换`);
    size.setAttribute('title', deviceName==='mobile'?'切换手机音乐条宽度，触控按钮保持易点按大小':touch ? `触屏保持易点按大小；桌面大小 ${Math.round(state.scale * 100)}%` : '切换插件大小');
    if (docked()) {
      const rect=session.getBoundingClientRect();
      place(state.x,Number.isFinite(state.y)?state.y:deviceName==='mobile'?innerHeight-rect.height-12:state.y);
    }
    else for (const name of ['left', 'top', 'right', 'bottom']) session.style.removeProperty(name);
  };
  const queueBounds = () => {
    if (boundsQueued) return;
    boundsQueued = true;
    const run = () => { boundsQueued = false; if (!drag && docked() && visible()) place(state.x, state.y); };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run); else run();
  };
  const stop = event => {
    if (!drag || event && event.pointerId !== drag.id) return;
    const previous = drag; drag = null; session.dataset.widgetDragging = 'no';
    try { if (handle.hasPointerCapture?.(previous.id)) handle.releasePointerCapture(previous.id); } catch {}
    sync();
    if (previous.moved) { suppressClick = true; if (docked() && visible()) { const rect = session.getBoundingClientRect(); place(rect.left, rect.top, true); } else persist(); }
    queueBounds();
  };
  handle.addEventListener('pointerdown', event => {
    if (!docked() || !visible() || event.button !== 0 || event.isPrimary === false || drag) return;
    const rect = session.getBoundingClientRect(); suppressClick = false;
    drag = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top, x: event.clientX, y: event.clientY, moved: false };
    try { handle.setPointerCapture?.(event.pointerId); } catch {}
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) drag.moved = true;
    if (!drag.moved) return;
    session.dataset.widgetDragging = 'yes'; event.preventDefault(); place(event.clientX - drag.dx, event.clientY - drag.dy);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(type, stop);
  handle.addEventListener('click', event => { if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopPropagation?.(); suppressClick = false; } });
  handle.addEventListener('keydown', event => {
    if (!docked() || !visible() || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 40 : 10, changes = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!Object.hasOwn(changes, event.key)) return;
    event.preventDefault(); const rect = session.getBoundingClientRect(), [dx, dy] = changes[event.key]; place(rect.left + dx, rect.top + dy, true);
  });
  size.addEventListener('click', () => { state.scale = [.7, .85, 1][([.7, .85, 1].indexOf(state.scale) + 1) % 3]; sync(); persist(); });
  // The native music controller already owns this button's folding action.
  fold.addEventListener('click', () => { state.folded = player.dataset.dockFolded === 'yes'; sync(); persist(); });
  window.addEventListener('resize', () => { if (drag) return; sync(); if (docked() && visible()) persist(); });
  const pointerChanged = () => { if (drag) stop(); sync(); };
  if (coarsePointer?.addEventListener) coarsePointer.addEventListener('change', pointerChanged);
  else coarsePointer?.addListener?.(pointerChanged);
  // Container size can change after fonts, folding or a persistent route swap.
  // Observe size only, coalesce callbacks, and never reposition an active drag.
  if (typeof ResizeObserver === 'function') new ResizeObserver(queueBounds).observe(session);
  document.fonts?.ready?.then(queueBounds).catch(() => {});
  window.addEventListener('storage', event => {
    if(event.key===profilesKey||event.key===null){profiles=profileRead()||{};state=profileState(deviceName);sync();}
    else if(event.key===key&&deviceName==='desktop'){state=clean(event.newValue);profiles.desktop={...state};sync();}
  });
  document.addEventListener('astro:before-swap', () => stop());
  document.addEventListener('astro:after-swap', sync);
  document.addEventListener('astro:page-load', sync);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  new MutationObserver(() => { if (!visible()) stop(); else sync(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-hidden'] });
  window.FieldnotesFloatingWidgets = { sync };
  sync();
})();
