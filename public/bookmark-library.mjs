// Pure bookmark-library helpers. Imported documents are always text, never mounted HTML.
export const BOOKMARK_PREFS_KEY = 'unfinished-bookmarks-view-v1';
export const BOOKMARK_IMPORT_LIMIT = 2 * 1024 * 1024;
export const BOOKMARK_LIMIT = 200;
const SCAN_LIMIT = 5000;
const ID = /^[A-Za-z0-9_-]{1,80}$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const INVALID_TEXT_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const fail = message => { throw new TypeError(message); };

function safeUrl(raw) {
  if (typeof raw !== 'string') return '';
  if (CONTROL.test(raw)) return '';
  const value = raw.trim();
  if (!value || value.length > 2048 || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function canonicalBookmarkUrl(raw) {
  const clean = safeUrl(raw);
  if (!clean) return '';
  const url = new URL(clean); url.hash = '';
  const pathname = url.pathname.replace(/\/+$/u, '') || '/';
  // Preserve case, query ordering and the query string itself: they can change a resource.
  return `${url.origin}${pathname}${url.search}`;
}

function safeImage(value, { allowData = false, allowExistingHttps = false } = {}) {
  if (typeof value !== 'string' || value.length > 550000) return '';
  if (value === '') return '';
  if (/^\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|gif)$/iu.test(value)) return value;
  const clean = safeUrl(value);
  if (clean.startsWith('https://') && (allowExistingHttps || !/\.svgz?$/iu.test(new URL(clean).pathname))) return clean;
  if (!allowData) return '';
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(value);
  if (!match || match[2].length % 4 !== 0) return '';
  try {
    const bytes = atob(match[2]);
    if (bytes.length > 400000 || btoa(bytes) !== match[2]) return '';
    const at = index => bytes.charCodeAt(index);
    const magic = match[1] === 'png' ? [137,80,78,71,13,10,26,10].every((n,i) => at(i) === n)
      : match[1] === 'jpeg' ? at(0) === 255 && at(1) === 216 && at(2) === 255
      : match[1] === 'gif' ? /^GIF8[79]a/u.test(bytes.slice(0,6))
      : bytes.slice(0,4) === 'RIFF' && bytes.slice(8,12) === 'WEBP';
    return magic ? value : '';
  } catch { return ''; }
}

function importedText(value, max, fallback = '') {
  const raw = typeof value === 'string' ? value : fallback;
  let clean = raw.replace(/[\u0000-\u001f\u007f]/gu, ' ').trim().slice(0,max);
  // Do not split a UTF-16 surrogate pair at a storage-field boundary.
  if (/[\ud800-\udbff]$/u.test(clean)) clean = clean.slice(0,-1);
  return clean;
}

export function normalizeImportItems(records, { defaultCategory = '导入' } = {}) {
  if (!Array.isArray(records)) fail('导入内容需要是网址列表。');
  if (records.length > SCAN_LIMIT) fail('导入文件最多扫描 5000 条网址，请先拆分文件。');
  const items = []; let invalid = 0, omittedImages = 0, overflow = 0;
  for (const record of records) {
    if (!object(record)) { invalid++; continue; }
    const url = safeUrl(record.url);
    if (!url) { invalid++; continue; }
    if (items.length >= BOOKMARK_LIMIT) { overflow++; continue; }
    const result = {
      title: importedText(record.title,80) || new URL(url).hostname.slice(0,80), url,
      description: importedText(record.description,280),
      category: importedText(record.category,30) || importedText(defaultCategory,30) || '导入',
      pinned: record.pinned === true
    };
    if (owns(record,'image')) {
      const image = safeImage(record.image);
      if (image || record.image === '') result.image = image;
      else if (record.image != null && record.image !== '') omittedImages++;
    }
    items.push(result);
  }
  const warnings = [];
  if (invalid) warnings.push(`已略过 ${invalid} 条无效或不安全的网址。`);
  if (omittedImages) warnings.push(`已略过 ${omittedImages} 张不支持的图片；网址仍可导入。`);
  if (overflow) warnings.push(`单次最多预览 200 条网址，另有 ${overflow} 条未载入。`);
  return { items, warnings };
}

const ENTITIES = Object.freeze({ amp:'&', quot:'"', apos:"'", lt:'<', gt:'>', nbsp:' ', colon:':', sol:'/', Tab:'\t', NewLine:'\n' });
function entities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|colon|sol|Tab|NewLine);/giu, (whole, key) => {
    if (key[0] !== '#') return ENTITIES[key] ?? ENTITIES[key.toLowerCase()] ?? whole;
    const numeric = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2),16) : parseInt(key.slice(1),10);
    return numeric > 0 && numeric <= 0x10ffff && !(numeric >= 0xd800 && numeric <= 0xdfff) ? String.fromCodePoint(numeric) : '\ufffd';
  });
}

