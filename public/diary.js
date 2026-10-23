(() => {
  'use strict';
  const initialize = (scope) => {
    const on = (target, ...args) => scope ? scope.listen(target, ...args) : target?.addEventListener(...args);
    const delay = (...args) => scope ? scope.timeout(...args) : setTimeout(...args);
    const raf = (...args) => scope ? scope.frame(...args) : requestAnimationFrame(...args);

  const $ = (s) => document.querySelector(s);
  const keys = { saved: 'cosmic-bookmarks-v1', recent: 'cosmic-recent-v1', size: 'cosmic-reading-size', focus: 'cosmic-focus-reading', preferences: 'cosmic-reading-layout-v1' };
  const safePath = (path) => typeof path === 'string' && /^\/posts\/[a-z0-9][a-z0-9-]{0,100}\/$/.test(path);
  const clean = (record) => record && safePath(record.path) && typeof record.title === 'string' && record.title.trim() ? {
    path: record.path, title: record.title.slice(0,200), description: String(record.description || '').slice(0,600),
    category: String(record.category || '').slice(0,60), date: String(record.date || '').slice(0,20), at: Number(record.at) || Date.now()
  } : null;
  const read = (key) => { try { const list = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(list) ? list.map(clean).filter(Boolean).slice(0,100) : []; } catch { return []; } };
  const write = (key,list) => { try { localStorage.setItem(key,JSON.stringify(list)); return true; } catch { return false; } };
  const status = (text) => { const el = $('[data-library-status]') || $('[data-reading-feedback]'); if (el) el.textContent=text; };
  const article = $('[data-article-info]');
  let saved = read(keys.saved), recent = read(keys.recent);
  const renderLibrary = () => {
    if (!$('[data-library]')) return;
    for (const [kind,records] of [['saved',saved],['recent',recent]]) {
      const list=$(`[data-${kind}-list]`), empty=$(`[data-${kind}-empty]`);
      list.replaceChildren(); empty.hidden=records.length>0;
      for (const record of records) {
        const card=document.createElement('article');card.className='library-entry';
        const meta=document.createElement('small');meta.textContent=record.category || '一篇记录';
        const heading=document.createElement('h3'),link=document.createElement('a');link.href=record.path;link.textContent=record.title;heading.append(link);
        const description=document.createElement('p');description.textContent=record.description;
        const bottom=document.createElement('div');bottom.className='library-entry-bottom';
        const date=document.createElement('time');date.textContent=record.date || new Date(record.at).toLocaleDateString('zh-CN');bottom.append(date);
        if(kind==='saved') { const button=document.createElement('button');button.className='diary-button';button.textContent='取消星标';button.setAttribute('aria-label','取消收藏：'+record.title);on(button, 'click',()=>{const next=saved.filter(x=>x.path!==record.path);if(write(keys.saved,next)){saved=next;renderLibrary();status('已取消星标。')}else status('浏览器存储不可用，未保存更改。');});bottom.append(button); }
        card.append(meta,heading,description,bottom);list.append(card);
      }
    }
    $('[data-saved-count]').textContent=saved.length+' 篇';
  };
  renderLibrary();
  if(article) {
    const record=clean({path:location.pathname,title:article.dataset.title,description:article.dataset.description,category:article.dataset.category,date:article.dataset.date,at:Date.now()});
    if(record){recent=[record,...recent.filter(x=>x.path!==record.path)].slice(0,30);write(keys.recent,recent);}
    const button=$('[data-bookmark]');
    const paint=()=>{const active=saved.some(x=>x.path===location.pathname);button?.setAttribute('aria-pressed',String(active));if(button)button.textContent=active?'✦ 已收藏':'✧ 收藏文章';};
    paint();on(button, 'click',()=>{if(!record)return;const active=saved.some(x=>x.path===record.path),next=active?saved.filter(x=>x.path!==record.path):[record,...saved].slice(0,100);if(write(keys.saved,next)){saved=next;paint();status(active?'已取消收藏。':'已收藏，可以在「我的星标」中找到。');}else status('浏览器存储不可用，收藏未保存。');});
    const defaults={version:2,size:16,focus:false,leading:1.95,width:850,font:'sans',opacity:0,blur:0};
    const limits={size:[12,36,.1],leading:[1.2,3,.01],width:[480,3200,1],opacity:[0,100,1],blur:[0,24,1]};
    const widthPresets={narrow:660,standard:850,wide:950};
    const surfacePresets={transparent:{opacity:0,blur:0},glass:{opacity:60,blur:12},solid:{opacity:100,blur:0}};
    const validNumber=(key,value)=>{
      if(typeof value!=='number'||!Number.isFinite(value))return null;
      const [min,max,step]=limits[key];if(value<min||value>max)return null;
      return Number((min+Math.round((value-min)/step)*step).toFixed(2));
    };
    const inputNumber=(key,raw)=>typeof raw==='string'&&/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())?validNumber(key,Number(raw)):null;
    const validSize=value=>inputNumber('size',value);
    const parseLayout=raw=>{
      try{
        const value=JSON.parse(raw||'null');if(!value||typeof value!=='object'||Array.isArray(value)||![1,2].includes(value.version))return null;
        const result={};
        if(value.version===1){
          if(['1.7','1.95','2.2'].includes(value.leading))result.leading=Number(value.leading);
          if(Object.hasOwn(widthPresets,value.width))result.width=widthPresets[value.width];
          result.opacity=0;result.blur=0;
        }else for(const key of ['leading','width','opacity','blur']){const number=validNumber(key,value[key]);if(number!==null)result[key]=number;}
        if(['sans','serif'].includes(value.font))result.font=value.font;
        return result;
      }catch{return null;}
    };
    let preferences={...defaults};
    const remembered=globalThis.FieldnotesReadingPreferences;
    const memory={...defaults};
    if([1,2].includes(remembered?.version)){
      memory.size=validNumber('size',remembered.size)??defaults.size;
      memory.focus=remembered.focus===true;
      Object.assign(memory,parseLayout(JSON.stringify(remembered))||{});
    }
    let dirty=[1,2].includes(remembered?.version)&&remembered.dirty===true;
    // Refresh storage after time away; only failed local writes take precedence.
    try{
      const size=localStorage.getItem(keys.size),focus=localStorage.getItem(keys.focus),layout=localStorage.getItem(keys.preferences);
      preferences={...defaults,size:validSize(size)??defaults.size,focus:focus==='true',...(parseLayout(layout)||{})};
    }catch{preferences={...memory};}
    if(dirty)preferences={...memory};
    let committed={...preferences},lastSuccessfulSignature=null,paintFrame=0;
    const controls=[...document.querySelectorAll('[data-font-change]')];
    const valueControls=[...document.querySelectorAll('input[data-reading-value]')].filter(input=>Object.hasOwn(limits,input.dataset.readingValue));
    const editing=new Set();
    const surface=()=>Object.entries(surfacePresets).find(([,value])=>value.opacity===preferences.opacity&&value.blur===preferences.blur)?.[0]||'custom';
    const syncValueControls=()=>{
      for(const input of valueControls)if(!editing.has(input)){input.value=String(preferences[input.dataset.readingValue]);input.removeAttribute('aria-invalid');}
    };
    const cacheCommitted=()=>{globalThis.FieldnotesReadingPreferences={...committed,dirty};};
    const cancelPaint=()=>{if(paintFrame)cancelAnimationFrame(paintFrame);paintFrame=0;};
    scope?.cleanup(cancelPaint);
    const paintReading=()=>{
      // Disarm scroll-position intent before changing geometry, not after anchoring can run.
      document.dispatchEvent(new CustomEvent('fieldnotes:reading-preferences'));
      const {size,focus,leading,width,font,opacity,blur}=preferences;
      document.body.dataset.readingSize=String(size);
      document.body.dataset.readingWidth=Object.keys(widthPresets).find(key=>widthPresets[key]===width)||'custom';
      document.body.dataset.readingFont=font;
      document.body.dataset.readingSurface=surface();
      document.body.style.setProperty('--reading-size',size+'px');
      document.body.style.setProperty('--reading-line-height',String(leading));
      document.body.style.setProperty('--reading-width',width+'px');
      document.body.style.setProperty('--reading-font',font==='serif'?'var(--reading-serif-font, SimSun, serif)':'var(--sans)');
      document.body.style.setProperty('--reading-surface-opacity',opacity+'%');
      document.body.style.setProperty('--reading-surface-blur',blur+'px');
      document.body.dataset.focusReading=String(focus);
      const focusButton=$('[data-reading-focus]');
      focusButton?.setAttribute('aria-pressed',String(focus));
      if(focusButton)focusButton.textContent=focus?'退出专注':'专注阅读';
      const output=$('[data-reading-size-output]');if(output)output.textContent=size+' px';
      for(const button of controls)button.disabled=Number(button.dataset.fontChange)<0?size<=limits.size[0]:size>=limits.size[1];
      for(const key of ['leading','width','font'])document.querySelectorAll('button[data-reading-'+key+']').forEach(button=>{
        const raw=button.dataset['reading'+key[0].toUpperCase()+key.slice(1)],value=key==='width'?widthPresets[raw]:key==='leading'?Number(raw):raw;
        button.setAttribute('aria-pressed',String(value===preferences[key]));
      });
      document.querySelectorAll('button[data-reading-surface]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.readingSurface===surface())));
      syncValueControls();
    };
    const flushReading=()=>{cancelPaint();paintReading();};
    const previewReading=()=>{syncValueControls();if(!paintFrame)paintFrame=raf(()=>{paintFrame=0;paintReading();});};
    const persist=()=>{
      const values=[[keys.size,String(preferences.size)],[keys.focus,String(preferences.focus)],[keys.preferences,JSON.stringify({version:2,leading:preferences.leading,width:preferences.width,font:preferences.font,opacity:preferences.opacity,blur:preferences.blur})]],signature=JSON.stringify(values);
      if(!dirty&&signature===lastSuccessfulSignature)return true;
      let stored=true;for(const [key,value]of values)try{localStorage.setItem(key,value);}catch{stored=false;}
      dirty=!stored;committed={...preferences};if(stored)lastSuccessfulSignature=signature;cacheCommitted();
      return stored;
    };
    const changed=message=>{flushReading();status(persist()?message:message+'（仅本次生效）');};
    cacheCommitted();paintReading();
    controls.forEach(button=>on(button,'click',()=>{const change=Number(button.dataset.fontChange);if(!Number.isFinite(change)||Math.abs(change)!==1)return;preferences.size=validNumber('size',Math.min(limits.size[1],Math.max(limits.size[0],preferences.size+change)));changed('字号 '+preferences.size+' px');}));
    on($('[data-reading-focus]'),'click',()=>{preferences.focus=!preferences.focus;changed(preferences.focus?'已开启专注阅读':'已退出专注阅读');});
    for(const key of ['leading','width','font'])document.querySelectorAll('button[data-reading-'+key+']').forEach(button=>on(button,'click',()=>{
      const raw=button.dataset['reading'+key[0].toUpperCase()+key.slice(1)],value=key==='width'?widthPresets[raw]:key==='leading'&&['1.7','1.95','2.2'].includes(raw)?Number(raw):key==='font'&&['sans','serif'].includes(raw)?raw:null;
      if(value===null||value===undefined)return;preferences[key]=value;changed('已更新阅读样式');
    }));
    document.querySelectorAll('button[data-reading-surface]').forEach(button=>on(button,'click',()=>{
      if(!Object.hasOwn(surfacePresets,button.dataset.readingSurface))return;
      Object.assign(preferences,surfacePresets[button.dataset.readingSurface]);changed('已更新阅读背景');
    }));
    for(const input of valueControls){
      const key=input.dataset.readingValue,isRange=input.type==='range';
      const restore=()=>{editing.delete(input);input.value=String(preferences[key]);input.removeAttribute('aria-invalid');};
      const commit=()=>{
        const value=inputNumber(key,input.value);
        if(value===null){input.setAttribute('aria-invalid','true');return false;}
        editing.delete(input);preferences[key]=value;changed('已更新阅读样式');return true;
      };
      on(input,'input',()=>{
        if(!isRange){editing.add(input);input.removeAttribute('aria-invalid');return;}
        const value=inputNumber(key,input.value);if(value===null)return;preferences[key]=value;previewReading();
      });
      on(input,'change',commit);
      on(input,'keydown',event=>{
        if(event.key==='Enter'&&!isRange){event.preventDefault();commit();}
        else if(event.key==='Escape'){
          event.preventDefault();event.stopPropagation();
          if(isRange)preferences[key]=committed[key];flushReading();restore();
        }
      });
      on(input,'blur',()=>{if(!isRange&&editing.has(input))commit();restore();});
    }
    on($('[data-reading-reset]'),'click',()=>{editing.clear();preferences={...defaults};changed('已恢复默认阅读样式');});
    on(window,'storage',event=>{
      if(event.storageArea&&event.storageArea!==localStorage)return;
      let next={...committed};
      if(event.key===keys.size){const size=event.newValue===null?defaults.size:validSize(event.newValue);if(size===null)return;next.size=size;}
      else if(event.key===keys.focus){if(event.newValue!==null&&!['true','false'].includes(event.newValue))return;next.focus=event.newValue==='true';}
      else if(event.key===keys.preferences){const value=event.newValue===null?{leading:defaults.leading,width:defaults.width,font:defaults.font,opacity:defaults.opacity,blur:defaults.blur}:parseLayout(event.newValue);if(!value)return;Object.assign(next,value);}
      else if(event.key===null){next={...defaults};dirty=false;}else return;
      cancelPaint();preferences=next;committed={...preferences};lastSuccessfulSignature=null;editing.clear();cacheCommitted();paintReading();
    });
    const settings=$('.reading-settings');
    on(document,'keydown',event=>{if(event.key!=='Escape'||!settings?.open)return;event.preventDefault();settings.open=false;settings.querySelector('summary')?.focus();});
    on(document,'pointerdown',event=>{if(settings?.open&&!settings.contains(event.target))settings.open=false;});
    const toc=$('[data-reading-toc]');
    if(toc){const mobile=matchMedia('(max-width:1023px)');const fitToc=()=>{toc.open=!mobile.matches;};fitToc();on(mobile,'change',fitToc);}
    const bar=$('.reading-progress i');let frame=0;const update=()=>{frame=0;const rect=article.getBoundingClientRect(),distance=Math.max(1,rect.height-innerHeight);if(bar)bar.style.width=Math.max(0,Math.min(100,-rect.top/distance*100))+'%';};
    on(window, 'scroll',()=>{if(!frame)frame=raf(update);},{passive:true});on(window, 'resize',update);update();
  }
  on($('[data-export-library]'), 'click',()=>{const blob=new Blob([JSON.stringify({version:1,bookmarks:saved},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');scope?.cleanup(()=>URL.revokeObjectURL(url));a.href=url;a.download='unfinished-bookmarks.json';a.click();delay(()=>URL.revokeObjectURL(url),1000);status('收藏备份已准备下载。');});
  on($('[data-import-library]'), 'change',async(event)=>{const input=event.currentTarget,file=input.files?.[0];if(!file)return;try{if(file.size>100000)throw Error('文件过大，请选择小于 100 KB 的收藏 JSON。');const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.bookmarks))throw Error('不是本博客的收藏备份格式。');const imported=data.bookmarks.map(clean).filter(Boolean);if(!imported.length)throw Error('没有有效的站内文章收藏。');const map=new Map(saved.map(x=>[x.path,x]));for(const item of imported)map.set(item.path,item);const next=[...map.values()].slice(0,100);if(!write(keys.saved,next))throw Error('浏览器存储不可用。');saved=next;renderLibrary();status('已合并收藏，共 '+saved.length+' 篇。');}catch(error){status('导入失败：'+error.message);}finally{input.value='';}});
  on($('[data-clear-history]'), 'click',()=>{ $('[data-clear-history-dialog]')?.showModal(); });
  on($('[data-cancel-clear-history]'), 'click',()=>{ $('[data-clear-history-dialog]').close(); });
  on($('[data-confirm-clear-history]'), 'click',()=>{if(write(keys.recent,[])){recent=[];renderLibrary();status('阅读足迹已清除。')}else status('浏览器存储不可用，未清除。');$('[data-clear-history-dialog]').close();});
  // Reference-inspired, independently implemented moon sparks. No pointer history is stored or sent.
  // Cyber Moon owns its bounded click-only effect; do not register a second trail.
  if(!['cyber-moon','scrapbook-moon'].includes(document.documentElement.dataset.visualPhase)){
  const media=matchMedia('(prefers-reduced-motion: reduce)');let last=0,particles=0;
  const enabled=()=>!['cyber-moon','scrapbook-moon'].includes(document.documentElement.dataset.visualPhase)&&!document.hidden&&!media.matches&&document.documentElement.dataset.motion!=='quiet'&&!location.pathname.startsWith('/studio');
  const spark=(x,y,burst=false)=>{if(!enabled()||particles>=16)return;const el=document.createElement('span');el.className='diary-particle';el.setAttribute('aria-hidden','true');el.textContent=burst?'☾':'✧';el.style.setProperty('--spark-x',x+'px');el.style.setProperty('--spark-y',y+'px');el.style.setProperty('--spark-dx',(Math.random()*45-22)+'px');document.body.append(el);particles++;delay(()=>{el.remove();particles--;},850);};
  on(document, 'pointermove',event=>{if(event.pointerType!=='mouse'||performance.now()-last<120||event.target.closest('input,textarea,dialog,[data-companion-panel]'))return;last=performance.now();spark(event.clientX,event.clientY);},{passive:true});
  on(document, 'pointerdown',event=>{if(event.button!==0||event.target.closest('input,textarea,select,dialog,[data-companion-panel]'))return;spark(event.clientX,event.clientY,true);},{passive:true});
  }
  };
  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('diary', initialize);
  else initialize();
})();
