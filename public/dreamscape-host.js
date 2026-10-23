/* Persistent decorative backdrop. No audio graph, capture, or scroll transform. */
(() => {
 const initialize=async scope=>{
  const {cleanDream,dreamProperties,dreamHour,DEFAULT_DREAM}=await import('/dreamscape-utils.mjs');if(!scope.active)return;
  if(!window.FieldnotesWallpaper){
   let saved={};try{saved=JSON.parse(localStorage.getItem('fieldnotes-wallpaper-v2')||'{}');}catch{}
   let state=cleanDream(saved),root=document.querySelector('[data-site-wallpaper]'),frame=null,ready=false,failed=false,timer=0,lastPointer=0,pinned=false,lastConfig=null,lastPaused=null;
   let hero=null,heroObserver=null,covered=false,pageSuspended=false;
   const reduced=matchMedia('(prefers-reduced-motion: reduce)'),forced=matchMedia('(forced-colors: active)');
   const quiet=()=>reduced.matches||forced.matches||document.documentElement.dataset.motion==='quiet';
   const wallpaperFullscreen=()=>document.fullscreenElement===root||!!root?.contains(document.fullscreenElement);
   const heroCoversViewport=()=>{
    // Without an observer/style API, prefer the existing always-available backdrop.
    if(typeof IntersectionObserver!=='function'||typeof getComputedStyle!=='function'||!hero?.isConnected||wallpaperFullscreen())return false;
    const style=getComputedStyle(hero),color=style.backgroundColor||'';
    const opaque=/^rgb\([^/]*\)$/.test(color)||/^rgba\([^,]+,[^,]+,[^,]+,\s*1(?:\.0+)?\s*\)$/.test(color)||/^rgb\([^)]*\/\s*1(?:\.0+)?\s*\)$/.test(color);
    if(!opaque||Number(style.opacity||1)!==1||style.visibility==='hidden'||style.display==='none')return false;
    const box=hero.getBoundingClientRect(),viewport=document.documentElement;
    // client size excludes traditional scrollbar gutters, unlike innerWidth.
    const width=viewport.clientWidth||innerWidth,height=viewport.clientHeight||innerHeight;
    return box.top<=0&&box.left<=0&&box.right>=width&&box.bottom>=height;
   };
   const measureCover=()=>{const next=heroCoversViewport();if(next!==covered){covered=next;sync();}};
   const bindHero=()=>{
    const next=document.querySelector('[data-scrap-hero]');
    if(next!==hero){heroObserver?.disconnect();heroObserver=null;hero=next;
     if(hero&&typeof IntersectionObserver==='function'){
      heroObserver=new IntersectionObserver(measureCover,{threshold:[0,.01,.25,.5,.75,.99,1]});heroObserver.observe(hero);
     }
    }
    covered=heroCoversViewport();
   };
   const send=(type,extra={})=>{if(!frame?.contentWindow)return false;try{frame.contentWindow.postMessage({type,...extra},location.origin);return true;}catch{return false;}};
   const notify=()=>window.dispatchEvent(new Event('fieldnotes:wallpaper'));
   const pin=()=>{
    if(!root)return;
    // Move the STATIC shell once, before creating its browsing context. Astro swaps
    // body; this document-level decorative layer must never be detached with it.
    if(!pinned){root.removeAttribute('data-astro-transition-persist');root.dataset.wallpaperPinned='yes';document.documentElement.appendChild(root);pinned=true;}
    for(const placeholder of document.querySelectorAll('[data-site-wallpaper]'))if(placeholder!==root)placeholder.remove();
   };
   const remove=()=>{clearTimeout(timer);frame?.remove();frame=null;ready=false;lastConfig=null;lastPaused=null;if(root)root.dataset.ready='false';};
   const fail=()=>{failed=true;remove();notify();};
   const start=()=>{
    if(frame||!root||!state.enabled||!state.dynamic||quiet()||failed||covered||pageSuspended||document.hidden)return;
    frame=document.createElement('iframe');frame.title='枯梦背景';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.setAttribute('allow',"autoplay 'none'; microphone 'none'; camera 'none'; display-capture 'none'");frame.referrerPolicy='no-referrer';frame.src='/wallpapers/kumeng/index.html';root.querySelector('[data-wallpaper-frame]').append(frame);timer=setTimeout(fail,35000);
   };
   const sync=()=>{
    pin();
    const html=document.documentElement;html.dataset.wallpaperEnabled=state.enabled?'yes':'no';html.style.setProperty('--wallpaper-gray',String(state.gray/100));html.style.setProperty('--wallpaper-veil',String(state.veil/100));
    const live=state.enabled&&state.dynamic&&!quiet();if(root){root.dataset.animated=live?'yes':'no';root.dataset.wallpaperCovered=covered?'yes':'no';}if(live)start();
    const properties=dreamProperties(state,{quiet:quiet()}),signature=JSON.stringify(properties),paused=document.hidden||pageSuspended||covered||!live;
    if(signature!==lastConfig&&send('dreamscape:config',{properties}))lastConfig=signature;
    if(paused!==lastPaused&&send('dreamscape:pause',{paused}))lastPaused=paused;
    notify();
   };
   const update=next=>{state=cleanDream({...state,...next});try{localStorage.setItem('fieldnotes-wallpaper-v2',JSON.stringify(state));}catch{}sync();};
   window.addEventListener('message',event=>{
    if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
    if(event.data.type==='dreamscape:bridge'){lastConfig=null;lastPaused=null;sync();}
    if(event.data.type==='dreamscape:ready'){clearTimeout(timer);ready=true;failed=false;root.dataset.ready='true';sync();}
    if(event.data.type==='dreamscape:error')fail();
   });
   document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);forced.addEventListener('change',sync);
   // The observer handles layout changes; scroll/resize also cover tall heroes and
   // exact viewport edges between observer thresholds. Never rebuild the iframe.
   window.addEventListener('scroll',measureCover,{passive:true});window.addEventListener('resize',measureCover,{passive:true});
   document.addEventListener('fullscreenchange',()=>{covered=heroCoversViewport();sync();});
   window.addEventListener('pagehide',()=>{pageSuspended=true;sync();});
   window.addEventListener('pageshow',()=>{pageSuspended=false;bindHero();sync();});
   new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
   window.addEventListener('pointermove',event=>{if(!ready||state.dissolve!=='hover'||quiet()||document.hidden||pageSuspended||covered)return;const now=performance.now();if(now-lastPointer<45)return;lastPointer=now;send('dreamscape:pointer',{x:Math.max(0,Math.min(1,event.clientX/innerWidth)),y:Math.max(0,Math.min(1,event.clientY/innerHeight)),active:true});},{passive:true});
   document.addEventListener('pointerleave',()=>send('dreamscape:pointer',{x:.5,y:.5,active:false}));
   document.addEventListener('astro:after-swap',()=>{bindHero();sync();});
   window.FieldnotesWallpaper={get state(){return state;},get ready(){return ready;},get failed(){return failed;},get covered(){return covered;},quiet,update,retry:()=>{failed=false;remove();sync();},fullscreen:async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await root?.requestFullscreen();}};
   bindHero();sync();
  }
  const core=window.FieldnotesWallpaper,dialog=document.querySelector('[data-wallpaper-dialog]');if(!dialog)return;
  const inputs=[...dialog.querySelectorAll('[data-wallpaper-setting]')],feedback=dialog.querySelector('[data-wallpaper-status]');
  const render=()=>{for(const input of inputs){const key=input.dataset.wallpaperSetting;if(input.type==='checkbox')input.checked=core.state[key];else input.value=String(core.state[key]);}for(const output of dialog.querySelectorAll('[data-wallpaper-output]')){const key=output.dataset.wallpaperOutput;output.textContent=key==='hour'?dreamHour(core.state.hour):core.state[key]+'%';}feedback.textContent=!core.state.enabled?'背景已收起':core.failed?'动态画面不可用，已保留原画':core.quiet()||!core.state.dynamic?'静态原画':core.covered?'封面后静候':core.ready?'光影流动中':'正在铺开梦隙…';};
  for(const input of inputs)scope.listen(input,input.type==='range'?'input':'change',()=>{const key=input.dataset.wallpaperSetting,value=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;core.update(key==='hour'?{hour:value,time:'custom'}:{[key]:value});});
  scope.listen(window,'fieldnotes:wallpaper',render);
  for(const button of document.querySelectorAll('[data-wallpaper-open]'))scope.listen(button,'click',()=>{if(!dialog.open)dialog.showModal();render();});
  scope.listen(dialog.querySelector('[data-wallpaper-close]'),'click',()=>dialog.close());
  scope.listen(dialog,'click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  scope.listen(dialog.querySelector('[data-wallpaper-reset]'),'click',()=>core.update(DEFAULT_DREAM));
  scope.listen(dialog.querySelector('[data-wallpaper-retry]'),'click',()=>core.retry());
  for(const button of document.querySelectorAll('[data-wallpaper-fullscreen]'))scope.listen(button,'click',async()=>{try{dialog.close();await core.fullscreen();}catch{feedback.textContent='当前窗口暂不支持全屏';if(!dialog.open)dialog.showModal();}});
  scope.cleanup(()=>dialog.close());render();
 };
 if(globalThis.FieldnotesRoute)globalThis.FieldnotesRoute.run('dreamscape',initialize);
})();
