/* Visual chrome only. Playback, character state and per-capsule preferences are untouched. */
(() => {
  'use strict';
  const KEY='fieldnotes-clean-view-v1';
  const clean=value=>({hidden:value?.hidden===true,hints:value?.hints===true,progress:value?.progress===true});
  const parse=value=>{try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?clean(parsed):null;}catch{return null;}};
  const typing=target=>Boolean(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]'));
  const initialize=scope=>{
    const listen=(target,...args)=>scope?scope.listen(target,...args):target?.addEventListener(...args);
    if(!window.FieldnotesCleanView){
      let state=null,returnFocus=null;
      try{state=parse(localStorage.getItem(KEY));}catch{}
      if(!state){const d=document.documentElement.dataset;state=clean({hidden:d.uiHidden==='yes',hints:d.uiHints==='yes',progress:d.uiProgress==='yes'});}
      const visibleFocus=target=>{
        if(!target?.focus||target.disabled||target.isConnected===false||target.closest?.('[hidden],[inert]'))return false;
        if(target.getClientRects&&target.getClientRects().length===0)return false;
        if(typeof getComputedStyle==='function'){const style=getComputedStyle(target);if(style.visibility==='hidden'||style.visibility==='collapse'||style.display==='none')return false;}
        target.focus({preventScroll:true});return true;
      };
      const render=()=>{
        const root=document.documentElement;
        root.dataset.uiHidden=state.hidden?'yes':'no';root.dataset.uiHints=state.hints?'yes':'no';root.dataset.uiProgress=state.progress?'yes':'no';
        for(const checkbox of document.querySelectorAll('[data-clean-hints]'))checkbox.checked=state.hints;
        for(const checkbox of document.querySelectorAll('[data-clean-progress]'))checkbox.checked=state.progress;
        for(const button of document.querySelectorAll('[data-clean-toggle]')){button.setAttribute('aria-pressed',String(state.hidden));button.setAttribute('aria-label',state.hidden?'恢复界面（F8）':'隐藏浮动界面（F8）');}
        for(const label of document.querySelectorAll('[data-clean-label]'))label.textContent=state.hidden?'恢复界面':'一键隐藏界面';
        for(const button of document.querySelectorAll('[data-clean-restore]')){button.hidden=!state.hidden;button.tabIndex=state.hidden?0:-1;button.setAttribute('aria-hidden',String(!state.hidden));}
        for(const link of document.querySelectorAll('.scrap-scroll'))if(!link.hasAttribute('aria-label'))link.setAttribute('aria-label','向下浏览内容');
      };
      const set=(patch,{persist=true,focus=false}={})=>{
        const wasHidden=state.hidden;state=clean({...state,...patch});
        if(state.hidden&&!wasHidden){returnFocus=document.activeElement;for(const dialog of document.querySelectorAll('dialog[open]')){try{dialog.close();}catch{}}}
        render();
        if(persist)try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}
        if(focus&&state.hidden)visibleFocus(document.querySelector('[data-clean-restore]'));
        else if(focus&&wasHidden&&!state.hidden&&!visibleFocus(returnFocus)){
          const main=document.querySelector('#main');if(main){if(!main.hasAttribute('tabindex'))main.setAttribute('tabindex','-1');visibleFocus(main);}
        }
        window.dispatchEvent(new CustomEvent('fieldnotes:clean-view',{detail:{...state}}));
      };
      window.FieldnotesCleanView=Object.freeze({get state(){return {...state};},render,set,toggle:()=>set({hidden:!state.hidden},{focus:true}),restore:()=>set({hidden:false},{focus:true})});
    }
    const core=window.FieldnotesCleanView;
    for(const button of document.querySelectorAll('[data-clean-toggle]'))listen(button,'click',()=>core.toggle());
    for(const button of document.querySelectorAll('[data-clean-restore]'))listen(button,'click',()=>core.restore());
    for(const checkbox of document.querySelectorAll('[data-clean-hints]'))listen(checkbox,'change',()=>core.set({hints:checkbox.checked}));
    for(const checkbox of document.querySelectorAll('[data-clean-progress]'))listen(checkbox,'change',()=>core.set({progress:checkbox.checked}));
    listen(document,'keydown',event=>{
      if(event.key!=='F8'||event.repeat||event.isComposing||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||typing(event.target))return;
      event.preventDefault();core.toggle();
    });
    listen(window,'storage',event=>{if(event.key===KEY||event.key===null)core.set(parse(event.newValue)||clean({}),{persist:false});});
    core.render();
  };
  if(globalThis.FieldnotesRoute)globalThis.FieldnotesRoute.run('clean-view',initialize);else initialize();
})();