function parseBrowserHtml(text) {
  // Parsing only known Netscape-bookmark anchors avoids DOMParser resource loads.
  // Scripts, styles and comments are removed before scanning; no document is executed.
  const source = text.replace(/<!--[\s\S]*?(?:-->|$)/gu,'')
    .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/giu,'')
    .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/giu,'');
  if ((source.match(/<a\b/giu) || []).length > SCAN_LIMIT) fail('导入文件最多扫描 5000 条网址，请先拆分文件。');
  const records = [];
  for (const match of source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/giu)) {
    const href = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/iu.exec(match[1]);
    if (!href) continue;
    records.push({ url:entities(href[1] ?? href[2] ?? href[3]), title:entities(match[2].replace(/<[^>]*>/gu,'')), category:'浏览器书签', description:'', pinned:false });
  }
  return normalizeImportItems(records,{defaultCategory:'浏览器书签'});
}

export function parseBookmarkImport(text, { filename = '' } = {}) {
  if (typeof text !== 'string') fail('无法读取导入文件，请选择 JSON 或浏览器书签 HTML。');
  if (text.length > BOOKMARK_IMPORT_LIMIT || new TextEncoder().encode(text).length > BOOKMARK_IMPORT_LIMIT) fail('导入文件不能超过 2 MB，请先拆分文件。');
  const source = text.replace(/^\uFEFF/u,'').trim();
  if (!source) fail('导入文件是空的。');
  if (/\.html?$/iu.test(filename) || /^<!DOCTYPE\s+NETSCAPE-Bookmark-file-1\b/iu.test(source)) {
    const result = parseBrowserHtml(source);
    if (!result.items.length) fail('没有找到可导入的网址，请选择浏览器导出的书签 HTML。');
    return result;
  }
  let data;
  try { data = JSON.parse(source); } catch { fail('JSON 格式不正确；也可以选择浏览器导出的 HTML 书签。'); }
  const records = Array.isArray(data) ? data : object(data) && Array.isArray(data.items) ? data.items : object(data?.links) && Array.isArray(data.links.items) ? data.links.items : null;
  if (!records) fail('JSON 中没有网址列表，请选择本博客导出的收藏文件。');
  if (!Array.isArray(data) && owns(data,'version') && data.version !== 1) fail('这个收藏文件版本暂不支持。');
  // Our versioned backup keeps already-valid fields exactly, including multiline
  // descriptions and legacy raster images. IDs are still regenerated on import.
  if(data?.version===1&&Array.isArray(data.items)&&records.every(item=>object(item)&&typeof item.id==='string')){
    const checked=strictLibrary(records);return {items:checked.map(({id,...item})=>item),warnings:[]};
  }
  const result = normalizeImportItems(records);
  if (!result.items.length) fail('没有找到可导入的有效网址。');
  return result;
}

function strictString(value,max,label,required=false) {
  if (typeof value !== 'string' || value.length > max || INVALID_TEXT_CONTROL.test(value) || required && !value.trim()) fail(`${label}格式不正确，未导出或合并任何内容。`);
  return value;
}
function strictCandidate(item, { withId = false, allowData = false, allowExistingHttps=withId } = {}) {
  if (!object(item)) fail('网址条目格式不正确。');
  const url = safeUrl(item.url);
  if (!url || item.url.trim() !== item.url) fail('网址必须是没有账号密码的 HTTP(S) 地址。');
  if (typeof item.pinned !== 'boolean') fail('网址置顶状态格式不正确。');
  const result = { title:strictString(item.title,80,'网址名称',true), url:item.url,
    description:strictString(item.description,280,'网址简介'),category:strictString(item.category,30,'网址分类',true),pinned:item.pinned };
  if (withId) {
    if (typeof item.id !== 'string' || !ID.test(item.id)) fail('网址标识格式不正确。');
    result.id = item.id;
  }
  if (owns(item,'image')) {
    // Existing images were already accepted by the local API: never block a whole
    // library export/merge because its legacy HTTPS cover uses an SVG URL.
    const image = safeImage(item.image,{allowData,allowExistingHttps});
    if (item.image !== '' && !image) fail('收藏图片格式不正确，未导出或合并任何内容。');
    result.image = item.image;
  }
  return result;
}
function strictLibrary(items) {
  if (!Array.isArray(items) || items.length > BOOKMARK_LIMIT) fail('网址收藏最多 200 项。');
  const ids = new Set();
  return items.map(item => {
    const result = strictCandidate(item,{withId:true,allowData:true});
    if (ids.has(result.id)) fail('网址标识重复，未导出或合并任何内容。');
    ids.add(result.id); return result;
  });
}

