(() => {
/* Progressive enhancement only: the full local collection is readable without JavaScript. */
const initialize = async (scope) => {
  'use strict';
  const root = document.querySelector('[data-anime-room]');
  if (!scope.active || !root || root.dataset.animeReady) return;
  const cards = Array.from(root.querySelectorAll('[data-anime-card]'));
  const buttons = Array.from(root.querySelectorAll('[data-anime-filter]'));
  const input = root.querySelector('[data-anime-search]');
  const count = root.querySelector('[data-anime-count]');
  const empty = root.querySelector('[data-anime-empty]');
  const tools = root.querySelector('[data-anime-tools]');
  const reset = root.querySelector('[data-anime-reset]');
  const clear = root.querySelector('[data-anime-clear]');
  const sort = root.querySelector('[data-anime-sort]');
  const grid = root.querySelector('[data-anime-grid]');
  if (!tools || !input || !count || !empty || !reset) return;
  root.dataset.animeReady = 'loading';
  scope.cleanup(() => { delete root.dataset.animeReady; });
  let helpers;
  try { helpers = await import('/anime-shelf.mjs'); }
  catch { if (scope.active) delete root.dataset.animeReady; return; }
  if (!scope.active) return;
  if (root.isConnected === false) { delete root.dataset.animeReady; return; }
  const { ANIME_SHELF_PREFS_KEY, normalizeShelfSearch, readShelfPreferences, selectShelfItems, summarizeShelfItems } = helpers;
  const statuses = new Set(['all', 'watching', 'favorite', 'completed', 'planned']);
  const sorts = new Set(['collection', 'rating', 'progress', 'title']);
  let storage = null, raw = null;
  try { storage = globalThis.localStorage; raw = storage?.getItem(ANIME_SHELF_PREFS_KEY); } catch { /* Private browsing may disable storage. */ }
  let preferences = readShelfPreferences(raw);
  input.value = preferences.query;
  if (sort) sort.value = preferences.sort;
  const records = cards.map(card => ({
    card, status: card.dataset.animeStatus, title: card.dataset.animeTitle || '',
    searchText: card.dataset.animeSearchText || '',
    rating: card.dataset.animeRating === '' || card.dataset.animeRating == null ? null : Number(card.dataset.animeRating),
    current: Number(card.dataset.animeCurrent), total: Number(card.dataset.animeTotal),
    example: card.dataset.animeExample === 'true',
  }));
  const sampleSuffix = root.dataset.animeSample === 'true' ? ' · 状态与评分均为示例' : '';
  const summaries = Array.from(root.querySelectorAll('[data-anime-summary]'));
  function save() {
    if (!scope.active) return;
    preferences = readShelfPreferences(JSON.stringify({ status: preferences.status, query: normalizeShelfSearch(preferences.query).slice(0, 120), sort: preferences.sort }));
    try { storage?.setItem(ANIME_SHELF_PREFS_KEY, JSON.stringify(preferences)); } catch { /* The current view still works without persistence. */ }
  }
  function render() {
    if (!scope.active) return;
    const visible = selectShelfItems(records, preferences), shown = new Set(visible);
    for (const record of records) record.card.hidden = !shown.has(record);
    if (grid) {
      const ordered = selectShelfItems(records, { sort: preferences.sort });
      const existing = Array.from(grid.querySelectorAll('[data-anime-card]'));
      if (ordered.some((record, index) => existing[index] !== record.card)) {
        const focused = document.activeElement;
        const preserveFocus = focused && grid.contains?.(focused);
        for (const record of ordered) grid.appendChild(record.card);
        if (preserveFocus && document.activeElement !== focused) focused.focus({ preventScroll: true });
      }
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.animeFilter === preferences.status));
    const summary = summarizeShelfItems(visible);
    for (const node of summaries) if (Object.hasOwn(summary, node.dataset.animeSummary)) node.textContent = String(summary[node.dataset.animeSummary]);
    count.textContent = `显示 ${visible.length} / ${cards.length} 部${sampleSuffix}`;
    empty.hidden = visible.length !== 0;
  }
  for (const button of buttons) scope.listen(button, 'click', () => {
    if (!scope.active || !statuses.has(button.dataset.animeFilter)) return;
    preferences.status = button.dataset.animeFilter;
    save(); render();
  });
  scope.listen(input, 'input', () => {
    if (!scope.active) return;
    preferences.query = input.value;
    save(); render();
  });
  if (sort) scope.listen(sort, 'change', () => {
    if (!scope.active || !sorts.has(sort.value)) return;
    preferences.sort = sort.value;
    save(); render();
  });
  const resetView = () => {
    if (!scope.active) return;
    preferences = readShelfPreferences(null); input.value = '';
    if (sort) sort.value = 'collection';
    try { storage?.removeItem(ANIME_SHELF_PREFS_KEY); } catch { /* Reset also works in memory. */ }
    render(); input.focus();
  };
  scope.listen(reset, 'click', resetView);
  if (clear && clear !== reset) scope.listen(clear, 'click', resetView);
  for (const image of root.querySelectorAll('[data-anime-poster]')) {
    let failed = false;
    const fallback = () => {
      if (!scope.active || failed) return;
      failed = true;
      image.src = '/images/anime/poster-fallback.svg';
      image.alt = '海报暂不可用 · 月面放映室占位图';
    };
    scope.listen(image, 'error', fallback);
    if (image.complete && image.naturalWidth === 0) fallback();
  }
  root.dataset.animeReady = 'true';
  render();
  tools.hidden = false;
};
const fallback={active:true,listen:(target,type,fn,options)=>target.addEventListener(type,fn,options),cleanup:()=>{}};
if(globalThis.FieldnotesRoute)globalThis.FieldnotesRoute.run('anime-room.js',initialize);else initialize(fallback);


})();
