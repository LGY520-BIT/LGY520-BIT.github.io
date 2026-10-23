// Presentation-only helpers: collection records are never changed or persisted here.
export const ANIME_SHELF_PREFS_KEY = 'unfinished-anime-shelf-v1';
const STATUSES = new Set(['all', 'watching', 'favorite', 'completed', 'planned']);
const SORTS = new Set(['collection', 'rating', 'progress', 'title']);
const defaults = () => ({ status: 'all', query: '', sort: 'collection' });

export function normalizeShelfSearch(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\u0000-\u001f\u007f\s]+/gu, ' ').trim();
}

export function readShelfPreferences(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return defaults();
  let value;
  try { value = JSON.parse(raw); } catch { return defaults(); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults();
  return {
    status: STATUSES.has(value.status) ? value.status : 'all',
    query: typeof value.query === 'string' ? normalizeShelfSearch(value.query).slice(0, 120) : '',
    sort: SORTS.has(value.sort) ? value.sort : 'collection',
  };
}

const watched = item => {
  const value = item.current ?? item.progress?.current;
  return Number.isSafeInteger(value) && value >= 0 && value <= 9999 ? value : 0;
};
const total = item => {
  const value = item.total ?? item.progress?.total;
  return Number.isSafeInteger(value) && value > 0 && value <= 9999 ? value : null;
};
const rating = item => Number.isFinite(item.rating) && item.rating >= 0 && item.rating <= 5 ? item.rating : null;
const ratio = item => { const size = total(item); return size === null ? null : Math.min(watched(item), size) / size; };
const descending = (left, right) => left === null ? (right === null ? 0 : 1) : right === null ? -1 : right - left;

export function selectShelfItems(items, preferences = {}) {
  const status = STATUSES.has(preferences.status) ? preferences.status : 'all';
  const sort = SORTS.has(preferences.sort) ? preferences.sort : 'collection';
  const query = normalizeShelfSearch(preferences.query).slice(0, 120);
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({ item, index })).filter(({ item }) => {
    if (!item || typeof item !== 'object') return false;
    const haystack = item.searchText ?? [item.title, item.titleJa, ...(Array.isArray(item.tags) ? item.tags : [])].join(' ');
    return (status === 'all' || item.status === status) && (!query || normalizeShelfSearch(haystack).includes(query));
  }).sort((left, right) => {
    let difference = 0;
    if (sort === 'rating') difference = descending(rating(left.item), rating(right.item));
    if (sort === 'progress') difference = descending(ratio(left.item), ratio(right.item));
    if (sort === 'title') difference = normalizeShelfSearch(left.item.title).localeCompare(normalizeShelfSearch(right.item.title), 'zh-CN', { numeric: true, sensitivity: 'base' });
    return difference || left.index - right.index;
  }).map(({ item }) => item);
}

export function summarizeShelfItems(items) {
  const summary = { count: 0, watching: 0, episodes: 0, remaining: 0 };
  if (!Array.isArray(items)) return summary;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    summary.count++;
    // Sample cards remain searchable, but never inflate the owner's statistics.
    if (item.example === true) continue;
    if (item.status === 'watching') summary.watching++;
    const size = total(item), current = size === null ? watched(item) : Math.min(watched(item), size);
    summary.episodes += current;
    if (size !== null && item.status === 'watching') summary.remaining += Math.max(0, size - current);
  }
  return summary;
}
