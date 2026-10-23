// Adapter for MIT glassy-liquid 0.1.0; no framework or remote runtime required.
// The original package bytes and license are kept under /vendor/glassy-liquid/.
import { glass } from './vendor/glassy-liquid/glassy-liquid.min.js';
function initializeGlass(){
const root=document.documentElement;
const reduced=matchMedia('(prefers-reduced-transparency: reduce)');
const forced=matchMedia('(forced-colors: active)');
const surfaces=new Map();
// Never apply the refraction engine to both the player wrapper and its popup.
const targets='[data-companion-panel],.material-preview';
let frame=0,disposed=false;
const enabled=()=>root.dataset.material==='liquid'&&!reduced.matches&&!forced.matches&&!document.hidden;
function remove(element,record){
 record.surface.destroy();delete element.dataset.projectGlass;
 if(element.style.position===record.changedPosition)element.style.position=record.position;
 if(element.style.zIndex===record.changedZIndex)element.style.zIndex=record.zIndex;
 surfaces.delete(element);
}
function sync(){
 frame=0;
 if(disposed)return;
 const appearance=root.dataset.theme==='dark'?'dark':'light';
 for(const [element,record] of surfaces){
  if(!enabled()||!element.isConnected||!element.getClientRects().length||element.closest('[hidden]'))remove(element,record);
  else if(record.appearance!==appearance){record.surface.set({appearance});record.appearance=appearance;}
 }
 if(enabled())for(const element of document.querySelectorAll(targets)){
  if(surfaces.has(element)||!element.getClientRects().length||element.closest('[hidden]'))continue;
  const position=element.style.position,zIndex=element.style.zIndex;
  try{
   element.dataset.projectGlass='active';
   const isHeader=element.classList.contains('cosmic-header');
   const surface=glass(element,{appearance,material:'clear',radius:Math.max(0,parseFloat(getComputedStyle(element).borderRadius)||0),bezel:12,refraction:isHeader?8:12,blur:9,dispersion:0,specular:.85,shadow:false});
   surfaces.set(element,{surface,position,zIndex,changedPosition:element.style.position,changedZIndex:element.style.zIndex,appearance});
  }catch{
   delete element.dataset.projectGlass;element.style.position=position;element.style.zIndex=zIndex;
  }
 }
 const kinds=[...new Set([...surfaces.values()].map(row=>row.surface.engine))];
 for(const label of document.querySelectorAll('[data-material-project-status]'))label.textContent=!enabled()?'':kinds.includes('backdrop')?'液态玻璃':kinds.length?'磨砂':'磨砂';
}
const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(sync);};
const observer=new MutationObserver(schedule);
observer.observe(root,{subtree:true,attributes:true,attributeFilter:['data-material','data-theme','hidden','open']});
for(const media of [reduced,forced])media.addEventListener?.('change',schedule);
document.addEventListener('visibilitychange',schedule);
window.addEventListener('pageshow',schedule);
const clear=()=>{if(frame)cancelAnimationFrame(frame);frame=0;for(const [element,record] of surfaces)remove(element,record);};
window.addEventListener('pagehide',clear);
document.addEventListener('astro:after-swap',schedule);
schedule();
return ()=>{
 disposed=true;clear();observer.disconnect();
 for(const media of [reduced,forced])media.removeEventListener?.('change',schedule);
 document.removeEventListener('visibilitychange',schedule);
 document.removeEventListener('astro:after-swap',schedule);
 window.removeEventListener('pageshow',schedule);window.removeEventListener('pagehide',clear);
};
}
if(window.FieldnotesRoute)window.FieldnotesRoute.run('project-glass',initializeGlass);
else initializeGlass();
