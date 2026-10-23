(() => {
const initialize = async (scope) => {
  'use strict';
  const page = document.querySelector('[data-space-page],[data-links-page]');
  if (!page) return;
  const pageBody=document.body||document;
  const $ = selector => pageBody.querySelector(selector);
  const $$ = selector => [...pageBody.querySelectorAll(selector)];
  const local = false; // Public edition is read-only, including its local preview.
  const {parseSpacePending,pendingMatchesSpace,SPACE_PENDING_LIMIT}=await import('/space-recovery.mjs');if(!scope.active)return;
  const kind=page.hasAttribute('data-space-page')?'profile':'links';
  const library=kind==='links'?await import('/bookmark-library.mjs'):null;if(!scope.active)return;
  const libraryPreferences=library?.readBookmarkPreferences((()=>{try{return localStorage.getItem(library.BOOKMARK_PREFS_KEY);}catch{return null;}})());
  const recoveryKey=`unfinished-space-pending-${kind}`;
  const dialog = $('[data-profile-dialog],[data-link-dialog]');
  const form = dialog?.querySelector('form');
  const status = dialog?.querySelector('[data-editor-status]');
  const state = {token:'',profile:null,links:null,editingId:null,newId:null,dirty:false,busy:false,imageBusy:false,category:'',ready:false,saving:false,recoveryStored:false,pending:null};
  let importItems=[],importWarnings=[],importSelected=new Set(),importReadingSerial=0;
  let transferUrls=[];
  const importDialog=$('[data-links-import-dialog]');
  const hasTransferDraft=()=>{const input=$('[data-links-transfer-text]');return Boolean($('[data-links-transfer-dialog]')?.open&&input&&!input.readOnly&&input.value.trim());};
  if(library){
    try{const initial=JSON.parse($('[data-links-library-data]')?.textContent||'null');if(Array.isArray(initial?.items)&&initial.version===1&&Number.isSafeInteger(initial.revision))state.links=initial;}catch{}
    page.dataset.linksLayout=libraryPreferences.view;
    if($('[data-links-sort]'))$('[data-links-sort]').value=libraryPreferences.sort;
  }
  const field = name => form?.elements.namedItem(name);
  const message = value => { if (status) status.textContent = value; };
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase();
  const imageElement=dialog?.querySelector('[data-image-picker]');
  let imagePicker=null;
  if(imageElement){
    const {mountImagePicker}=await import('/image-picker.mjs');if(!scope.active)return;
    imagePicker=mountImagePicker(imageElement,{
      getValue:()=>field('image').value,
      setValue:value=>{field('image').value=value;state.dirty=true;},
      upload:async data=>{
        if(state.busy||!state.ready)throw new Error('请等当前操作完成后再选择图片。');
        return (await api('/images/upload',{method:'POST',body:{data}})).image.url;
      },
      notify:message,
      onBusy:value=>{state.imageBusy=value;busy(state.busy);}
    });
    scope.cleanup(()=>{imagePicker.cancel();imagePicker.destroy();});
  }
  function readPending(){try{return parseSpacePending(sessionStorage.getItem(recoveryKey),kind);}catch{return null;}}
  function clearPending(){try{sessionStorage.removeItem(recoveryKey);}catch{}state.pending=null;state.recoveryStored=false;}
  function rememberPending(draft,operation='save'){
    const pending={kind,operation,revision:kind==='profile'?state.profile.revision:state.links.revision,draft};
    const raw=JSON.stringify(pending);state.recoveryStored=false;
    if(raw.length>SPACE_PENDING_LIMIT)return;
    try{sessionStorage.setItem(recoveryKey,raw);state.recoveryStored=sessionStorage.getItem(recoveryKey)===raw;state.pending=pending;}catch{}
  }
  function recoverPending(){
    const pending=state.pending || readPending();if(!pending)return false;
    imagePicker?.cancel();
    if(pendingMatchesSpace(pending,state)){clearPending();message('上次保存已写入本机；已核对并清除待确认草稿。');return true;}
    if(kind==='profile'){
      for(const name of ['siteName','displayName','signature','bio','location','avatar','cover'])field(name).value=pending.draft[name];
      field('interests').value=pending.draft.interests.join('，');
    }else{
      const existing=state.links.items.some(item=>item.id===pending.draft.id);state.editingId=existing?pending.draft.id:null;state.newId=existing?null:pending.draft.id;
      for(const name of ['title','url','description','category'])field(name).value=pending.draft[name];field('pinned').checked=pending.draft.pinned;
      field('image').value=pending.draft.image||'';imagePicker?.sync();
      $('[data-delete-link]').hidden=!existing;$('#link-editor-title').textContent=existing?'恢复网址草稿':'恢复为新的网址收藏';
    }
    state.dirty=true;
    message(`已恢复上次未确认的${pending.operation==='delete'?'删除前资料':'编辑草稿'}。服务器当前版本为 ${kind==='profile'?state.profile.revision:state.links.revision}；请检查后手动保存，不会自动覆盖或自动删除。`);
    return true;
  }
  async function api() { throw new Error('公开站不提供资料编辑服务。'); }
  async function loadState() {
    if (!state.token) {
      const session = await api('/session');
      if (typeof session.token !== 'string' || !session.token) throw new Error('没有取得本地编辑令牌。请重新启动博客后重试。');
      state.token = session.token;
    }
    const result = await api('/space/state');
    state.profile = result.profile;
    state.links = result.links;
  }
  function busy(value) {
    state.busy = value;
    if (form) for (const control of form.querySelectorAll('input,textarea,button')) {
      if(!control.closest('[data-image-picker]'))control.disabled = value||state.imageBusy;
      else if(!state.imageBusy)control.disabled=value;
    }
    if(imageElement)imageElement.inert=value;
    if(library){
      for(const control of $$('[data-links-import],[data-links-export],[data-links-import-file]'))control.disabled=value||state.imageBusy;
      if($('[data-links-import-confirm]'))$('[data-links-import-confirm]').disabled=value||importSelected.size===0;
      for(const control of $$('[data-links-import-close],[data-links-import-cancel],[data-links-import-select-all]'))control.disabled=value;
      if($('[data-links-import-list]'))$('[data-links-import-list]').inert=value;
    }
  }
  function close() {
    if (state.busy||state.imageBusy) { message('正在处理，请稍等，不要关闭。'); return; }
    if (state.dirty && !window.confirm('还有未保存的修改。确定放弃这次修改吗？')) return;
    state.dirty = false;clearPending();
    imagePicker?.cancel();dialog.close();
  }
  function profileDraft() {
    const result = {};
    for (const name of ['siteName','displayName','signature','bio','location','avatar','cover']) result[name] = field(name).value.trim();
    result.interests = [...new Set(field('interests').value.split(/[,，、\n]/u).map(value=>value.trim()).filter(Boolean))];
    return result;
  }
  function linkDraft() {
    state.newId ||= `link-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}`;
    return {id:state.editingId || state.newId,title:field('title').value.trim(),url:field('url').value.trim(),description:field('description').value.trim(),category:field('category').value.trim(),pinned:field('pinned').checked,image:field('image').value.trim()};
  }
  function download(value,name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    const timer=setTimeout(()=>URL.revokeObjectURL(url),1000);
    scope.cleanup(()=>{clearTimeout(timer);URL.revokeObjectURL(url);});
  }
  async function openProfile() {
    if (state.busy||state.imageBusy) return;
    imagePicker?.cancel();
    state.ready=false;
    dialog.showModal(); message('正在读取本机资料…'); busy(true);
    try {
      await loadState();
      for (const name of ['siteName','displayName','signature','bio','location','avatar','cover']) field(name).value = state.profile[name] || '';
      field('interests').value = (state.profile.interests || []).join('，');
      state.ready=true; state.dirty = false; message(`本机资料 · 版本 ${state.profile.revision}`);recoverPending();
    } catch(error) { message(error.message); }
    finally { busy(false); }
  }
  async function openLink(id=null) {
    if (state.busy||state.imageBusy||importDialog?.open) return;
    imagePicker?.cancel();
    state.ready=false;
    dialog.showModal(); message('正在读取本机收藏…'); busy(true);
    try {
      await loadState();
      const item = id ? state.links.items.find(value=>value.id === id) : null;
      if (id && !item) throw new Error('这条收藏已经被另一个页面删除；请刷新页面。');
      state.editingId = id;state.newId=null;
      for (const name of ['title','url','description','category']) field(name).value = item?.[name] || (name === 'category' ? '灵感' : '');
      field('image').value=item?.image||'';imagePicker?.sync();
      field('pinned').checked = Boolean(item?.pinned);
      $('[data-delete-link]').hidden = !id;
      $('#link-editor-title').textContent = id ? '编辑喜欢的网址' : '收藏一个网址';
      state.ready=true; state.dirty = false; message(`本机收藏 · 版本 ${state.links.revision}`);recoverPending();
      showDuplicateWarning();
    } catch(error) { message(error.message); }
    finally { busy(false); }
  }
  async function save(event) {
    event.preventDefault();
    if (state.busy||state.imageBusy) return;
    if (!state.ready || !state.profile || !state.links) { message('尚未成功读取资料。请关闭后重新打开编辑器。'); return; }
    const draft=kind==='profile'?profileDraft():linkDraft();
    if(kind==='links'&&findDuplicate(draft.url)){
      const original=state.links.items.find(item=>item.id===state.editingId);
      if(!original||library.canonicalBookmarkUrl(original.url)!==library.canonicalBookmarkUrl(draft.url)){
        message('这个网址已经在收藏夹里了，请编辑已有收藏，或换一个网址。');showDuplicateWarning();return;
      }
    }
    rememberPending(draft);state.saving=true;
    busy(true); message('正在保存到本机…');
    try {
      if (page.hasAttribute('data-space-page')) {
        const result = await api('/space/profile',{method:'POST',body:{revision:state.profile.revision,profile:draft}});
        state.profile = result.profile;
        state.dirty = false;clearPending();state.saving=false;state.busy=false;message('资料已保存，正在更新空间…');
        (window.FieldnotesRefresh?window.FieldnotesRefresh():location.reload());
      } else {
        const next = draft;
        const items = state.editingId ? state.links.items.map(item=>item.id === state.editingId?next:item) : [...state.links.items,next];
        const result = await api('/space/links',{method:'POST',body:{revision:state.links.revision,items}});
        state.links = result.links; state.dirty = false;clearPending();
        renderLinks();imagePicker?.cancel(); dialog.close();
      }
    } catch(error) { message(error.message + (error.status === 409 ? '\n请先导出当前草稿，再关闭并重新打开编辑器读取最新版本。' : '\n输入仍然保留，尚未宣称保存成功。')); }
    finally { state.saving=false;busy(false); }
  }
  function filterLinks() {
    const query = normalize($('[data-links-search]')?.value).trim();
    let count=0;
    for (const card of $$('[data-link-id]')) {
      card.hidden = Boolean(state.category && card.dataset.category !== state.category || query && !normalize(card.dataset.search).includes(query));
      if (!card.hidden) count++;
    }
    const empty = $('[data-links-empty]'); if (empty) empty.hidden = count !== 0;
    const result=$('[data-links-results]');if(result)result.textContent=`显示 ${count} / ${$$('[data-link-id]').length} 个收藏`;
  }
  function findDuplicate(url){
    if(!library||!state.links)return null;
    const key=library.canonicalBookmarkUrl(url);if(!key)return null;
    return state.links.items.find(item=>item.id!==state.editingId&&library.canonicalBookmarkUrl(item.url)===key)||null;
  }
  function showDuplicateWarning(){
    const warning=$('[data-link-duplicate-warning]');if(!warning)return;
    const existing=findDuplicate(field('url')?.value||'');
    warning.hidden=!existing;warning.textContent=existing?`已收藏过这个网址：「${existing.title}」`:'';
  }
  function saveLibraryPreferences(){
    if(!library)return;
    try{localStorage.setItem(library.BOOKMARK_PREFS_KEY,JSON.stringify(libraryPreferences));}catch{}
    page.dataset.linksLayout=libraryPreferences.view;
    for(const button of $$('[data-links-view]'))button.setAttribute('aria-pressed',String(button.dataset.linksView===libraryPreferences.view));
  }
  function renderImportPreview(){
    const list=$('[data-links-import-list]');if(!list)return;list.replaceChildren();
    for(const [index,item] of importItems.entries()){
      const row=node('label','bookmark-import-row'),checkbox=node('input');checkbox.type='checkbox';checkbox.dataset.importIndex=String(index);checkbox.checked=importSelected.has(index);
      const text=node('span');text.append(node('strong','',item.title),node('small','',item.url));row.append(checkbox,text);list.append(row);
    }
    $('[data-links-import-status]').textContent=importWarnings.slice(0,3).join(' ');
    updateImportSummary();
  }
  function updateImportSummary(){
    if(!library||!state.links)return;
    const selected=importItems.filter((_,index)=>importSelected.has(index));
    const merged=library.mergeBookmarkImport(state.links.items,selected);
    $('[data-links-import-summary]').textContent=`已选择 ${selected.length} 项 · 可新增 ${merged.added} 项 · 跳过重复 ${merged.duplicates} 项${merged.overflow?` · 容量不足 ${merged.overflow} 项`:''}`;
    $('[data-links-import-select-all]').textContent=importItems.length&&importSelected.size===importItems.length?'取消全选':'全选';
    $('[data-links-import-confirm]').disabled=state.busy||merged.added===0;
  }
  async function readImportFile(file){
    if(!file||!local||!library||state.busy||state.imageBusy||dialog?.open)return;
    const serial=++importReadingSerial;busy(true);
    const note=$('[data-links-results]');if(note)note.textContent='正在读取书签文件…';
    try{
      if(file.size>2*1024*1024)throw new Error('书签文件不能超过 2 MB。');
      const text=await file.text();if(!scope.active||serial!==importReadingSerial)return;
      const parsed=library.parseBookmarkImport(text,{filename:file.name});
      if(!parsed.items.length)throw new Error('文件里没有可导入的 HTTP(S) 书签。');
      await loadState();if(!scope.active||serial!==importReadingSerial)return;
      importItems=parsed.items;importWarnings=parsed.warnings;importSelected=new Set(importItems.map((_,index)=>index));
      importDialog.showModal();renderImportPreview();
      if(note)note.textContent='书签已读取，请在预览中选择要导入的项目。';
    }catch(error){if(scope.active&&note)note.textContent=error.message||'读取失败，原收藏没有改变。';}
    finally{if(scope.active&&serial===importReadingSerial){$('[data-links-import-file]').value='';busy(false);if(importDialog?.open)updateImportSummary();}}
  }
  function closeImport(){
    if(state.busy)return;
    importReadingSerial++;importDialog?.close();importItems=[];importSelected.clear();filterLinks();
  }
  async function commitImport(){
    if(!scope.active||state.busy||state.imageBusy||!importDialog?.open)return;
    const selected=importItems.filter((_,index)=>importSelected.has(index));
    const merged=library.mergeBookmarkImport(state.links.items,selected);
    if(!merged.added){updateImportSummary();return;}
    busy(true);$('[data-links-import-status]').textContent='正在保存选中的书签…';
    try{
      const result=await api('/space/import',{method:'POST',body:{revision:state.links.revision,items:selected}});
      if(!scope.active)return;
      state.links=result.links;renderLinks();importDialog.close();importItems=[];importSelected.clear();
      $('[data-links-results]').textContent=`已导入 ${merged.added} 项，跳过 ${merged.duplicates} 项重复书签`;
    }catch(error){if(scope.active)$('[data-links-import-status]').textContent=error.status===409?'收藏夹已在其他页面更新；本次没有覆盖。请取消后重新选择文件，核对最新收藏再导入。':`${error.message} 文件和预览仍保留，请核对后重试。`;}
    finally{if(scope.active){busy(false);if(importDialog.open)updateImportSummary();}}
  }
  function exportLibrary(){
    if(!library||!state.links)return;
    try{
      if($('[data-links-transfer-dialog]')){openTransfer('export');return;}
      const payload=JSON.parse(library.exportBookmarkLibrary(state.links.items));
      download(payload,'往事未完-网址收藏.json');
      if($('[data-links-results]'))$('[data-links-results]').textContent='已导出全部收藏；图片保留原地址，本地图片文件请随博客目录一起备份。';
    }catch(error){if($('[data-links-results]'))$('[data-links-results]').textContent=error.message||'导出失败，请重试。';}
  }
  function closeTransfer(){
    $('[data-links-transfer-dialog]')?.close();for(const url of transferUrls)URL.revokeObjectURL(url);transferUrls=[];
  }
  function openTransfer(mode){
    const transfer=$('[data-links-transfer-dialog]');if(!transfer||state.busy||state.imageBusy||dialog?.open||importDialog?.open)return;
    closeTransfer();const exported=mode==='export',text=$('[data-links-transfer-text]'),files=$('[data-links-transfer-files]');files.replaceChildren();
    text.value='';text.readOnly=exported;$('[data-links-transfer-title]').textContent=exported?'备份收藏夹':'粘贴书签内容';
    $('[data-links-transfer-preview]').hidden=exported;$('[data-links-transfer-file]').hidden=exported;
    $('[data-links-transfer-status]').textContent=exported?'图片保留原地址；迁移博客时请同时带上 images 文件夹。':'粘贴 JSON 或浏览器书签 HTML，读取后仍需勾选确认，不会立即写入。';
    if(exported){
      const parts=library.exportBookmarkParts(state.links.items);text.value=parts[0];
      for(const [index,content]of parts.entries()){
        const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));transferUrls.push(url);
        const anchor=node('a','space-button',parts.length===1?'下载收藏备份':`下载第 ${index+1} / ${parts.length} 卷`);anchor.href=url;anchor.download=`往事未完-网址收藏${parts.length>1?'-'+(index+1):''}.json`;
        anchor.addEventListener('click',()=>{text.value=content;$('[data-links-transfer-status]').textContent='已请求下载，可核对浏览器下载列表；下方同时保留本卷 JSON。';});files.append(anchor);
      }
      if(parts.length>1)$('[data-links-transfer-status]').textContent=`已自动分成 ${parts.length} 卷，每卷可单独导入；下方显示第一卷，点击下载可切换预览。图片文件需随博客一起迁移。`;
    }
    transfer.showModal();
  }
  function node(tag,className,text) { const item = document.createElement(tag); if (className) item.className=className; if (text !== undefined) item.textContent=text; return item; }
  function validLinkImage(value){
    if(typeof value!=='string')return '';
    if(/^\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|gif)$/iu.test(value))return value;
    if(value.length<=550000){
      const match=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(value);
      if(match&&match[2].length%4===0){try{
        const raw=atob(match[2]),bytes=[...raw.slice(0,12)].map(char=>char.charCodeAt(0));
        const magic=match[1]==='png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:match[1]==='gif'?/^GIF8[79]a/u.test(raw):raw.startsWith('RIFF')&&raw.slice(8,12)==='WEBP';
        if(raw.length<=400000&&btoa(raw)===match[2]&&magic)return value;
      }catch{}}
    }
    try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!/[\s\u0000-\u001f]/u.test(value)&&value.length<=2048?url.href:'';}catch{return '';}
  }
  function watchLinkImage(cover){
    const image=cover.querySelector('img');if(!image)return;
    const failed=()=>{cover.hidden=true;};
    image.addEventListener('error',failed,{once:true});
    if(image.complete&&!image.naturalWidth)failed();
  }
  function renderLinks() {
    const grid = $('[data-links-grid]');
    if (!grid || !state.links) return;
    grid.replaceChildren();
    const sorted = library?library.sortBookmarks(state.links.items,libraryPreferences.sort):[...state.links.items].sort((a,b)=>Number(b.pinned)-Number(a.pinned));
    for (const item of sorted) {
      let url; try { url = new URL(item.url); if (!['http:','https:'].includes(url.protocol) || url.username || url.password) continue; } catch { continue; }
      const card = node('article','link-card'); card.dataset.linkId=item.id; card.dataset.category=item.category; card.dataset.search=normalize(`${item.title} ${item.description} ${item.url} ${item.category}`);
      const imageUrl=validLinkImage(item.image);
      if(imageUrl){
        const cover=node('a','link-card-cover');cover.dataset.linkImage='';cover.href=url.href;cover.target='_blank';cover.rel='noopener noreferrer';cover.tabIndex=-1;cover.setAttribute('aria-hidden','true');
        const image=node('img');image.alt='';image.width=640;image.height=360;image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.src=imageUrl;cover.append(image);watchLinkImage(cover);card.append(cover);
      }
      const top = node('div','link-card-top'); const letter=node('span','link-letter',item.title.slice(0,1).toUpperCase()); letter.setAttribute('aria-hidden','true'); top.append(letter,node('span','link-category',item.category));
      if (item.pinned) { const pin=node('span','link-pin','★'); pin.setAttribute('aria-label','已置顶'); top.append(pin); }
      const heading=node('h2'); const anchor=node('a','',item.title); anchor.href=url.href; anchor.target='_blank'; anchor.rel='noopener noreferrer'; const arrow=node('span','','↗'); arrow.setAttribute('aria-hidden','true'); anchor.append(arrow); heading.append(anchor);
      const bottom=node('div','link-card-bottom'); const edit=node('button','space-text-button','编辑'); edit.type='button'; edit.dataset.editLink=item.id; edit.setAttribute('aria-label',`编辑${item.title}`); bottom.append(node('span','',url.hostname),edit);
      edit.hidden=!local;
      card.append(top,heading,node('p','',item.description || '为下次灵感，留一扇门。'),bottom); grid.append(card);
    }
    const filters=$('.links-filters'); filters.replaceChildren();
    const categories=['',...new Set(sorted.map(item=>item.category))];
    if (!categories.includes(state.category)) state.category='';
    for (const category of categories) {
      const button=node('button',category===state.category?'is-active':'',category||'全部'); button.type='button'; button.dataset.linkCategory=category; button.setAttribute('aria-pressed',String(category===state.category));
      const count=node('span','',String(category?sorted.filter(item=>item.category===category).length:sorted.length));if(!category)count.dataset.linksCount='';button.append(count);
      filters.append(button);
    }
    const datalist=$('#link-categories'); datalist.replaceChildren(...categories.filter(Boolean).map(category=>{const option=node('option'); option.value=category; return option;}));
    filterLinks();
  }
  async function upload(event) {
    const file=event.target.files?.[0]; if (!file) return;
    if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size > 10*1024*1024) { message('请选择小于 10 MB 的 PNG、JPEG、WebP 或 GIF 图片。'); event.target.value=''; return; }
    busy(true); message('正在本机缩放图片…');
    let objectUrl;
    try {
      objectUrl=URL.createObjectURL(file); const image=new Image(); image.src=objectUrl; await image.decode();
      if (!image.naturalWidth || image.naturalWidth*image.naturalHeight > 50000000) throw new Error('图片尺寸过大或无效，请选择小一些的图片。');
      const maximum=event.target.dataset.imageUpload === 'avatar'?512:1600;
      const ratio=Math.min(1,maximum/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio)); canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
      const context=canvas.getContext('2d'); if (!context) throw new Error('浏览器暂时无法处理图片，请填写图片地址。'); context.drawImage(image,0,0,canvas.width,canvas.height);
      let value=canvas.toDataURL('image/webp',.82);
      if (value.length > 530000) value=canvas.toDataURL('image/jpeg',.65);
      if (value.length > 530000) throw new Error('缩放后图片仍过大，请选择更小的图片。');
      field(event.target.dataset.imageUpload).value=value; state.dirty=true; message('图片已放入草稿。点击「保存资料」后才会写入博客。');
    } catch(error) { message(error.message || '无法读取这张图片，原资料没有改变。'); }
    finally { if (objectUrl) URL.revokeObjectURL(objectUrl); event.target.value=''; busy(false); }
  }
  if (local) {
    for (const button of $$('[data-edit-profile],[data-add-link],[data-edit-link]')) button.hidden=false;
    $('[data-edit-profile]')?.addEventListener('click',openProfile);
    $('[data-add-link]')?.addEventListener('click',()=>openLink());
    $('[data-links-grid]')?.addEventListener('click',event=>{const button=event.target.closest('[data-edit-link]');if(button)openLink(button.dataset.editLink);});
    for(const button of $$('[data-profile-media-choice]'))button.addEventListener('click',async()=>{
      if(state.busy||state.imageBusy||!state.ready)return;
      const controller=new AbortController();scope.cleanup(()=>controller.abort());busy(true);
      try{const {chooseMedia}=await import('/media-picker.mjs');if(!scope.active)return;
        const url=await chooseMedia({signal:controller.signal});if(scope.active&&url&&['avatar','cover'].includes(button.dataset.profileMediaChoice)){field(button.dataset.profileMediaChoice).value=url;state.dirty=true;message('已选好图片，保存资料后生效。');}
      }catch(error){if(scope.active)message(error.message);}finally{if(scope.active)busy(false);}
    });
  }
  if(library){
    for(const button of $$('[data-links-view]'))button.addEventListener('click',()=>{libraryPreferences.view=button.dataset.linksView==='list'?'list':'grid';saveLibraryPreferences();});
    $('[data-links-sort]')?.addEventListener('change',event=>{libraryPreferences.sort=['default','title','site'].includes(event.target.value)?event.target.value:'default';saveLibraryPreferences();renderLinks();});
    $('[data-links-export]')?.addEventListener('click',exportLibrary);
    field('url')?.addEventListener('input',showDuplicateWarning);
    if(local){
      if($('[data-links-import]'))$('[data-links-import]').hidden=false;
      $('[data-links-import]')?.addEventListener('click',()=>{if($('[data-links-transfer-dialog]'))openTransfer('import');else if(!state.busy&&!state.imageBusy&&!dialog?.open)$('[data-links-import-file]').click();});
      $('[data-links-import-file]')?.addEventListener('change',event=>readImportFile(event.target.files?.[0]));
      $('[data-links-import-confirm]')?.addEventListener('click',commitImport);
      $('[data-links-import-close]')?.addEventListener('click',closeImport);
      $('[data-links-import-cancel]')?.addEventListener('click',closeImport);
      importDialog?.addEventListener('cancel',event=>{event.preventDefault();closeImport();});
      $('[data-links-import-list]')?.addEventListener('change',event=>{const index=Number(event.target.dataset.importIndex);if(state.busy||!Number.isInteger(index)||index<0||index>=importItems.length)return;event.target.checked?importSelected.add(index):importSelected.delete(index);updateImportSummary();});
      $('[data-links-import-select-all]')?.addEventListener('click',()=>{if(state.busy)return;importSelected=importSelected.size===importItems.length?new Set():new Set(importItems.map((_,index)=>index));renderImportPreview();});
    }
    saveLibraryPreferences();if(state.links)renderLinks();
    $('[data-links-transfer-close]')?.addEventListener('click',closeTransfer);
    $('[data-links-transfer-dialog]')?.addEventListener('cancel',event=>{event.preventDefault();closeTransfer();});
    $('[data-links-transfer-file]')?.addEventListener('click',()=>{closeTransfer();$('[data-links-import-file]').click();});
    $('[data-links-transfer-preview]')?.addEventListener('click',()=>{
      const value=$('[data-links-transfer-text]').value;
      if(!value.trim()){$('[data-links-transfer-status]').textContent='请先粘贴书签内容。';return;}
      const filename=/^\s*</u.test(value)?'bookmarks.html':'bookmarks.json';closeTransfer();
      void readImportFile({name:filename,size:new TextEncoder().encode(value).length,text:async()=>value});
    });
    scope.cleanup(()=>{closeTransfer();importReadingSerial++;if(importDialog?.open)importDialog.close();importItems=[];importSelected.clear();});
  }
  form?.addEventListener('input',()=>{state.dirty=true;}); form?.addEventListener('change',()=>{state.dirty=true;}); form?.addEventListener('submit',save);
  dialog?.addEventListener('cancel',event=>{event.preventDefault();close();});
  $('[data-close-editor]')?.addEventListener('click',close);
  for (const input of $$('[data-image-upload]')) input.addEventListener('change',upload);
  $('[data-export-profile]')?.addEventListener('click',()=>download({profile:profileDraft(),revision:state.profile?.revision},'我的空间-资料草稿.json'));
  $('[data-export-link-draft]')?.addEventListener('click',()=>download({item:linkDraft(),revision:state.links?.revision},'网址收藏-草稿.json'));
  $('[data-delete-link]')?.addEventListener('click',async()=>{
    if (state.busy || state.imageBusy || !state.ready || !state.editingId || !window.confirm('确定删除这条网址收藏吗？旧版本仍有本机备份。')) return;
    rememberPending(linkDraft(),'delete');state.saving=true;busy(true); message('正在删除…');
    try {const result=await api('/space/links',{method:'POST',body:{revision:state.links.revision,items:state.links.items.filter(item=>item.id!==state.editingId)}});state.links=result.links;state.dirty=false;clearPending();renderLinks();imagePicker?.cancel();dialog.close();} catch(error){message(error.message+'\n当前草稿仍然保留。');} finally{state.saving=false;busy(false);}
  });
  $('[data-links-search]')?.addEventListener('input',filterLinks);
  $('.links-filters')?.addEventListener('click',event=>{const button=event.target.closest('[data-link-category]');if(!button)return;state.category=button.dataset.linkCategory;for(const tab of $$('[data-link-category]')){const active=tab===button;tab.classList.toggle('is-active',active);tab.setAttribute('aria-pressed',String(active));}filterLinks();});
  scope.listen(window, 'beforeunload',event=>{if(state.saving&&state.recoveryStored)return;if(!state.dirty&&!state.busy&&!state.imageBusy&&!importDialog?.open&&!hasTransferDraft())return;event.preventDefault();event.returnValue='';});
  for(const cover of $$('[data-link-image]'))watchLinkImage(cover);
  filterLinks();
  if(local){
    state.pending=readPending();
    if(state.pending){
      const note=page.querySelector('.space-local-note');
      try{
        await loadState();
        if(pendingMatchesSpace(state.pending,state)){clearPending();if(note)note.textContent='上次保存已写入本机；已核对服务器资料，并清除待确认草稿。';}
        else{if(kind==='profile')await openProfile();else await openLink();}
      }catch(error){if(note)note.textContent='发现待确认的编辑草稿，仍保存在当前标签页。重新连接本地服务后打开编辑器即可恢复。'+error.message;}
    }
  }
  scope.listen(document,'astro:before-preparation',event=>{
    if(event.to?.pathname===location.pathname&&event.to?.search===location.search)return;
    if(state.busy||state.imageBusy){event.preventDefault();message('正在处理，请稍候。');return;}
    if(importDialog?.open&&!window.confirm('还有待导入的书签没有保存，确定离开预览吗？')){event.preventDefault();return;}
    if(hasTransferDraft()&&!window.confirm('粘贴的书签内容尚未读取，确定离开吗？')){event.preventDefault();return;}
    if(state.dirty&&!window.confirm('还有未保存的修改，确定离开吗？'))event.preventDefault();
    else state.dirty=false;
  });
};
const fallback={active:true,listen:(target,type,fn,options)=>target.addEventListener(type,fn,options),cleanup:()=>{}};
if(globalThis.FieldnotesRoute)globalThis.FieldnotesRoute.run('space-editor.js',initialize);else initialize(fallback);


})();
