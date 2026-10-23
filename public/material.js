(() => {
  'use strict';
  const normalize = value => ['liquid','mosa','solid'].includes(value)?value:'liquid';
  const effective = (value,reduced=false,forced=false) => reduced||forced?'solid':normalize(value);
  globalThis.MoonlightMaterial=Object.freeze({normalize,effective});
  if(typeof document==='undefined')return;
  const initialize = (scope) => {
    const on = (target, ...args) => scope ? scope.listen(target, ...args) : target?.addEventListener(...args);
    const raf = (...args) => scope ? scope.frame(...args) : requestAnimationFrame(...args);

  const root=document.documentElement;
  const reduced=matchMedia('(prefers-reduced-transparency: reduce)');
  const forced=matchMedia('(forced-colors: active)');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(pointer: fine)');
  const buttons=[...document.querySelectorAll('[data-material-choice]')];
  let preference='liquid',saveWarning='';
  try{preference=normalize(localStorage.getItem('cosmic-material'));}catch{saveWarning='浏览器存储不可用，刷新后不会保留。';}
  const names={liquid:'液态玻璃',mosa:'Mosa 磨砂',solid:'纯色模式'};
  const apply=()=>{
    const material=effective(preference,reduced.matches,forced.matches);
    root.dataset.material=material;root.dataset.materialPreference=preference;
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.materialChoice===preference)));
    for(const label of document.querySelectorAll('[data-material-name]'))label.textContent=names[material];
    for(const label of document.querySelectorAll('[data-material-status]'))label.textContent=`${reduced.matches||forced.matches?'系统偏好优先，实际使用纯色表面。':`已使用${names[material]}，只影响本机显示。`}${saveWarning}`;
  };
  buttons.forEach(button=>on(button, 'click',()=>{
    preference=normalize(button.dataset.materialChoice);
    try{localStorage.setItem('cosmic-material',preference);saveWarning='';}catch{saveWarning='浏览器存储不可用，刷新后不会保留。';}
    apply();
  }));
  for(const media of [reduced,forced]){if(media.addEventListener)on(media, 'change',apply);else { media.addListener?.(apply); scope?.cleanup(()=>media.removeListener?.(apply)); }}
  apply();
  // Ephemeral per-card highlight only: no pointer log, persistence, network or text capture.
  let frame=0,pending=null;
  on(document, 'pointermove',event=>{
    if(event.pointerType!=='mouse'||!fine.matches||motion.matches||document.hidden||root.dataset.motion==='quiet'||root.dataset.material!=='liquid')return;
    const card=event.target?.closest?.('.refined-entry,.refined-profile,.refined-sidebar-card,.atelier-card');
    if(!card||event.target.closest('input,textarea,select,[contenteditable]'))return;
    const rect=card.getBoundingClientRect();if(!rect.width||!rect.height)return;
    pending={card,x:Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)),y:Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100))};
    if(frame)return;
    frame=raf(()=>{frame=0;const point=pending;pending=null;if(!point)return;point.card.style.setProperty('--glass-x',`${point.x.toFixed(1)}%`);point.card.style.setProperty('--glass-y',`${point.y.toFixed(1)}%`);});
  },{passive:true});
  const stop=()=>{if(frame)cancelAnimationFrame(frame);frame=0;pending=null;};
  scope?.cleanup(stop);
  on(document, 'visibilitychange',()=>{if(document.hidden)stop();});
  on(window, 'pagehide',stop,{once:true});
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('material', initialize);
  else initialize();
})();
