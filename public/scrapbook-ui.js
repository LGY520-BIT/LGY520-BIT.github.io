/* Local time preferences and one boundary-aligned visible-page clock; no telemetry. */
(() => {
  'use strict';
  const KEY='fieldnotes-clock-v1';
  const parse=value=>{
    if(typeof value!=='string'||value.length>256)return null;
    try{const data=JSON.parse(value);return data&&typeof data==='object'&&!Array.isArray(data)&&data.version===1&&typeof data.showSeconds==='boolean'?data.showSeconds:null;}catch{return null;}
  };
  const read=()=>{try{const raw=localStorage.getItem(KEY);return {value:parse(raw),missing:raw===null};}catch{return {value:null,missing:false};}};
  const initialize = (scope) => {
    const on = (target, ...args) => scope ? scope.listen(target, ...args) : target?.addEventListener(...args);
    const delay = (...args) => scope ? scope.timeout(...args) : setTimeout(...args);
    const clock=document.querySelector('[data-scrap-clock]');
    const date=document.querySelector('[data-scrap-date]');
    const copy=document.querySelector('[data-scrap-type]');
    const controls=[...(document.querySelectorAll?.('[data-clock-seconds]')||[])];
    if(!clock&&!copy&&!controls.length)return;
    const saved=read();
    const preference=window.FieldnotesClockPreferences||(window.FieldnotesClockPreferences={showSeconds:saved.value===true,persisted:saved.value!==null,volatile:false});
    if(!preference.volatile&&saved.value!==null){preference.showSeconds=saved.value;preference.persisted=true;}
    else if(!preference.volatile&&saved.missing&&preference.persisted){preference.showSeconds=false;preference.persisted=false;}
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const phrase='collect a little starlight.';
    let tick=0,type=0,index=0,disposed=false,typed=false,pageSuspended=false;
    const quiet=()=>reduced.matches||document.documentElement.dataset.motion==='quiet';
    const stopClock=()=>{clearTimeout(tick);tick=0;};
    const stop=()=>{stopClock();clearTimeout(type);type=0;};
    const renderPreference=()=>{
      for(const control of controls)control.checked=preference.showSeconds;
      if(clock?.dataset)clock.dataset.clockFormat=preference.showSeconds?'seconds':'minutes';
    };
    const time=()=>{
      stopClock();
      if(disposed||pageSuspended||!clock||document.visibilityState==='hidden')return;
      const now=new Date(),pad=value=>String(value).padStart(2,'0');
      // Manual local fields avoid locale-specific midnight "24:00" and hour-cycle changes.
      clock.textContent=[pad(now.getHours()),pad(now.getMinutes()),...(preference.showSeconds?[pad(now.getSeconds())]:[])].join(':');
      if(date)date.textContent=now.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
      const interval=preference.showSeconds?1000:60000;
      tick=delay(time,interval-((now.getTime()%interval)+interval)%interval);
    };
    const setSeconds=(value,{persist=false}={})=>{
      preference.showSeconds=value===true;
      if(persist){
        try{localStorage.setItem(KEY,JSON.stringify({version:1,showSeconds:preference.showSeconds}));preference.persisted=true;preference.volatile=false;}
        catch{preference.persisted=false;preference.volatile=true;}
      }
      renderPreference();time();
    };
    const typeNote=()=>{
      if(disposed||pageSuspended||document.visibilityState==='hidden'||!copy)return;
      if(quiet()){copy.textContent=phrase;typed=true;return;}
      copy.textContent=phrase.slice(0,++index);
      if(index<phrase.length)type=delay(typeNote,58);else typed=true;
    };
    const resume=()=>{stop();if(document.visibilityState!=='hidden'&&!disposed&&!pageSuspended){renderPreference();time();if(!typed)typeNote();}};
    const motion=()=>{if(quiet()&&copy){clearTimeout(type);copy.textContent=phrase;typed=true;}};
    const observer=copy?new MutationObserver(motion):null;
    observer?.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
    scope?.cleanup(()=>{disposed=true;stop();observer?.disconnect();});
    for(const control of controls)on(control,'change',()=>setSeconds(control.checked,{persist:true}));
    on(window,'storage',event=>{
      if(event.key!==KEY&&event.key!==null)return;
      if(event.key===null||event.newValue===null){preference.persisted=false;preference.volatile=false;setSeconds(false);return;}
      const value=parse(event.newValue);
      if(value!==null){preference.persisted=true;preference.volatile=false;setSeconds(value);}
    });
    on(document,'visibilitychange',resume);
    if(copy)on(reduced,'change',motion);
    on(window,'pagehide',()=>{pageSuspended=true;stop();});
    on(window,'pageshow',()=>{pageSuspended=false;resume();});
    on(window,'unload',()=>{disposed=true;stop();observer?.disconnect();});
    renderPreference();resume();
  };
  if(globalThis.FieldnotesRoute)globalThis.FieldnotesRoute.run('scrapbook-ui',initialize);
  else initialize();
})();
