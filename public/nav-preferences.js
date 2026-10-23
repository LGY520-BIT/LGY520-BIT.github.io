/* IDs only are persisted; route-scoped handlers never replace navigation or audio nodes. */
(() => {
 'use strict';
 const KEY='fieldnotes-nav-items-v1';
 const parse=(value,ids)=>{try{const p=JSON.parse(value);if(!p||p.version!==1||!Array.isArray(p.items))return null;const next=ids.filter(id=>p.items.includes(id));return p.items.length===0||next.length?next:null;}catch{return null;}};
 const createCore=ids=>{
  let items=ids.slice();try{items=parse(localStorage.getItem(KEY),ids)||items;}catch{}
  const normalize=value=>{if(!Array.isArray(value))return ids.slice();const next=ids.filter(id=>value.includes(id));return value.length===0||next.length?next:ids.slice();};
  const canFocus=node=>{if(!node?.focus||node.hidden||node.isConnected===false||node.closest?.('[hidden],[inert]'))return false;if(node.getClientRects&&!node.getClientRects().length)return false;if(typeof getComputedStyle==='function'){const s=getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse')return false;}return true;};
  const render=()=>{
   const links=[...document.querySelectorAll('[data-nav-item]')],old=links.find(link=>link===document.activeElement);
   for(const link of links)link.hidden=!items.includes(link.dataset.navItem);
   for(const box of document.querySelectorAll('[data-nav-choice]'))box.checked=items.includes(box.dataset.navChoice);
   for(const count of document.querySelectorAll('[data-nav-count]'))count.textContent=items.length?`已选 ${items.length} 项`:'已选 0 项 · 入口保留在更多中';
   if(old?.hidden){const target=[...links,document.querySelector('[data-nav-more] summary'),document.querySelector('[data-nav-restore-group="nav"]')].find(canFocus);target?.focus({preventScroll:true});}
  };
  return Object.freeze({get items(){return items.slice();},render,set(next,{persist=true}={}){items=normalize(next);if(persist)try{localStorage.setItem(KEY,JSON.stringify({version:1,items}));}catch{}render();}});
 };
 const initialize=scope=>{
  const links=[...document.querySelectorAll('[data-nav-item]')],ids=links.map(link=>link.dataset.navItem);if(!ids.length)return;
  const on=(target,...args)=>scope?scope.listen(target,...args):target?.addEventListener(...args);
  if(!window.FieldnotesNavPreferences)window.FieldnotesNavPreferences=createCore(ids);
  const core=window.FieldnotesNavPreferences;
  for(const box of document.querySelectorAll('[data-nav-choice]'))on(box,'change',()=>core.set(box.checked?[...core.items,box.dataset.navChoice]:core.items.filter(id=>id!==box.dataset.navChoice)));
  for(const button of document.querySelectorAll('[data-nav-select-all]'))on(button,'click',()=>core.set(ids));
  for(const button of document.querySelectorAll('[data-nav-select-common]'))on(button,'click',()=>core.set(ids.filter(id=>['home','archive','anime','music','space','links'].includes(id))));
  on(window,'storage',event=>{if(event.key!==KEY&&event.key!==null)return;let value=event.newValue;if(event.key===null)try{value=localStorage.getItem(KEY);}catch{}core.set(parse(value,ids)||ids,{persist:false});});
  for(const more of document.querySelectorAll('[data-nav-more]')){
   const close=()=>{more.open=false;};
   for(const link of more.querySelectorAll('[data-nav-catalog-link]'))on(link,'click',close);
   for(const button of document.querySelectorAll('[data-nav-settings]'))on(button,'click',close);
   on(document,'pointerdown',event=>{if(more.open&&!more.contains(event.target))close();});
   on(document,'keydown',event=>{if(event.key==='Escape'&&more.open){close();more.querySelector('summary')?.focus({preventScroll:true});}});
   on(window,'fieldnotes:clean-view',event=>{if(event.detail?.hidden)close();});
   for(const button of document.querySelectorAll('[data-nav-fold],[data-nav-fold-group]'))on(button,'click',close);
   scope?.cleanup(close);
  }
  core.render();
 };
 if(globalThis.FieldnotesRoute)globalThis.FieldnotesRoute.run('nav-preferences',initialize);else initialize();
})();
