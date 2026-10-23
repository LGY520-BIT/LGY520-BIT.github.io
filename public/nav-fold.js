/* Three independent capsules; no scroll interception or playback lifecycle changes. */
(() => {
  'use strict';
  const initialize = (scope) => {
    const on = (target, ...args) => scope ? scope.listen(target, ...args) : target?.addEventListener(...args);

  const root=document.documentElement, bar=document.querySelector('[data-foldable-nav]');
  const fold=document.querySelector('[data-nav-fold]'), restore=document.querySelector('[data-nav-restore]');
  if(!bar||!fold||!restore)return;
  const names=['brand','nav','tools'], key='fieldnotes-header-fold-v1';
  const groups=Object.fromEntries(names.map(name=>[name,document.querySelector(`[data-shell-group="${name}"]`)]));
  if(names.every(name=>groups[name])){
    const folds=Object.fromEntries(names.map(name=>[name,document.querySelector(`[data-nav-fold-group="${name}"]`)]));
    const restores=Object.fromEntries(names.map(name=>[name,document.querySelector(`[data-nav-restore-group="${name}"]`)]));
    if(names.some(name=>!folds[name]||!restores[name]))return;
    const clean=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(names.map(name=>[name,value[name]===true])):null;
    const parse=value=>{try{return clean(JSON.parse(value));}catch{return null;}};
    const whole=value=>Object.fromEntries(names.map(name=>[name,value]));
    function read(){try{return parse(localStorage.getItem(key))||whole(localStorage.getItem('scrapbook-nav-collapsed')==='yes');}catch{return whole(root.dataset.navCollapsed==='yes');}}
    let state=read();
    const focus=target=>target?.focus({preventScroll:true});
    function apply(next,focusGroup=null,persist=true){
      state=clean(next)||whole(false);const all=names.every(name=>state[name]),any=names.some(name=>state[name]);
      root.dataset.navCollapsed=all?'yes':'no';bar.inert=all;bar.setAttribute('aria-hidden',String(all));
      for(const name of names){
        const collapsed=state[name];root.dataset['shell'+name[0].toUpperCase()+name.slice(1)+'Collapsed']=collapsed?'yes':'no';
        groups[name].inert=collapsed;groups[name].setAttribute('aria-hidden',String(collapsed));
        folds[name].setAttribute('aria-expanded',String(!collapsed));restores[name].setAttribute('aria-expanded',String(!collapsed));
        restores[name].hidden=!collapsed;restores[name].tabIndex=collapsed?0:-1;restores[name].setAttribute('aria-hidden',String(!collapsed));
      }
      fold.hidden=all;fold.setAttribute('aria-expanded',String(!all));restore.hidden=!any;restore.tabIndex=any?0:-1;restore.setAttribute('aria-expanded',String(!any));restore.setAttribute('aria-hidden',String(!any));
      if(persist)try{localStorage.setItem(key,JSON.stringify(state));localStorage.setItem('scrapbook-nav-collapsed',all?'yes':'no');}catch{}
      if(focusGroup==='all')focus(all?restore:fold);
      else if(names.includes(focusGroup))focus(state[focusGroup]?restores[focusGroup]:folds[focusGroup]);
    }
    on(fold,'click',()=>apply(whole(true),'all'));
    on(restore,'click',()=>apply(whole(false),'all'));
    for(const name of names){on(folds[name],'click',()=>apply({...state,[name]:true},name));on(restores[name],'click',()=>apply({...state,[name]:false},name));}
    on(window,'storage',event=>{
      if(event.key!==key&&event.key!=='scrapbook-nav-collapsed'&&event.key!==null)return;
      // New structured preferences own partial folds; the compatibility-key event
      // from the same write must never accidentally expand the other groups.
      if(event.key==='scrapbook-nav-collapsed'){try{if(parse(localStorage.getItem(key)))return;}catch{}}
      const next=event.key===key?(parse(event.newValue)||read()):read();
      const focused=names.find(name=>next[name]&&groups[name].contains?.(document.activeElement));
      apply(next,focused||null,false);
    });
    apply(state);
    return;
  }
  // Retained compatibility for previously rendered documents during a live swap.
  function apply(collapsed, focus=false){
    root.dataset.navCollapsed=collapsed?'yes':'no';
    bar.inert=collapsed;
    bar.setAttribute('aria-hidden',String(collapsed));
    restore.setAttribute('aria-expanded',String(!collapsed));
    restore.setAttribute('aria-hidden',String(!collapsed));
    restore.tabIndex=collapsed?0:-1;
    try{localStorage.setItem('scrapbook-nav-collapsed',collapsed?'yes':'no');}catch{}
    if(focus)(collapsed?restore:fold).focus({preventScroll:true});
  }
  on(fold, 'click',()=>apply(true,true));
  on(restore, 'click',()=>apply(false,true));
  on(window, 'storage',event=>{if(event.key==='scrapbook-nav-collapsed')apply(event.newValue==='yes');});
  let collapsed=root.dataset.navCollapsed==='yes';
  try{const saved=localStorage.getItem('scrapbook-nav-collapsed');if(saved==='yes'||saved==='no')collapsed=saved==='yes';}catch{}
  apply(collapsed);
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('nav-fold', initialize);
  else initialize();
})();
