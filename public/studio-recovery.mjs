// Article-only recovery. No settings form, API token, screenshot or AI state is read here.
export const DRAFT_PREFIX = 'fieldnotes-studio-recovery-v1:';
export const MAX_ENTRY_BYTES = 1536 * 1024;
export const MAX_ENTRIES = 12;
const POST_ID = /^post:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const utf8Bytes = (value) => new TextEncoder().encode(value).byteLength;
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
export const draftId = (slug) => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80 ? `post:${slug}` : 'new';
const validId = (value) => value === 'new' || (typeof value === 'string' && value.length <= 85 && POST_ID.test(value));

export function articleDraft(value, { forExport = false } = {}) {
  if (!isObject(value)) throw new Error('恢复草稿格式无效。');
  const result = {};
  for (const [name, max] of Object.entries({ slug: 80, title: 180, description: 600, date: 10, category: 80, cover: 4096, body: MAX_ENTRY_BYTES })) {
    if (typeof value[name] !== 'string' || (!forExport && value[name].length > max)) throw new Error(`恢复草稿的 ${name} 字段无效或过长。`);
    result[name] = value[name];
  }
  if (!Array.isArray(value.tags) || (!forExport && value.tags.length > 50) || value.tags.some((tag) => typeof tag !== 'string' || (!forExport && tag.length > 80))) throw new Error('恢复草稿标签无效。');
  result.tags = [...value.tags];
  for (const name of ['featured', 'sample', 'draft']) {
    if (typeof value[name] !== 'boolean') throw new Error('恢复草稿状态无效。');
    result[name] = value[name];
  }
  return result;
}

export function decodeDraft(raw, expectedId) {
  if (typeof raw !== 'string' || utf8Bytes(raw) > MAX_ENTRY_BYTES) return null;
  try {
    const value = JSON.parse(raw);
    if (!isObject(value) || value.version !== 1 || !validId(value.id) || (expectedId && value.id !== expectedId) || !Number.isSafeInteger(value.savedAt) || value.savedAt < 0 || typeof value.nonce !== 'string' || value.nonce.length > 128) return null;
    if (value.baselineRevision !== null && (typeof value.baselineRevision !== 'string' || !/^[a-f0-9]{64}$/i.test(value.baselineRevision))) return null;
    const draft = articleDraft(value.draft);
    if (value.id !== 'new' && draft.slug !== value.id.slice(5)) return null;
    return { version: 1, id: value.id, savedAt: value.savedAt, nonce: value.nonce, baselineRevision: value.baselineRevision, draft };
  } catch { return null; }
}

export function createDraftStore({ local, session, now = Date.now, nonce = () => `${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` } = {}) {
  const stores = [{ storage: local, kind: 'local' }, { storage: session, kind: 'session' }].filter((item) => item.storage);
  const rawAt = (storage, id) => { try { return storage.getItem(DRAFT_PREFIX + id); } catch { return null; } };
  const read = (id) => {
    if (!validId(id)) return null;
    const snapshots = stores.map(({ storage, kind }) => ({ storage, kind, raw: rawAt(storage, id) }));
    const candidates = snapshots.map((item) => ({ ...item, entry: decodeDraft(item.raw, id) })).filter((item) => item.entry).sort((a, b) => b.entry.savedAt - a.entry.savedAt);
    return candidates[0] ? { entry: candidates[0].entry, kind: candidates[0].kind, snapshots } : null;
  };
  const list = () => {
    const ids = new Set();
    for (const { storage } of stores) {
      try {
        for (let index = 0; index < storage.length; index++) {
          const key = storage.key(index);
          if (typeof key === 'string' && key.startsWith(DRAFT_PREFIX) && validId(key.slice(DRAFT_PREFIX.length))) ids.add(key.slice(DRAFT_PREFIX.length));
        }
      } catch { /* One unavailable store must not block the other. */ }
    }
    return [...ids].map(read).filter(Boolean).sort((a, b) => b.entry.savedAt - a.entry.savedAt);
  };
  const write = (id, value, baselineRevision = null) => {
    try {
      if (!validId(id)) throw new Error('草稿标识无效。');
      const previous = read(id);
      const entry = { version: 1, id, savedAt: Math.max(now(), (previous?.entry.savedAt || 0) + 1), nonce: nonce(), baselineRevision, draft: articleDraft(value) };
      const raw = JSON.stringify(entry);
      if (!decodeDraft(raw, id)) throw new Error('草稿过大或格式无效（单篇最多 1.5 MiB），请先导出 Markdown。');
      if (!previous && list().length >= MAX_ENTRIES) throw new Error('恢复草稿已达 12 篇，请先导出或丢弃旧稿；当前内容仍可导出。');
      for (const { storage, kind } of stores) {
        try {
          storage.setItem(DRAFT_PREFIX + id, raw);
          // A newer write supersedes any old fallback; compare before removing it.
          for (const other of stores) {
            if (other.storage === storage) continue;
            const stale = rawAt(other.storage, id), decoded = decodeDraft(stale, id);
            if (decoded && decoded.savedAt < entry.savedAt && rawAt(other.storage, id) === stale) { try { other.storage.removeItem(DRAFT_PREFIX + id); } catch { /* harmless stale fallback */ } }
          }
          const receipt = read(id);
          return { ok: true, kind, receipt };
        } catch { /* Quota/private mode: try sessionStorage, never the server. */ }
      }
      return { ok: false, message: '浏览器存储不可用或已满，恢复草稿未保存。请导出 Markdown，勿直接关闭页面。' };
    } catch (error) { return { ok: false, message: `${error.message || '恢复草稿未保存。'} 请导出 Markdown 保留当前内容。` }; }
  };
  const clearIfSame = (receipt) => {
    if (!receipt?.entry || !validId(receipt.entry.id)) return false;
    let removed = false;
    for (const item of receipt.snapshots || []) {
      try {
        if (item.raw !== null && item.storage.getItem(DRAFT_PREFIX + receipt.entry.id) === item.raw) { item.storage.removeItem(DRAFT_PREFIX + receipt.entry.id); removed = true; }
      } catch { /* Do not silently claim deletion when storage is denied. */ }
    }
    return removed;
  };
  return { read, list, write, clearIfSame };
}

// JSON's double-quoted strings/arrays are valid YAML flow values. Never interpolate
// user text as a raw YAML line: titles may contain newlines, "---", or YAML tags.
export function markdownDocument(value) {
  const draft = articleDraft(value, { forExport: true });
  const quote = (text) => JSON.stringify(text).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const frontmatter = ['title', 'description', 'date', 'category', 'cover'].map((key) => `${key}: ${quote(draft[key])}`);
  frontmatter.push(`tags: ${JSON.stringify(draft.tags)}`, `featured: ${draft.featured}`, `sample: ${draft.sample}`, `draft: ${draft.draft}`);
  return `---\n${frontmatter.join('\n')}\n---\n\n${draft.body}`;
}
