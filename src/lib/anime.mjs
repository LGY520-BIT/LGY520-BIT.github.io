/** Persisted anime-room contract. Bangumi posters are cached locally before save. */
export const ANIME_STATUSES = Object.freeze({
  watching: Object.freeze({ label: '正在追', icon: '🔥', short: 'NOW SHOWING' }),
  favorite: Object.freeze({ label: '殿堂神作', icon: '🏆', short: 'HALL OF FAME' }),
  completed: Object.freeze({ label: '已补完', icon: '✨', short: 'THE END, NOT GOODBYE' }),
  planned: Object.freeze({ label: '计划看', icon: '⏳', short: 'ON THE LIST' }),
});
export const ANIME_FALLBACK = '/images/anime/poster-fallback.svg';
export function normalizeAnimeSearch(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/gu, ' ').trim();
}
export function matchesAnime(item, status = 'all', query = '') {
  if (status !== 'all' && item.status !== status) return false;
  const needle = normalizeAnimeSearch(query).slice(0, 120);
  return !needle || normalizeAnimeSearch([item.title, item.titleJa, ...item.tags].join(' ')).includes(needle);
}
export function starParts(rating) {
  if (rating === null) return [0, 0, 0, 0, 0];
  if (!Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isInteger(rating * 2)) throw new TypeError('rating must be null or 0…5 in half-star steps');
  return Array.from({ length: 5 }, (_, index) => Math.max(0, Math.min(1, rating - index)));
}
export function validateAnimeData(data) {
  const fail = (message) => { throw new TypeError(`anime.json: ${message}`); };
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (!data || data.version !== 1 || typeof data.sampleMode !== 'boolean' || !text(data.notice, 500) || !Array.isArray(data.items) || data.items.length > 1000) fail('expected version 1, sampleMode, notice and up to 1000 items');
  const ids = new Set();
  for (const [index, item] of data.items.entries()) {
    const at = `items[${index}]`;
    if (!item || typeof item.id !== 'string' || !/^[a-z][a-z0-9-]{0,59}$/.test(item.id) || ids.has(item.id)) fail(`${at}.id must be unique and URL-safe`);
    ids.add(item.id);
    if (!text(item.title, 120) || !text(item.titleJa, 120) || !text(item.review, 240)) fail(`${at} needs title, titleJa and review`);
    if (!Object.hasOwn(ANIME_STATUSES, item.status)) fail(`${at}.status is unknown`);
    if (typeof item.example !== 'boolean' || (data.sampleMode && !item.example)) fail(`${at}.example must identify sample records`);
    if (!Array.isArray(item.tags) || item.tags.length > 4 || !item.tags.every(tag => text(tag, 20))) fail(`${at}.tags must contain up to four short strings`);
    try { starParts(item.rating); } catch { fail(`${at}.rating must be null or 0…5 in half-star steps`); }
    if (item.cover !== ANIME_FALLBACK && !/^\/images\/anime\/[a-z0-9-]+\.(?:webp|jpg|png)$/.test(item.cover)) fail(`${at}.cover must be a local poster path`);
    let url;
    try { url = new URL(item.officialUrl); } catch { fail(`${at}.officialUrl is invalid`); }
    if (url.protocol !== 'https:' || url.username || url.password) fail(`${at}.officialUrl must be a credential-free HTTPS link`);
    const p = item.progress;
    if (!p || !Number.isInteger(p.current) || !Number.isInteger(p.total) || p.current < 0 || p.total < 1 || p.total > 9999 || p.current > p.total) fail(`${at}.progress is out of range`);
    if (item.status === 'planned' && p.current !== 0) fail(`${at}: planned records cannot have watched episodes`);
    if (item.bangumi !== undefined) {
      const b = item.bangumi;
      if (!b || !Number.isSafeInteger(b.id) || b.id < 1 || b.id > 999999999 || item.id !== `bgm-${b.id}` || b.sourceUrl !== `https://bgm.tv/subject/${b.id}` || item.officialUrl !== b.sourceUrl) fail(`${at}.bangumi must identify its canonical subject`);
      if (b.score !== null && (!Number.isFinite(b.score) || b.score < 0 || b.score > 10)) fail(`${at}.bangumi.score is invalid`);
      if (!Number.isInteger(b.rank) || b.rank < 0 || b.rank > 9999999 || (b.airDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(b.airDate))) fail(`${at}.bangumi metadata is invalid`);
    }
  }
  return data;
}
