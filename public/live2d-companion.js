import { modelReferences, rewriteLocalModel } from './live2d-model-utils.mjs';
import {createKaguyaRig} from './kaguya-rig.js';
import {prepareModelTextures} from './live2d-texture-adapter.mjs';

// All executable dependencies are vendored, version-pinned and served locally.
// File imports stay in this document's memory; no upload endpoint is called.
const pet = document.querySelector('[data-companion]');
const canvas = document.querySelector('[data-live2d-canvas]');
const select = document.querySelector('[data-live2d-mode]');
if (pet && canvas && select) {
  const avatar = pet.querySelector('[data-companion-avatar]');
  const caption = pet.querySelector('[data-live2d-caption]');
  const characterName = pet.querySelector('[data-live2d-name]');
  const status = document.querySelector('[data-live2d-status]');
  const pause = document.querySelector('[data-live2d-pause]');
  const chooser = document.querySelector('[data-live2d-import]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let app, model, rig, runtimePromise, generation = 0, manuallyPaused = false;
  let imported = null, activeURLs = [], source = 'yachiyo';
  let loading = false, failed = false, fetching = null;
  let disposed = false, loadedName = '', down = null;
  const scripts = new Map();
  const report = message => { status.textContent = message; };
  const remember = value => { try { localStorage.setItem('fieldnotes.live2d.mode', value); } catch {} };
  const script = (url, ready) => {
    if (ready()) return Promise.resolve();
    if (!scripts.has(url)) scripts.set(url, new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = url; tag.async = false;
      tag.onload = () => {if(ready())resolve();else{tag.remove();scripts.delete(url);reject(new Error('运行库初始化失败'));}};
      tag.onerror = () => { tag.remove(); scripts.delete(url); reject(new Error('本地运行库加载失败')); };
      document.head.append(tag);
    }));
    return scripts.get(url);
  };
  async function runtime(cubism = true) {
    if (!runtimePromise) runtimePromise = (async () => {
      await script('/live2d/pixi.min.js', () => Boolean(window.PIXI?.Application));
      await script('/live2d/pixi-csp.min.js', () => window.__pixiCspReady === true);
      if (!app && !disposed) {
        app = new window.PIXI.Application({view: canvas, width: 256, height: 400,
          // CSS owns the responsive stage size; resolution still scales the pixel buffer.
          transparent: true, antialias: true, autoDensity: false,
          resolution: Math.min(devicePixelRatio || 1, 2), autoStart: false,
          backgroundAlpha: 0, powerPreference: 'low-power'});
        app.ticker.maxFPS = 30;
        app.ticker.add?.(()=>{if(rig&&!quiet())rig.redraw(performance.now(),pet.dataset.state);});
      }
    })().catch(error => { runtimePromise = null; throw error; });
    await runtimePromise;
    if(cubism){
      const compatible=()=>{try{return window.Live2DCubismCore?.Version?.csmGetLatestMocVersion()>=5;}catch{return false;}};
      const previousMoc=window.Live2DCubismCore?.Moc;
      await script('/live2d/live2dcubismcore5.min.js', () => Boolean(window.Live2DCubismCore?.Moc) && (window.Live2DCubismCore.Moc!==previousMoc || compatible() || !window.Live2DCubismCore?.Version));
      // Official Core 5 initializes its embedded WASM asynchronously.
      if(window.Live2DCubismCore?.Version){
        for(let i=0;i<100&&!compatible()&&!disposed;i++)await new Promise(resolve=>setTimeout(resolve,20));
        if(!compatible())throw new Error('Cubism Core 5 初始化失败，请刷新后重试');
      }
      await script('/live2d/cubism4.min.js', () => Boolean(window.PIXI?.live2d?.Live2DModel));window.PIXI.live2d.config.sound=false;
    }
  }
  // The SSR bootstrap sets companionVisibility before companion.js sets pet.hidden.
  // Hidden/minimized/F8/background visits must not fetch the model or its runtimes.
  const presentationHidden = () => document.documentElement.dataset.uiHidden === 'yes' || document.documentElement.dataset.companionVisibility === 'hidden' || document.visibilityState === 'hidden' || pet.hidden;
  const quiet = () => manuallyPaused || reduced.matches || document.documentElement.dataset.motion === 'quiet' || presentationHidden() || source === 'portrait';
  function ensureLoaded() {
    if(disposed||presentationHidden()||source==='portrait'||failed||loading||model||rig)return;
    void load(source);
  }
  function syncMotion() {
    if (!app || (!model && !rig)) return;
    const stopped = quiet();
    if(model)model.autoUpdate = !stopped;
    if (stopped) { app.stop(); if(!presentationHidden())app.renderer.render(app.stage); }
    else app.start();
    pause.textContent = manuallyPaused ? '继续动作' : '暂停动作';
    pause.setAttribute('aria-pressed', String(manuallyPaused));
  }
  const revoke = urls => urls.forEach(url => URL.revokeObjectURL(url));
  function clearModel() {
    app?.stop();
    if(rig){app.stage.removeChild(rig.container);rig.destroy();rig=null;}
    if (model) { app.stage.removeChild(model); model.destroy({children: true, texture: true, baseTexture: true}); model = null; }
    revoke(activeURLs); activeURLs = [];
    pet.classList.remove('has-live2d');
    pet.classList.remove('has-kaguya-rig');
    caption.textContent = 'YACHIYO / 头像';
    characterName.textContent = '八千代';
    avatar.setAttribute('aria-label', '打开八千代月面通信；也可拖动立绘调整位置');
  }
  async function load(mode) {
    if(disposed)return;
    if(source!==mode){++generation;fetching?.abort();fetching=null;loading=false;clearModel();}
    source=mode;
    if(mode==='portrait'){failed=false;report('八千代头像');remember(mode);return;}
    if(presentationHidden()){report('八千代头像 · 展开后载入角色');return;}
    if(loading||model||rig)return;
    const current = ++generation;
    const controller=typeof AbortController==='function'?new AbortController():null;
    fetching=controller;loading=true;failed=false;
    let ownURLs=[];
    report(mode==='kaguya'?'正在载入旧版辉夜分层 2D…':'正在载入本地 Live2D…');
    try {
      await runtime(mode!=='kaguya');
      if (current !== generation || disposed) return;
      if(presentationHidden()){report('八千代头像 · 展开后载入角色');return;}
      if(mode==='kaguya'){
        const loaded=await createKaguyaRig(window.PIXI);
        if(current!==generation||disposed){loaded.destroy();return;}
        rig=loaded;app.stage.addChild(rig.container);
        // A real render must succeed before we replace the original portrait.
        rig.redraw(performance.now(),pet.dataset.state);app.renderer.render(app.stage);
        pet.classList.add('has-live2d');pet.classList.add('has-kaguya-rig');
        caption.textContent='KAGUYA / 自制分层 2D';characterName.textContent='辉夜';
        avatar.setAttribute('aria-label','辉夜自制分层2D同人模型；点击打开月面通信，可拖动位置');
        report('辉夜 · 自制分层/网格 2D 同人：眨眼、视线、口型、发梢、呼吸和挥手。不是 Cubism Live2D／.moc3，不是官方模型。');
        remember('kaguya');syncMotion();return;
      }
      let settings;
      loadedName = mode === 'custom' && imported ? imported.name : mode==='yachiyo'?'八千代 · Cubism Live2D':'Haru · 官方演示';
      if (mode === 'custom' && imported) {
        const urls = [];
        ownURLs=urls;
        const mapping = new Map();
        for (const [path, file] of imported.resources) { const url = URL.createObjectURL(file); urls.push(url); mapping.set(path, url); }
        settings = rewriteLocalModel(imported.json, path => mapping.get(path));
      } else {
        const base=mode==='yachiyo'?'Yachiyo':'Haru';
        const response = await fetch(`/live2d/models/${base}/${base}.model3.json`, {credentials: 'same-origin',signal:controller?.signal});
        if (!response.ok) throw new Error('本地模型清单不可读');
        const json = await response.json(); modelReferences(json);
        if(current!==generation||disposed)return;
        if(presentationHidden()){report('八千代头像 · 展开后载入角色');return;}
        settings = rewriteLocalModel(json, path => new URL(`/live2d/models/${base}/${path}`, location.origin).href);
        if(mode==='yachiyo'){
          const gl=app.renderer.gl;
          const maximum=gl?.getParameter?.(gl.MAX_TEXTURE_SIZE);
          // Prebuilt 2K atlases avoid downloading 8K originals/createImageBitmap work.
          report('正在载入八千代网页纹理…');
          const adapted=await prepareModelTextures(settings,{maxTextureSize:maximum,signal:controller?.signal,prebuilt:{manifestURL:'/live2d/models/Yachiyo/web/texture-manifest.json',baseURL:new URL('/live2d/models/Yachiyo/',location.origin).href},isCurrent:()=>current===generation&&!disposed});
          settings=adapted.settings;ownURLs=adapted.urls;
        }
      }
      if (current !== generation || disposed) { revoke(ownURLs);ownURLs=[];return; }
      if(presentationHidden()){revoke(ownURLs);ownURLs=[];report('八千代头像 · 展开后载入角色');return;}
      let loaded;
      loaded = await window.PIXI.live2d.Live2DModel.from(settings, {autoInteract: false, autoUpdate: false, motionPreload: 'ALL'});
      if (current !== generation || disposed) { loaded.destroy({children: true, texture: true, baseTexture: true}); revoke(ownURLs);ownURLs=[];return; }
      model = loaded; activeURLs = ownURLs;ownURLs=[];
      if(mode==='yachiyo'){
        const internal=model.internalModel;
        // This model rigs its real head controls under custom IDs; ParamAngleX
        // is only a tracking input and does not directly deform its mesh.
        internal.idParamAngleX='ParamAngle_HeadX';internal.idParamAngleY='ParamAngle_HeadY';internal.idParamAngleZ='ParamAngle_HeadZ';
        internal.idParamBodyAngleX='ParamAngle_BodyX';
        internal.on?.('beforeModelUpdate',()=>{
          const remaining=(model.__localNodUntil||0)-performance.now();
          if(remaining>0&&!quiet()){
            const t=(1100-remaining)/1100;
            internal.coreModel.addParameterValueById('ParamAngle_HeadY',Math.sin(t*Math.PI*2)*5*Math.sin(t*Math.PI));
          }
        });
      }
      const scale = Math.min(244 / model.width, 390 / model.height);
      model.scale.set(scale); model.anchor.set(.5, .5); model.position.set(128, 200);
      app.stage.addChild(model);
      // This executes the WebGL renderer before replacing the portrait. Errors keep the fallback.
      model.update(16); app.renderer.render(app.stage);
      pet.classList.add('has-live2d');
      caption.textContent = loadedName;
      characterName.textContent = mode === 'custom' ? '本地模型' : mode==='yachiyo'?'八千代':'Haru 演示';
      avatar.setAttribute('aria-label', `${loadedName} Live2D；点击打开月面通信，可拖动位置`);
      report(mode==='yachiyo'?'八千代 Live2D · 已载入':`${loadedName}${mode === 'custom' ? ' · 本页内存' : ''}`);
      remember(mode === 'custom' ? 'yachiyo' : mode);
      syncMotion();
    } catch (error) {
      revoke(ownURLs);ownURLs=[];
      if (current !== generation || disposed) return;
      clearModel(); failed=true;
      report(`已保留八千代头像。${error?.message || 'Live2D 暂不可用。'}`);
    }finally{
      if(current===generation){loading=false;if(fetching===controller)fetching=null;}
    }
  }
  function perform(kind) {
    if ((!model&&!rig) || quiet()) { if (model||rig) report('动作已暂停；可取消暂停或调整减少动态效果设置。'); return; }
    if(rig){rig.perform(kind);app.renderer.render(app.stage);return;}
    if (kind === 'expression') model.expression().catch(() => report('此模型没有可用表情。'));
    else {
      const groups = Object.keys(model.internalModel.motionManager.definitions || {});
      const group = groups.find(x => /tapbody|tap_body/i.test(x)) || groups.find(x => !/idle/i.test(x)) || groups[0];
      if (group) Promise.resolve(model.motion(group)).catch(() => report('此动作未能播放。'));
      else if(source==='yachiyo')model.__localNodUntil=performance.now()+1100;
    }
  }
  avatar.addEventListener('pointermove', event => {
    if ((!model&&!rig) || quiet() || down) return;
    const rect = canvas.getBoundingClientRect();
    (rig||model).focus((event.clientX - rect.left) / rect.width * 256, (event.clientY - rect.top) / rect.height * 400);
  });
  avatar.addEventListener('pointerleave', () => { if ((model||rig) && !quiet()) (rig||model).focus(128, 200); });
  avatar.addEventListener('pointerdown', e => { down = {x: e.clientX, y: e.clientY}; });
  avatar.addEventListener('pointerup', e => { const old = down; down = null; if (old && Math.hypot(e.clientX - old.x, e.clientY - old.y) < 6) perform('motion'); });
  avatar.addEventListener('pointercancel', () => { down = null; });
  document.querySelector('[data-live2d-motion]').addEventListener('click', () => perform('motion'));
  document.querySelector('[data-live2d-expression]').addEventListener('click', () => perform('expression'));
  pause.addEventListener('click', () => { manuallyPaused = !manuallyPaused; syncMotion(); });
  document.querySelector('[data-companion-wave]').addEventListener('click', () => perform('motion'));
  const syncPresentation=()=>{syncMotion();ensureLoaded();};
  const observer = new MutationObserver(syncPresentation);
  observer.observe(pet, {attributes: true, attributeFilter: ['hidden']});
  observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-motion','data-ui-hidden','data-companion-visibility']});
  document.addEventListener('visibilitychange', syncPresentation);
  reduced.addEventListener('change', syncPresentation);
  select.addEventListener('change', () => {failed=false;remember(select.value==='custom'?'yachiyo':select.value);return load(select.value);});
  chooser.addEventListener('change', async () => {
    const files = Array.from(chooser.files || []); chooser.value = '';
    if (!files.length) return;
    try {
      if (files.length > 250 || files.reduce((s, f) => s + f.size, 0) > 100 * 1024 * 1024 || files.some(f => f.size > 32 * 1024 * 1024)) throw new Error('最多 250 个文件，总量 100 MB，单文件 32 MB');
      const entries = files.filter(f => f.name.endsWith('.model3.json'));
      if (entries.length !== 1 || entries[0].size > 1024 * 1024) throw new Error('请选择恰好包含一个 .model3.json 的模型目录（清单不超过 1 MB）');
      const entry = entries[0], json = JSON.parse(await entry.text());
      const base = entry.webkitRelativePath.slice(0, -entry.name.length);
      const resources = new Map();
      for (const ref of modelReferences(json)) {
        const file = files.find(f => f.webkitRelativePath === base + ref);
        if (!file) throw new Error(`缺少模型资源：${ref}`);
        resources.set(ref, file);
      }
      imported = {json, resources, name: entry.name.replace(/\.model3\.json$/, '').slice(0, 60) + ' · 本地导入'};
      select.querySelector('option[value="custom"]').disabled = false;
      if(source==='custom'){++generation;fetching?.abort();fetching=null;loading=false;clearModel();}
      select.value = 'custom';failed=false;await load('custom');
    } catch (error) { report(`未导入：${error.message}。不会执行目录里的脚本，也不会上传文件。`); }
  });
  window.addEventListener('pagehide', event => {
    if (event?.persisted) { if (model) model.autoUpdate = false; app?.stop(); return; }
    disposed = true; ++generation;fetching?.abort();fetching=null; observer.disconnect(); clearModel();
    app?.destroy(false, {children: true, texture: true, baseTexture: true});
    imported = null;
  });
  window.addEventListener('pageshow', event => { if (event?.persisted && !disposed) syncPresentation(); });
  let preferred = 'yachiyo';
  try {
    const migrated=localStorage.getItem('fieldnotes.live2d.yachiyo-default')==='1';
    const saved=localStorage.getItem('fieldnotes.live2d.mode');
    if(migrated&&['portrait','kaguya','haru','yachiyo'].includes(saved))preferred=saved;
    else{localStorage.setItem('fieldnotes.live2d.mode','yachiyo');localStorage.setItem('fieldnotes.live2d.yachiyo-default','1');}
  } catch {}
  select.value = preferred; load(preferred);
}
