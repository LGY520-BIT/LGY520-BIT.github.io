(() => {
  if (window.__unfinishedPublic) return;
  window.__unfinishedPublic = true;
  let pageController, observer, boundAudio, objectURL, active = 0;
  const animations = new Map();
  const tracks = [{title:'月沿散步',file:'audio/moonwalk.wav'}, {title:'星间来信',file:'audio/starlit-letter.wav'}];
  const read = (key, fallback) => {try {return localStorage.getItem(key) ?? fallback} catch {return fallback}};
  const save = (key, value) => {try {localStorage.setItem(key,String(value))} catch {}};
  const base = () => document.body.dataset.base;
  const audio = () => document.getElementById('public-audio');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function releaseAnimations() {for(const animation of animations.values()) animation.cancel();animations.clear()}
  function reflect() {
    const a=audio(); if(!a)return;
    document.body.classList.toggle('playing',!a.paused);
    document.querySelectorAll('[data-track-title]').forEach(el=>el.textContent=a.dataset.title||tracks[active].title);
    document.querySelectorAll('[data-audio-toggle]').forEach(el=>{el.textContent=a.paused?'▶':'Ⅱ';el.setAttribute('aria-label',a.paused?'播放音乐':'暂停音乐')});
    document.querySelectorAll('[data-audio-state]').forEach(el=>el.textContent=a.error?'无法播放，请换一首':a.paused?'已暂停':'正在播放');
    document.querySelectorAll('[data-track]').forEach(el=>el.setAttribute('aria-pressed',String(!objectURL&&Number(el.dataset.track)===active)));
    document.querySelectorAll('[data-seek]').forEach(el=>{el.disabled=!Number.isFinite(a.duration);if(document.activeElement!==el)el.value=Number.isFinite(a.duration)&&a.duration>0?String(a.currentTime/a.duration*100):'0'});
    document.querySelectorAll('[data-volume]').forEach(el=>el.value=String(a.volume));
  }
  async function play() {try {await audio().play()}catch {const el=document.querySelector('[data-audio-state]');if(el)el.textContent='播放未成功，请再次点击'}reflect()}
  function select(index, autoplay=true) {
    const a=audio();if(!a)return;
    if(objectURL){URL.revokeObjectURL(objectURL);objectURL=undefined}
    active=(index+tracks.length)%tracks.length;
    a.src=base()+tracks[active].file;a.dataset.title=tracks[active].title;
    reflect();if(autoplay)void play();
  }
  function preferences() {
    const motion=read('um-public-motion','on');document.documentElement.dataset.motion=motion;
    const size=Math.min(28,Math.max(16,Number(read('um-public-font','19'))||19));
    const width=Math.min(1280,Math.max(620,Number(read('um-public-width','860'))||860));
    document.documentElement.style.setProperty('--reading-size',`${size}px`);
    document.documentElement.style.setProperty('--reading-width',`${width}px`);
    document.body.classList.toggle('hide-dock',read('um-public-dock','show')==='hide');
    document.body.classList.toggle('nav-folded',read('um-public-nav','open')==='closed');
    const q=s=>document.querySelector(s);
    if(q('[data-motion-setting]'))q('[data-motion-setting]').value=motion;
    if(q('[data-font-setting]'))q('[data-font-setting]').value=size;
    if(q('[data-width-setting]'))q('[data-width-setting]').value=width;
    if(q('[data-font-output]'))q('[data-font-output]').textContent=`${size} px`;
    if(q('[data-width-output]'))q('[data-width-output]').textContent=`${width} px`;
    if(q('[data-hide-dock]'))q('[data-hide-dock]').checked=document.body.classList.contains('hide-dock');
    const nav=q('[data-nav-toggle]');if(nav){const open=!document.body.classList.contains('nav-folded');nav.setAttribute('aria-expanded',String(open));nav.setAttribute('aria-label',open?'收起导航':'展开导航');nav.textContent=open?'⌃':'⌄'}
    if(motion==='off'||reduced.matches)releaseAnimations();
  }
  function init() {
    pageController?.abort(); observer?.disconnect();releaseAnimations();pageController=new AbortController();const {signal}=pageController;
    preferences();
    const a=audio();
    if(a&&a!==boundAudio){boundAudio=a;a.volume=Math.min(1,Math.max(0,Number(read('um-public-volume','0.6'))||0));for(const name of ['play','pause','timeupdate','loadedmetadata','error','volumechange'])a.addEventListener(name,reflect);a.addEventListener('ended',()=>select(active+1));if(!a.getAttribute('src'))select(0,false)}
    reflect();
    const on=(selector,event,fn)=>document.querySelectorAll(selector).forEach(el=>el.addEventListener(event,fn,{signal}));
    on('[data-audio-toggle]','click',()=>a.paused?void play():a.pause());on('[data-audio-next]','click',()=>select(active+1));
    on('[data-track]','click',e=>select(Number(e.currentTarget.dataset.track)));
    on('[data-seek]','input',e=>{if(Number.isFinite(a.duration))a.currentTime=Number(e.currentTarget.value)/100*a.duration});
    on('[data-volume]','input',e=>{a.volume=Number(e.currentTarget.value);save('um-public-volume',a.volume)});
    on('[data-local-audio]','change',e=>{const file=e.currentTarget.files?.[0];if(!file)return;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(file);a.src=objectURL;a.dataset.title=file.name.replace(/\.[^.]+$/,'');void play()});
    on('[data-nav-toggle]','click',()=>{save('um-public-nav',document.body.classList.contains('nav-folded')?'open':'closed');preferences()});
    on('[data-settings-open]','click',()=>document.querySelector('.display-settings').showModal());
    on('.display-settings','click',e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close()});
    for(const [attr,key] of [['motion','motion'],['font','font'],['width','width']])on(`[data-${attr}-setting]`,'input',e=>{save(`um-public-${key}`,e.currentTarget.value);preferences()});
    on('[data-hide-dock]','change',e=>{save('um-public-dock',e.currentTarget.checked?'hide':'show');preferences()});
    document.addEventListener('keydown',e=>{if(e.key==='F8'&&!/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)){e.preventDefault();save('um-public-dock',document.body.classList.contains('hide-dock')?'show':'hide');preferences()}},{signal});
    on('[data-archive-search]','input',e=>{const text=e.currentTarget.value.trim().toLocaleLowerCase();let count=0;document.querySelectorAll('[data-search-entry]').forEach(el=>{el.hidden=!el.dataset.searchText.toLocaleLowerCase().includes(text);if(!el.hidden)count++});document.querySelector('[data-search-status]').textContent=count?`${count} 篇文字`:'没有找到匹配的文章'});
    const updateHeader=()=>document.querySelector('.masthead')?.classList.toggle('scrolled',scrollY>30);window.addEventListener('scroll',updateHeader,{passive:true,signal});updateHeader();
    if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{for(const entry of entries){const el=entry.target;if(!entry.isIntersecting){animations.get(el)?.cancel();animations.delete(el);continue}if(reduced.matches||document.documentElement.dataset.motion==='off'||!el.animate)continue;animations.get(el)?.cancel();const animation=el.animate([{transform:'translateY(18px)',opacity:.55},{transform:'none',opacity:1}],{duration:560,easing:'cubic-bezier(.2,.7,.2,1)',fill:'none'});animations.set(el,animation);animation.finished.then(()=>{if(animations.get(el)===animation){animation.cancel();animations.delete(el)}},()=>{})}},{threshold:0,rootMargin:'0px'});document.querySelectorAll('[data-reveal]').forEach(el=>observer.observe(el))}
  }
  reduced.addEventListener('change',()=>{if(reduced.matches)releaseAnimations()});
  document.addEventListener('astro:before-swap',()=>{pageController?.abort();observer?.disconnect();releaseAnimations()});
  document.addEventListener('astro:page-load',init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
