export const IMAGE_FILE_LIMIT = 100 * 1024 * 1024;
export const IMAGE_UPLOAD_LIMIT = 1024 * 1024;
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export function imagePreviewUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020]/u.test(value)) return '';
  if (/^\/images\/[A-Za-z0-9_./-]+$/u.test(value) && !value.split('/').includes('..')) return value;
  try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href; } catch {}
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/u.test(value) && value.length <= 550000) return value;
  return '';
}

export async function prepareImageFile(file, { signal } = {}) {
  const check = () => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
  if (!file || !MIME_TYPES.has(file.type)) throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片。');
  if (file.size <= 0) throw new Error('这张图片是空文件，请重新选择。');
  if (file.size > IMAGE_FILE_LIMIT) throw new Error('原图不能超过 100 MB；不需要你手动压缩，选图后会自动优化。');
  check();
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = objectUrl;
    await image.decode(); check();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50000000) throw new Error(`图片尺寸过大或宽高无效（${image.naturalWidth} × ${image.naturalHeight}）；单张支持 5000 万像素以内，避免浏览器解码时内存不足。`);
    const canvas = document.createElement('canvas');
    let ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('浏览器无法处理这张图片，请换一张再试。');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/webp', Math.max(.58, .86 - attempt * .08));
      check();
      if (/^data:image\/(?:webp|png);base64,/u.test(data) && data.length <= Math.floor(IMAGE_UPLOAD_LIMIT * 4 / 3)) return data;
      ratio *= .75;
    }
    throw new Error('图片压缩后仍然过大，请选择小一些的图片。');
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function mountImagePicker(element, { getValue, setValue, upload, notify = () => {}, onBusy = () => {}, prepare = prepareImageFile, chooseExisting } = {}) {
  if (!element) return null;
  const $ = selector => element.querySelector(selector);
  const input = $('[data-image-file]'), choose = $('[data-image-choose]'), remove = $('[data-image-remove]');
  const library = $('[data-image-library]');
  const preview = $('[data-image-preview]'), empty = $('[data-image-empty]'), status = $('[data-image-status]');
  if (!input || !choose || !remove || !preview || !empty || !status) throw new Error('图片选择器缺少控件。');
  let alive = true, serial = 0, busy = false, controller;
  const emptyText = empty.textContent;
  const listeners = [];
  const listen = (target, name, handler) => { target.addEventListener(name, handler); listeners.push(() => target.removeEventListener(name, handler)); };
  const message = text => { if (alive) status.textContent = text; };
  function sync() {
    if (!alive) return;
    const value = imagePreviewUrl(getValue());
    empty.textContent = emptyText;
    preview.hidden = !value; empty.hidden = Boolean(value); remove.hidden = !getValue();
    if (value) preview.src = value; else preview.removeAttribute('src');
    choose.textContent = getValue() ? '更换图片' : '选择图片';
  }
  function setBusy(value) {
    busy = value; choose.disabled = value; remove.disabled = value;if(library)library.disabled=value;
    element.setAttribute('aria-busy', String(value)); onBusy(value);
  }
  function cancel() {
    serial++; controller?.abort(); controller = null; input.value = '';
    if (busy) setBusy(false);
    message('');
  }
  async function select(file) {
    if (!alive || !file) return;
    cancel(); const id = serial; controller = new AbortController(); setBusy(true); message('正在处理图片…');
    try {
      const data = await prepare(file, { signal: controller.signal });
      if (!alive || id !== serial) return;
      message('正在上传…');
      const value = await upload(data);
      if (!alive || id !== serial) return;
      if (typeof value !== 'string' || !/^\/images\/uploads\/[a-f0-9]{64}\.webp$/u.test(value)) throw new Error('服务未返回有效的图片地址，请重试。');
      setValue(value); sync(); message('图片已选好'); notify('图片已选好');
    } catch (error) {
      if (alive && id === serial && error?.name !== 'AbortError') { const text = error?.message || '图片上传失败，请重试。'; message(text); notify(text); }
    } finally { if (alive && id === serial) { controller = null; input.value = ''; setBusy(false); } }
  }
  listen(choose, 'click', () => { if (!busy) input.click(); });
  if(library)listen(library,'click',async()=>{
    if(busy||!alive)return;cancel();const id=serial;controller=new AbortController();setBusy(true);message('正在读取素材…');
    try{
      const select=chooseExisting||(await import('./media-picker.mjs')).chooseMedia;
      if(!alive||id!==serial)return;
      const value=await select({signal:controller.signal});
      if(!alive||id!==serial)return;if(!value){message('已取消选择');return;}
      if(!/^\/images\/uploads\/[a-f0-9]{64}\.webp$/u.test(value))throw new Error('请选择本地素材库中的图片');
      setValue(value);sync();message('已复用图片');notify('已复用图片');
    }catch(error){if(alive&&id===serial&&error?.name!=='AbortError')message(error.message||'无法打开素材库');}
    finally{if(alive&&id===serial){controller=null;setBusy(false);}}
  });
  listen(input, 'change', () => { void select(input.files?.[0]); });
  listen(remove, 'click', () => { if (busy) return; cancel(); setValue(''); sync(); message('已移除图片'); });
  listen(preview, 'error', () => { preview.hidden = true; empty.hidden = false; empty.textContent = '图片暂时无法预览'; });
  sync();
  return { sync, cancel, select, get busy() { return busy; }, destroy() { cancel(); alive = false; listeners.forEach(fn => fn()); } };
}