export function mergeBookmarkImport(existing, incoming) {
  strictLibrary(existing);
  if (!Array.isArray(incoming) || incoming.length > BOOKMARK_LIMIT) fail('单次最多合并 200 条网址。');
  const candidates = incoming.map(item => strictCandidate(item,{allowData:true,allowExistingHttps:true}));
  const items = existing.map(item => ({...item}));
  const seen = new Set(existing.map(item => canonicalBookmarkUrl(item.url)));
  const ids = new Set(existing.map(item => item.id));
  let added = 0, duplicates = 0, overflow = 0, nextId = 1;
  for (const item of candidates) {
    const key = canonicalBookmarkUrl(item.url);
    if (seen.has(key)) { duplicates++; continue; }
    // Treat repeated overflow candidates as duplicates, not multiple lost entries.
    seen.add(key);
    if (items.length >= BOOKMARK_LIMIT) { overflow++; continue; }
    while (ids.has(`link-import-${nextId}`)) nextId++;
    const id = `link-import-${nextId++}`; ids.add(id);
    items.push({id,...item}); added++;
  }
  return {items,added,duplicates,overflow};
}

export function exportBookmarkLibrary(items) {
  const values = strictLibrary(items);
  return JSON.stringify({version:1,items:values},null,2)+'\n';
}

export function exportBookmarkParts(items,{maxBytes=BOOKMARK_IMPORT_LIMIT-65536}={}){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<600000||maxBytes>BOOKMARK_IMPORT_LIMIT)fail('备份分卷大小无效。');
  const values=strictLibrary(items),parts=[];let group=[];
  const encode=items=>JSON.stringify({version:1,items},null,2)+'\n';
  for(const item of values){
    const next=[...group,item];
    if(new TextEncoder().encode(encode(next)).length>maxBytes){if(!group.length)fail('单条收藏超过备份大小上限。');parts.push(encode(group));group=[item];}
    else group=next;
  }
  if(group.length||!parts.length)parts.push(encode(group));
  return parts;
}

function collection(items) {
  if (!Array.isArray(items) || items.length > BOOKMARK_LIMIT || items.some(item => !object(item))) fail('网址列表格式不正确。');
  return items;
}
const normalized = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN');
export function sortBookmarks(items, mode = 'default') {
  if (!['default','title','site'].includes(mode)) mode = 'default';
  return collection(items).map((item,index) => ({item,index})).sort((a,b) => {
    const pin = Number(b.item.pinned === true)-Number(a.item.pinned === true); if (pin) return pin;
    if (mode === 'default') return a.index-b.index;
    if (mode === 'site') {
      const host = item => { try { return new URL(item.url).hostname; } catch { return ''; } };
      const site = host(a.item).localeCompare(host(b.item),'zh-CN'); if (site) return site;
    }
    return String(a.item.title || '').localeCompare(String(b.item.title || ''),'zh-CN') || a.index-b.index;
  }).map(record => record.item);
}

export function filterBookmarks(items,{query='',category=''}={}) {
  const search = normalized(query).trim(), group = normalized(category);
  return collection(items).filter(item => {
    if (group && normalized(item.category) !== group) return false;
    if (!search) return true;
    let hostname = ''; try { hostname = new URL(item.url).hostname; } catch {}
    return normalized([item.title,item.description,item.category,item.url,hostname].join(' ')).includes(search);
  });
}

export function readBookmarkPreferences(raw) {
  const defaults = {view:'grid',sort:'default'};
  if (typeof raw !== 'string' || raw.length > 4096) return defaults;
  let data; try { data = JSON.parse(raw); } catch { return defaults; }
  if (!object(data)) return defaults;
  return {view:['grid','list'].includes(data.view)?data.view:'grid',sort:['default','title','site'].includes(data.sort)?data.sort:'default'};
}
