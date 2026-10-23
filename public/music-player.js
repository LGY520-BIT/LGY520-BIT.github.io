/* Original local scores. User files stay in memory; nothing is uploaded. */
(() => {
  'use strict';
  const init = () => {
    const root = document.querySelector('[data-music-player]');
    if (!root || root.dataset.initialized) return;
    const find = (key) => root.querySelector(`[data-music-${key}]`);
    const audio = find('audio');
    if (!audio) return;
    const previousController = window.FieldnotesMusicPlayer;
    if (previousController && previousController.audio !== audio) {
      if (previousController.root?.isConnected !== false) { root.dataset.initialized = 'duplicate'; audio.pause(); return; }
      previousController.dispose?.();
    }
    root.dataset.initialized = 'true';
    const pageMode = root.dataset.musicView === 'page';
    if (pageMode) find('panel').hidden = false;
    const storageKey = 'fieldnotes-music-v1';
    const builtins = [
      { id: 'moonwalk', title: '月沿散步', artist: '未完 · 原创钢琴小品', src: '/audio/moonwalk.wav', caption: '48 秒 / 原创 · 非 OST' },
      { id: 'starlit-letter', title: '星间来信', artist: '未完 · 原创电子轻乐', src: '/audio/starlit-letter.wav', caption: '43 秒 / 原创 · 非 OST' }
    ];
    const tracks = builtins.map((track) => ({ ...track }));
    const blobs = [];
    let requestedPlay = false, pendingPlay = false, routePlayback = null;
    let selected = 0, restoreTime = 0, epoch = 0, lastSavedSecond = -1, userIntent = 0;
    let refreshMetadata = () => {}, updateLyrics = () => {}, disposeMetadata = () => {};
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* Private mode. */ }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    selected = Math.max(0, builtins.findIndex((track) => track.id === saved.id));
    restoreTime = builtins.some((track) => track.id === saved.id) && Number.isFinite(saved.time) && saved.time >= 0 && saved.time <= 7200 ? saved.time : 0;
    audio.volume = Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.4;
    audio.muted = saved.muted === true;
    const modes = ['stop', 'list', 'one', 'shuffle'];
    let mode = modes.includes(saved.mode) ? saved.mode : saved.repeat === true ? 'one' : 'stop';
    let beforeRepeat = mode === 'one' ? 'stop' : mode, shuffleBag = [], shuffleHistory = [], shuffleForward = [];
    audio.loop = mode === 'one';
    const favoritesKey = 'fieldnotes-music-favorites-v1';
    const persistentId = (id) => typeof id === 'string' && (builtins.some((track) => track.id === id) || /^[a-f0-9]{32}$/.test(id));
    let favorites = new Set();
    try {
      const stored = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
      if (Array.isArray(stored)) favorites = new Set(stored.filter(persistentId).slice(-256));
    } catch { /* Optional local favorites. */ }
    const trackIds = (track) => [track.id, ...(track.aliases || [])];
    const isFavorite = (track) => trackIds(track).some((id) => favorites.has(id));
    const normalize = (text) => String(text || '').normalize('NFKC').toLocaleLowerCase('zh-CN').trim().replace(/\s+/gu, ' ');
    const timeLabel = (value) => { const seconds = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0; return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };
    const status = (text) => { find('status').textContent = text; };
    const save = () => {
      const track = tracks[selected];
      const value = { id: track.local ? builtins[0].id : track.id, time: track.local ? 0 : Number.isFinite(audio.currentTime) ? audio.currentTime : 0, volume: audio.volume, muted: audio.muted, repeat: audio.loop, mode };
      try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Playback does not depend on storage. */ }
    };
    const syncListState = () => {
      const playing = !audio.paused && !audio.ended;
      for (const item of find('list').children) {
        const current = item.dataset.trackId === tracks[selected].id, button = item.children[0];
        item.dataset.current = String(current);
        button?.setAttribute('aria-current', String(current));
        button?.setAttribute('aria-label', `${current && pendingPlay ? '取消播放' : current && playing ? '暂停' : '播放'} ${item.dataset.trackTitle || ''}`);
        if (button?.children[2]) button.children[2].textContent = current ? playing || pendingPlay ? 'Ⅱ' : '▶' : '＋';
      }
      const on = isFavorite(tracks[selected]);
      for (const key of ['favorite', 'dock-favorite']) {
        const favorite = find(key); if (!favorite) continue;
        favorite.textContent = key === 'favorite' ? on ? '♥ 已收藏' : '♡ 收藏' : on ? '♥' : '♡';
        favorite.setAttribute('aria-pressed', String(on));
        favorite.setAttribute('aria-label', `${on ? '取消收藏' : '收藏'} ${tracks[selected].title}`);
      }
    };
    const syncControls = () => {
      const playing = !audio.paused && !audio.ended;
      root.dataset.playing = String(playing);
      root.dataset.loading = String(pendingPlay);
      find('play-icon').textContent = playing || pendingPlay ? 'Ⅱ' : '▶';
      find('play').setAttribute('aria-label', pendingPlay ? '取消播放' : playing ? '暂停' : '播放');
      find('play').setAttribute('aria-busy', String(pendingPlay));
      find('play').title = pendingPlay ? '取消播放' : playing ? '暂停' : '播放';
      if(find('dock-title'))find('dock-title').textContent=tracks[selected].title;
      if(find('dock-state'))find('dock-state').textContent=pendingPlay?'正在加载':playing?'正在播放':'已暂停';
      if(find('dock-icon'))find('dock-icon').textContent=playing||pendingPlay?'Ⅱ':'▶';
      find('dock-play')?.setAttribute('aria-label',pendingPlay?'取消播放':playing?'暂停':'播放');
      find('dock-play')?.setAttribute('aria-busy',String(pendingPlay));
      find('mini').textContent = playing ? `正在播放 · ${tracks[selected].title}` : `已暂停 · ${tracks[selected].title}`;
      find('mute').setAttribute('aria-pressed', String(audio.muted));
      find('mute').setAttribute('aria-label', audio.muted ? '取消静音' : '静音');
      find('mute').textContent = audio.muted ? '♩' : '♪';
      if (find('dock-mute')) { find('dock-mute').textContent = audio.muted ? '♩' : '♪'; find('dock-mute').setAttribute('aria-pressed', String(audio.muted)); find('dock-mute').setAttribute('aria-label', audio.muted ? '取消静音' : '静音'); }
      find('volume').value = String(Math.round(audio.volume * 100));
      find('volume-value').textContent = `${Math.round(audio.volume * 100)}%`;
      if(typeof navigator!=='undefined'&&navigator.mediaSession){navigator.mediaSession.playbackState=playing?'playing':'paused';if(typeof MediaMetadata!=='undefined')navigator.mediaSession.metadata=new MediaMetadata({title:tracks[selected].title,artist:tracks[selected].artist,album:tracks[selected].album||'往事.未完'});}
      find('repeat').setAttribute('aria-pressed', String(audio.loop));
      find('repeat').setAttribute('aria-label', audio.loop ? '关闭单曲循环' : '开启单曲循环');
      if (find('mode')) find('mode').value = mode;
      syncListState();
    };
    const syncTime = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      find('seek').disabled = !duration;
      find('seek').value = duration ? String(Math.min(1000, Math.max(0, audio.currentTime / duration * 1000))) : '0';
      find('seek').setAttribute('aria-valuetext', `${timeLabel(audio.currentTime)} / ${timeLabel(duration)}`);
      find('current').textContent = timeLabel(audio.currentTime);
      find('duration').textContent = timeLabel(duration);
      if (find('dock-current')) find('dock-current').textContent = timeLabel(audio.currentTime);
      if (find('dock-duration')) find('dock-duration').textContent = timeLabel(duration);
      if (find('dock-seek')) { find('dock-seek').disabled = !duration; find('dock-seek').value = find('seek').value; find('dock-seek').setAttribute('aria-valuetext', `${timeLabel(audio.currentTime)} / ${timeLabel(duration)}`); }
      updateLyrics();
    };
    const renderList = () => {
      const list = find('list');
      // Only replace focus that was already inside the playlist. Next/previous,
      // imports and other controls keep their own focus when this list redraws.
      const focusedRow = Array.from(list.children).find((item) => item.contains(document.activeElement));
      const focusedId = focusedRow?.dataset.trackId;
      const focusedFavorite = focusedRow?.children[1] === document.activeElement;
      list.replaceChildren();
      const terms = normalize(String(find('library-filter')?.value || '').slice(0, 120)).split(' ').filter(Boolean);
      const favoritesOnly = find('library-view')?.value === 'favorites';
      const sort = find('library-sort')?.value;
      const entries = tracks.map((track, index) => ({ track, index })).filter(({ track }) =>
        (!favoritesOnly || isFavorite(track)) && terms.every((term) => normalize(`${track.title} ${track.artist} ${track.album || ''}`).includes(term)));
      if (sort === 'title' || sort === 'artist') entries.sort((a, b) => normalize(a.track[sort]).localeCompare(normalize(b.track[sort]), 'zh-CN', { numeric: true }) || a.index - b.index);
      entries.forEach(({ track, index }) => {
        const item = document.createElement('li'), button = document.createElement('button');
        item.className = 'moon-player__list-row'; item.dataset.trackId = track.id; item.dataset.trackTitle = track.title;
        button.className = 'moon-player__list-play';
        button.type = 'button';
        button.setAttribute('aria-current', String(index === selected));
        button.setAttribute('aria-label', `播放 ${track.title}`);
        const number = document.createElement('span'), copy = document.createElement('span'), title = document.createElement('strong'), subtitle = document.createElement('small'), mark = document.createElement('span');
        number.className = 'moon-player__list-number'; number.textContent = String(index + 1).padStart(2, '0');
        copy.className = 'moon-player__list-copy'; title.textContent = track.title; subtitle.textContent = track.caption;
        copy.append(title, subtitle); mark.className = 'moon-player__list-mark'; mark.textContent = index === selected ? '◉' : '＋';
        button.append(number, copy, mark);
        button.addEventListener('click', () => {
          if (index === selected && !audio.ended) {
            togglePlayback();
          } else { select(index); void play(); }
        });
        const favorite = document.createElement('button');
        favorite.type = 'button'; favorite.className = 'moon-player__list-favorite';
        favorite.setAttribute('data-music-favorite-id', track.id);
        favorite.textContent = isFavorite(track) ? '♥' : '♡';
        favorite.setAttribute('aria-pressed', String(isFavorite(track)));
        favorite.setAttribute('aria-label', `${isFavorite(track) ? '取消收藏' : '收藏'} ${track.title}`);
        favorite.addEventListener('click', () => toggleFavorite(track.id));
        item.append(button, favorite); list.append(item);
      });
      if (find('list-count')) find('list-count').textContent = `${entries.length} / ${tracks.length} 首${favoritesOnly ? ' · 我的收藏' : ''}`;
      if (find('list-empty')) {
        find('list-empty').hidden = entries.length > 0;
        find('list-empty').textContent = terms.length ? '没有找到这首歌，换个关键词试试。' : favoritesOnly ? '还没有收藏，点歌曲旁的 ♡ 留下来。' : '暂时没有歌曲。';
      }
      syncListState();
      const replacement = focusedId && Array.from(list.children).find((item) => item.dataset.trackId === focusedId);
      if (replacement) replacement.children[focusedFavorite ? 1 : 0]?.focus({ preventScroll: true });
      else if (focusedId) (find('library-view') || find('library-filter'))?.focus({ preventScroll: true });
    };
    const toggleFavorite = (id) => {
      const track = tracks.find((track) => track.id === id); if (!track) return;
      if (isFavorite(track)) trackIds(track).forEach((alias) => favorites.delete(alias)); else favorites.add(id);
      const ids = Array.from(favorites).filter(persistentId);
      while (ids.length > 256) favorites.delete(ids.shift());
      try { localStorage.setItem(favoritesKey, JSON.stringify(Array.from(favorites).filter(persistentId))); } catch { /* In-memory favorites still work. */ }
      renderList();
    };
    const select = (index, initial = false, fromAdvance = false) => {
      if (!initial) { userIntent++; if (!fromAdvance) { shuffleHistory = []; shuffleForward = []; } }
      epoch++;
      pendingPlay = false; audio.pause(); requestedPlay = false;
      selected = (index + tracks.length) % tracks.length;
      shuffleBag = shuffleBag.filter((id) => id !== tracks[selected].id);
      if (!initial) restoreTime = 0;
      find('play').disabled = false;
      const track = tracks[selected];
      track.usingFallback = Boolean(track.library && (find('compat')?.checked || (track.format === 'FLAC' && typeof audio.canPlayType === 'function' && !audio.canPlayType('audio/flac'))));
      audio.src = track.usingFallback ? track.fallbackSrc : track.src;
      audio.load();
      find('title').textContent = tracks[selected].title;
      find('artist').textContent = tracks[selected].artist;
      refreshMetadata();
      syncTime(); syncControls(); renderList();
      if (!initial) { save(); status('已选曲，点击播放。'); }
    };
    const fallback = () => {
      const track = tracks[selected];
      if (!track.library || track.usingFallback || !track.fallbackSrc) return false;
      const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      epoch++; audio.pause(); track.usingFallback = true; audio.src = track.fallbackSrc; audio.load(); restoreTime = time;
      status('原格式不兼容，正在切换 MP3…');
      return true;
    };
    const needsGraphResume = () => Boolean(window.FieldnotesAudioGraph?.context && window.FieldnotesAudioGraph.context.state !== 'running');
    // Same-origin music tabs exchange ownership only, never song names or audio.
    const ownerKey = 'fieldnotes-music-owner-v1';
    const ownerId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    let channel = null, lastClaim = null, transportClosed = false;
    const validClaim = (value) => {
      const now = Date.now();
      return value && value.version === 1 && value.source === 'music' && typeof value.owner === 'string' && /^[\w.-]{8,100}$/.test(value.owner)
        && Number.isSafeInteger(value.clock) && value.clock >= 0 && value.clock <= now + 60000
        && Number.isSafeInteger(value.at) && value.at >= 0 && value.at <= now + 5000;
    };
    const newer = (value, previous) => !previous || value.clock > previous.clock || value.clock === previous.clock && value.owner > previous.owner;
    const readClaim = () => { try { const value = JSON.parse(localStorage.getItem(ownerKey) || 'null'); if (validClaim(value) && newer(value, lastClaim)) lastClaim = value; } catch { /* A private tab can use BroadcastChannel or local controls. */ } };
    const receiveClaim = (value) => {
      if (transportClosed || !validClaim(value) || value.owner === ownerId || !newer(value, lastClaim)) return;
      lastClaim = value;
      if (requestedPlay || pendingPlay || !audio.paused) pause('已在另一个博客页面播放。');
    };
    const onOwnerMessage = (event) => receiveClaim(event.data);
    const onOwnerStorage = (event) => {
      if (event.key !== ownerKey || typeof event.newValue !== 'string' || event.newValue.length > 1024) return;
      try { receiveClaim(JSON.parse(event.newValue)); } catch { /* Ignore malformed same-origin records. */ }
    };
    const reconcileOwnership = () => {
      if (transportClosed) return;
      try { const value = JSON.parse(localStorage.getItem(ownerKey) || 'null'); receiveClaim(value); } catch { /* BroadcastChannel remains available without storage. */ }
      if (lastClaim && lastClaim.owner !== ownerId && (requestedPlay || pendingPlay || !audio.paused)) pause('已在另一个博客页面播放。');
    };
    readClaim();
    try { if (typeof BroadcastChannel === 'function') { channel = new BroadcastChannel('fieldnotes-music-session-v1'); channel.addEventListener('message', onOwnerMessage); } } catch { channel = null; }
    window.addEventListener('storage', onOwnerStorage);
    document.addEventListener?.('visibilitychange', reconcileOwnership);
    window.addEventListener('pageshow', reconcileOwnership);
    window.addEventListener('focus', reconcileOwnership);
    const claimOwnership = () => {
      readClaim();
      const value = { version: 1, source: 'music', owner: ownerId, clock: Math.max(Date.now(), (lastClaim?.clock || 0) + 1), at: Date.now() };
      lastClaim = value;
      try { channel?.postMessage(value); } catch { /* Storage is an independent fallback. */ }
      try { localStorage.setItem(ownerKey, JSON.stringify(value)); } catch { /* Neither transport is required for this tab to play. */ }
    };
    const closeOwnership = () => { transportClosed = true; channel?.close(); window.removeEventListener?.('storage', onOwnerStorage); document.removeEventListener?.('visibilitychange', reconcileOwnership); window.removeEventListener?.('pageshow', reconcileOwnership); window.removeEventListener?.('focus', reconcileOwnership); };
    const play = async ({ routeRecovery = false, automatic = false } = {}) => {
      if (routeRecovery || automatic) { readClaim(); if (lastClaim && lastClaim.owner !== ownerId) { pause('已在另一个博客页面播放。'); return; } }
      if (!routeRecovery && !automatic) userIntent++;
      requestedPlay = true; pendingPlay = true;
      const attempt = ++epoch;
      if (!routeRecovery && !automatic) claimOwnership();
      find('play').disabled = false;
      syncControls();
      status(tracks[selected].usingFallback ? '正在载入…' : '正在载入…');
      try {
        // Reuse the optional persistent visualizer graph. A suspended output is
        // not a file-format error, so never transcode/reload the track for it.
        if (needsGraphResume()) {
          const context = window.FieldnotesAudioGraph.context;
          try {
            await context.resume();
            if (attempt !== epoch) return;
            if (context.state !== 'running') throw new Error('Audio output is not running');
          } catch {
            if (attempt !== epoch) return;
            requestedPlay = false;
            audio.pause();
            status('音乐输出暂未恢复，请再次点击播放；若仍无声，请刷新页面。');
            return;
          }
        }
        if (attempt !== epoch) return;
        await audio.play();
        if (attempt !== epoch) return;
        status(`正在播放：${tracks[selected].title}`);
      } catch (error) {
        if (attempt !== epoch) return;
        // A DOM move can pause an otherwise valid media stream. Recovery is
        // never evidence that its codec needs an MP3 reload.
        if (routeRecovery) {
          requestedPlay = false;
          audio.pause();
          status('音乐已保留，点击播放继续。');
          return;
        }
        if (error?.name !== 'NotAllowedError' && fallback()) { void play({ automatic: true }); return; }
        requestedPlay = false;
        audio.pause();
        status(error?.name === 'NotAllowedError' ? '浏览器拦截了播放，请再次点击播放按钮。' : '音频无法播放，请检查文件格式或稍后重试。');
      } finally {
        if (attempt === epoch) { pendingPlay = false; find('play').disabled = false; syncControls(); }
      }
    };
    const pause = (message = '已暂停。点击播放可继续。') => { userIntent++; requestedPlay = false; pendingPlay = false; routePlayback = null; epoch++; audio.pause(); find('play').disabled = false; status(message); syncControls(); save(); };
    const togglePlayback = () => { if (pendingPlay && requestedPlay) pause(); else if (audio.paused || audio.ended || needsGraphResume()) void play(); else pause(); };
    window.FieldnotesMusicPlayer = { root, audio, pause: () => pause(), dispose: () => { pause(); closeOwnership(); } };
    const advance = (direction, automatic = false) => {
      let next = (selected + direction + tracks.length) % tracks.length;
      if (mode === 'shuffle' && tracks.length > 1) {
        const previous = direction < 0 ? shuffleHistory.pop() : shuffleForward.pop();
        const previousIndex = previous ? tracks.findIndex((track) => track.id === previous) : -1;
        if (previousIndex >= 0 && previousIndex !== selected) {
          if (direction < 0) shuffleForward.push(tracks[selected].id);
          next = previousIndex;
        }
        else {
          shuffleBag = shuffleBag.filter((id) => id !== tracks[selected].id && tracks.some((track) => track.id === id));
          if (!shuffleBag.length) shuffleBag = tracks.filter((track) => track.id !== tracks[selected].id).map((track) => track.id);
          const slot = Math.min(shuffleBag.length - 1, Math.floor(Math.random() * shuffleBag.length));
          const id = shuffleBag.splice(slot, 1)[0];
          next = tracks.findIndex((track) => track.id === id);
        }
        if (direction > 0) { shuffleHistory.push(tracks[selected].id); if (shuffleHistory.length > 256) shuffleHistory.shift(); }
      }
      select(next, false, true); void play({ automatic });
    };
    const setMode = (value) => {
      if (!modes.includes(value)) return;
      if (value === 'one' && mode !== 'one') beforeRepeat = mode;
      mode = value; audio.loop = mode === 'one'; shuffleBag = []; shuffleHistory = []; shuffleForward = [];
      syncControls(); save();
      status({ stop: '曲终暂停。', list: '顺序循环 · 全部曲目。', one: '单曲循环已开启。', shuffle: '随机播放 · 全部曲目。' }[mode]);
    };
    // transition:persist preserves identity, not playback in engines whose DOM
    // reparenting pauses media. Remember only an already playing user session.
    document.addEventListener?.('astro:before-swap', () => {
      routePlayback = requestedPlay && !audio.paused && !audio.ended && !audio.error
        ? { epoch, src: audio.src, time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0 }
        : null;
    });
    document.addEventListener?.('astro:after-swap', () => {
      const previous = routePlayback;
      routePlayback = null;
      if (!previous || !requestedPlay || previous.epoch !== epoch || previous.src !== audio.src || audio.ended || audio.error) return;
      if (!audio.paused && !needsGraphResume()) return;
      // The same live source should retain its clock. Restore only a browser
      // reset backwards during the move, never overwrite elapsed playback.
      if (Number.isFinite(audio.currentTime) && audio.currentTime < previous.time && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.min(previous.time, audio.duration);
        syncTime();
      }
      void play({ routeRecovery: true });
    });
    const togglePanel = (open) => {
      find('panel').hidden = !open;
      find('toggle').setAttribute('aria-expanded', String(open));
      find('toggle').setAttribute('aria-label', open ? '收起月光唱片机' : '打开月光唱片机');
      if (open) find('close').focus();
    };
    if (!pageMode) {
      find('toggle').addEventListener('click', () => togglePanel(find('panel').hidden));
      find('close').addEventListener('click', () => { togglePanel(false); find('toggle').focus(); });
      root.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !find('panel').hidden) { event.preventDefault(); event.stopPropagation(); togglePanel(false); find('toggle').focus(); } });
    }
    find('play').addEventListener('click', togglePlayback);
    if(typeof navigator!=='undefined'&&navigator.mediaSession){for(const [action,handler] of Object.entries({play:()=>void play(),pause:()=>pause(),previoustrack:()=>advance(-1),nexttrack:()=>advance(1),seekto:e=>{if(Number.isFinite(e.seekTime)&&Number.isFinite(audio.duration)){userIntent++;restoreTime=0;audio.currentTime=Math.max(0,Math.min(audio.duration,e.seekTime));syncTime();save();}}})){try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}}
    find('dock-play')?.addEventListener('click', togglePlayback);
    find('dock-prev')?.addEventListener('click',()=>advance(-1));
    find('dock-next')?.addEventListener('click',()=>advance(1));
    find('dock-fold')?.addEventListener('click',()=>{const folded=root.dataset.dockFolded!=='yes';root.dataset.dockFolded=folded?'yes':'no';find('dock-fold').setAttribute('aria-expanded',String(!folded));find('dock-fold').setAttribute('aria-label',folded?'展开音乐条':'收起音乐条');});
    find('next').addEventListener('click', () => advance(1));
    find('prev').addEventListener('click', () => advance(-1));
    find('repeat').addEventListener('click', () => setMode(mode === 'one' ? beforeRepeat : 'one'));
    find('mode')?.addEventListener('change', () => setMode(find('mode').value));
    find('favorite')?.addEventListener('click', () => toggleFavorite(tracks[selected].id));
    find('dock-favorite')?.addEventListener('click', () => toggleFavorite(tracks[selected].id));
    find('library-view')?.addEventListener('change', renderList);
    find('library-sort')?.addEventListener('change', renderList);
    find('library-filter')?.addEventListener('input', renderList);
    find('locate')?.addEventListener('click', () => {
      if (find('library-filter')) find('library-filter').value = '';
      if (find('library-view')) find('library-view').value = 'all';
      renderList();
      const row = Array.from(find('list').children).find((item) => item.dataset.trackId === tracks[selected].id);
      const inRoom = root.closest?.('[data-music-location=room]') || (typeof location !== 'undefined' && /^\/music(?:\/|$)/.test(location.pathname));
      if (row?.isConnected && inRoom) { row.scrollIntoView?.({ block: 'nearest', behavior: 'auto' }); row.children[0]?.focus({ preventScroll: true }); }
    });
    find('mute').addEventListener('click', () => { audio.muted = !audio.muted; syncControls(); save(); });
    find('dock-mute')?.addEventListener('click', () => { audio.muted = !audio.muted; syncControls(); save(); });
    find('volume').addEventListener('input', () => { audio.volume = Math.max(0, Math.min(1, Number(find('volume').value) / 100)); if (audio.volume > 0) audio.muted = false; syncControls(); save(); });
    find('seek').addEventListener('input', () => { if (!Number.isFinite(audio.duration) || audio.duration <= 0) return; userIntent++; restoreTime = 0; audio.currentTime = Math.max(0, Math.min(audio.duration, Number(find('seek').value) / 1000 * audio.duration)); syncTime(); save(); });
    find('dock-seek')?.addEventListener('input', () => { if (!Number.isFinite(audio.duration) || audio.duration <= 0) return; const value = Number(find('dock-seek').value); if (!Number.isFinite(value)) return; userIntent++; restoreTime = 0; audio.currentTime = Math.max(0, Math.min(audio.duration, value / 1000 * audio.duration)); syncTime(); save(); });
    audio.addEventListener('loadedmetadata', () => { if (restoreTime && Number.isFinite(audio.duration) && audio.duration > 0) { audio.currentTime = Math.min(restoreTime, Math.max(0, audio.duration - 0.1)); restoreTime = 0; } syncTime(); });
    audio.addEventListener('durationchange', syncTime);
    audio.addEventListener('timeupdate', () => { syncTime(); const second = Math.floor(audio.currentTime); if (second !== lastSavedSecond && second % 3 === 0) { save(); lastSavedSecond = second; } });
    audio.addEventListener('play', () => { if (!requestedPlay) { audio.pause(); syncControls(); return; } syncControls(); window.dispatchEvent(new CustomEvent('fieldnotes:audio-start', { detail: { source: 'music' } })); });
    audio.addEventListener('pause', () => { syncControls(); save(); });
    audio.addEventListener('ended', () => {
      const continuePlaying = requestedPlay && audio.ended === true && !audio.error && (mode === 'list' || mode === 'shuffle');
      requestedPlay = false; routePlayback = null;
      if (continuePlaying) { advance(1, true); return; }
      syncControls(); save(); status('这一曲结束了。点击下一首，继续听。');
    });
    audio.addEventListener('error', () => { if (fallback()) { if (requestedPlay) void play({ automatic: true }); else find('play').disabled = false; return; } requestedPlay = false; pendingPlay = false; routePlayback = null; epoch++; audio.pause(); find('play').disabled = false; syncControls(); status('音频加载失败。内置曲目请检查本地服务；本地文件可重新选入。'); });
    window.addEventListener('fieldnotes:audio-start', (event) => { if (event.detail?.source && event.detail.source !== 'music' && (requestedPlay || pendingPlay || !audio.paused)) pause('已为环境音暂停乐曲，避免声音叠加。'); });
    find('files').addEventListener('change', () => {
      const files = Array.from(find('files').files || []);
      let added = 0, rejected = 0, duplicates = 0;
      for (const file of files) {
        const id = `file:${String(file.name).slice(0, 180)}:${Number(file.size) || 0}:${Number(file.lastModified) || 0}`;
        if (tracks.some((track) => track.id === id)) { duplicates++; continue; }
        if (tracks.filter((track) => track.local).length >= 12 || file.size > 30 * 1024 * 1024 || !file.size || !(file.type?.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|wav|flac|opus|webm)$/i.test(file.name))) { rejected++; continue; }
        const url = URL.createObjectURL(file); blobs.push(url);
        tracks.push({ id, title: String(file.name).slice(0, 180), artist: '你选入的本地音频 · 不上传', caption: '仅本页可用 · 点击播放', src: url, local: true });
        added++;
      }
      renderList(); find('files').value = '';
      status(added ? `已选入 ${added} 首${duplicates ? `；${duplicates} 首已在歌单` : ''}${rejected ? `；跳过 ${rejected} 个无效或超限文件` : ''}。` : duplicates ? `${duplicates} 首已在歌单，无需重复选入。` : '未选入音频。支持常用音频格式，每首不超过 30 MB，最多 12 首本地曲目。');
    });
    window.addEventListener('pagehide', (event) => { save(); if (!event.persisted) { pause(); closeOwnership(); disposeMetadata(); blobs.forEach((url) => URL.revokeObjectURL(url)); } });
    select(selected, true);
    if (find('query')) void (async () => {
      try {
        const utils = await import('/music-metadata-utils.mjs');
        const key = 'fieldnotes-music-metadata-v1';
        let metadata = {}, generation = 0, request = null, lines = [], fileOffset = 0, active = -2, sessionToken = '';
        try { metadata = utils.cleanMetadata(JSON.parse(localStorage.getItem(key) || '{}')); } catch { /* Optional local storage. */ }
        const lookup = () => ({ ...(tracks[selected].library ? { cover: tracks[selected].cover } : {}), ...(metadata[tracks[selected].id] || {}) });
        const resultStatus = (message) => { find('search-status').textContent = message; };
        const busy = (value) => { ['search-cover', 'search-lyrics'].forEach((name) => { find(name).disabled = value; }); find('candidates').setAttribute('aria-busy', String(value)); };
        const cancel = () => { generation++; request?.abort(); request = null; busy(false); };
        const persist = (patch) => {
          const id = tracks[selected].id;
          metadata[id] = { ...lookup(), ...patch };
          // Keep a bounded, insertion-ordered collection. Audio and Blob URLs are never stored.
          const entries = Object.entries(metadata); metadata = Object.fromEntries(entries.slice(-64));
          while (JSON.stringify(metadata).length > 2800000 && Object.keys(metadata).length > 1) delete metadata[Object.keys(metadata).find((entry) => entry !== id)];
          try { localStorage.setItem(key, JSON.stringify(metadata)); return true; } catch { resultStatus('当前修改已应用，但浏览器存储不可用；只在本页保留。'); return false; }
        };
        const renderLyrics = () => {
          const value = lookup(), container = find('lyrics');
          container.replaceChildren(); lines = []; fileOffset = 0; active = -2;
          if (value.instrumental) container.textContent = '这首歌是纯音乐，让旋律自己说话。';
          else if (value.lyrics) {
            const parsed = utils.parseLyrics(value.lyrics); lines = parsed.lines; fileOffset = parsed.fileOffset;
            if (lines.length) lines.forEach((line) => {
              const button = document.createElement('button'); button.type = 'button'; button.textContent = line.text || '♪'; button.setAttribute('aria-current', 'false');
              button.addEventListener('click', () => { if (Number.isFinite(audio.duration) && audio.duration > 0) { audio.currentTime = Math.max(0, Math.min(audio.duration, line.time + ((lookup().delay || 0) + fileOffset) / 1000)); syncTime(); save(); } });
              container.append(button);
            });
            else { const text = document.createElement('p'); text.textContent = value.lyrics; container.append(text); }
          } else container.textContent = (tracks[selected].local || tracks[selected].library) ? '还没有歌词。搜索一个版本，或者导入 .lrc。' : '这是一首原创纯音乐，没有歌词。';
          find('lyrics-credit').textContent = value.lyricsCredit || (lines.length ? '已同步歌词 · 点击歌词可跳转' : '可搜索歌词，也可以导入你自己的 .lrc');
          updateLyrics();
        };
        updateLyrics = () => {
          if (!lines.length) return;
          const index = utils.activeLyric(lines, audio.currentTime, lookup().delay || 0, fileOffset);
          if (index === active) return; active = index;
          const buttons = Array.from(find('lyrics').children);
          buttons.forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
          const current = buttons[index];
          if (current && find('follow').checked && !find('panel').hidden) find('lyrics').scrollTop = Math.max(0, current.offsetTop - find('lyrics').offsetTop - find('lyrics').clientHeight / 2 + current.clientHeight / 2);
        };
        const renderCover = () => {
          const value = lookup(), image = find('cover'), source = find('cover-source'), safe = utils.validCover(value.cover) || (tracks[selected].library && value.cover === `/__local/api/music/library/cover/${tracks[selected].id}` ? value.cover : '');
          image.hidden = !safe; find('cover-empty').hidden = Boolean(safe);
          if (safe) { if (image.getAttribute('src') !== safe) image.src = safe; image.alt = `歌曲封面：${tracks[selected].title}`; } else image.removeAttribute('src');
          const dock = find('dock-cover'), empty = find('dock-cover-empty');
          if (dock) { dock.hidden = !safe; if (safe) { if (dock.getAttribute('src') !== safe) dock.src = safe; dock.alt = `歌曲封面：${tracks[selected].title}`; } else dock.removeAttribute('src'); }
          if (empty) empty.hidden = Boolean(safe);
          source.hidden = !(safe && value.coverSourceUrl);
          if (!source.hidden) { source.href = value.coverSourceUrl; source.textContent = `在 Apple Music 查看：${value.coverCredit || tracks[selected].title} ↗`; } else source.removeAttribute('href');
        };
        find('cover').addEventListener('error', () => { find('cover').hidden = true; find('cover-empty').hidden = false; if (find('dock-cover')) find('dock-cover').hidden = true; if (find('dock-cover-empty')) find('dock-cover-empty').hidden = false; resultStatus('封面加载失败，音频不受影响。可重新搜索或导入本地图片。'); });
        find('dock-cover')?.addEventListener('error', () => { find('dock-cover').hidden = true; if (find('dock-cover-empty')) find('dock-cover-empty').hidden = false; });
        refreshMetadata = () => {
          cancel(); find('candidates').replaceChildren(); resultStatus('先选封面或歌词来源，结果只会在你点击应用后保存。');
          find('query').value = tracks[selected].library ? `${tracks[selected].title} ${tracks[selected].artist}` : tracks[selected].local ? tracks[selected].title.replace(/\.[a-z0-9]{2,6}$/i, '') : tracks[selected].title;
          find('offset').value = String(lookup().delay || 0); renderCover(); renderLyrics();
        };
        disposeMetadata = cancel;
        const api = async () => { throw new Error('公开版请从设备选择封面和 LRC，不连接本机搜索服务。'); };
        const task = async (message, work) => {
          cancel(); const currentGeneration = generation, id = tracks[selected].id;
          const controller = new AbortController(); request = controller; busy(true); resultStatus(message);
          const timer = setTimeout(() => controller.abort(), 16000);
          try { const result = await work(controller); if (generation === currentGeneration && id === tracks[selected].id) return result; }
          catch (error) { if (generation === currentGeneration) resultStatus(controller.signal.aborted ? '请求超时或已取消，音频和已选资料没有改动。' : error.message); }
          finally { clearTimeout(timer); if (generation === currentGeneration) { request = null; busy(false); } }
          return null;
        };
        const button = (label, onClick) => { const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.addEventListener('click', onClick); return node; };
        const search = async (kind) => {
          const query = find('query').value.trim();
          if (query.length < 2 || query.length > 180) { resultStatus('请输入 2–180 字符的歌名 / 歌手，不要输入私人信息。'); return; }
          find('candidates').replaceChildren();
          const value = await task(`正在搜索${kind === 'covers' ? '封面 · iTunes' : '歌词 · LRCLIB'}…`, (controller) => api('/music/search', { query, kind }, controller));
          if (!value) return;
          const id = tracks[selected].id;
          for (const candidate of value.candidates || []) {
            const card = document.createElement('article'), copy = document.createElement('div'), title = document.createElement('strong'), info = document.createElement('small'), link = document.createElement('a');
            title.textContent = candidate.title; info.textContent = `${candidate.artist} · ${candidate.album || '未标注专辑'}${kind === 'lyrics' ? ` · ${candidate.instrumental ? '纯音乐' : candidate.synced ? '同步 LRC' : '纯文本'} · ${timeLabel(candidate.duration)}` : ''}`;
            link.textContent = `来源：${candidate.source} ↗`; link.href = candidate.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
            copy.append(title, info, link);
            if (kind === 'covers') {
              const image = document.createElement('img'); image.alt = `${candidate.title} 候选封面`; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.src = utils.validCover(candidate.cover); card.append(image);
              card.append(copy, button('用这张', () => {
                if (tracks[selected].id !== id) return;
                const stored = persist({ cover: candidate.cover, coverSourceUrl: candidate.sourceUrl, coverCredit: `${candidate.title} · ${candidate.artist}` }); renderCover(); if (stored) resultStatus('这张封面已应用到当前曲目，来源链接已保留；音频未改动。');
              }));
            } else card.append(copy, button('用这版', async () => {
              if (tracks[selected].id !== id) return;
              const lyrics = await task('正在读取所选歌词版本…', (controller) => api('/music/lyrics', { id: candidate.id }, controller));
              if (!lyrics) return;
              const content = lyrics.syncedLyrics || lyrics.plainLyrics || '';
              if (!lyrics.instrumental && !content) { resultStatus('该版本没有可用歌词，原歌词未改动。'); return; }
              const stored = persist({ lyrics: content, instrumental: lyrics.instrumental, lyricsCredit: `LRCLIB #${lyrics.id} · ${lyrics.title} / ${lyrics.artist}` }); renderLyrics();
              if (stored) resultStatus(lyrics.instrumental ? '已标记这首是纯音乐。' : lyrics.syncedLyrics ? '同步歌词已应用。时间不准时可调整延后毫秒数。' : '已应用纯文本歌词；此版本没有时间轴。');
            }));
            find('candidates').append(card);
          }
          resultStatus(value.candidates?.length ? `找到 ${value.candidates.length} 个候选，请手选。${value.notice || ''}` : '没有找到匹配结果。试试日文原名 / 歌手，或导入本地封面和 LRC。');
        };
        find('search-cover').addEventListener('click', () => void search('covers'));
        find('search-lyrics').addEventListener('click', () => void search('lyrics'));
        find('query').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); void search('lyrics'); } });
        find('cover-file').addEventListener('change', async () => {
          const file = find('cover-file').files?.[0]; find('cover-file').value = '';
          if (!file) return;
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 550 * 1024 || !file.size) { resultStatus('封面仅接受 PNG / JPEG / WebP，且不超过 550 KB。不执行 SVG。'); return; }
          cancel(); const id = tracks[selected].id, at = generation;
          try {
            const reader = new FileReader(); const dataUrl = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
            if (id !== tracks[selected].id || at !== generation) return;
            if (!utils.validCover(dataUrl)) throw new Error('无效图片。');
            const stored = persist({ cover: dataUrl, coverSourceUrl: '', coverCredit: '你导入的本地图片' }); renderCover(); if (stored) resultStatus('本地封面已保存到浏览器，不上传服务器。');
          } catch { resultStatus('无法读取封面，请换一张 PNG / JPEG / WebP。'); }
        });
        find('lrc-file').addEventListener('change', async () => {
          const file = find('lrc-file').files?.[0]; find('lrc-file').value = '';
          if (!file) return;
          if (!/\.lrc$/i.test(file.name) || !file.size || file.size > 100000) { resultStatus('请选择不超过 100 KB 的 UTF-8 .lrc 文件。'); return; }
          cancel(); const id = tracks[selected].id, at = generation;
          try {
            const content = await file.text(); utils.parseLyrics(content);
            if (id !== tracks[selected].id || at !== generation) return;
            const stored = persist({ lyrics: content, instrumental: false, lyricsCredit: '你导入的本地 LRC · 未上传' }); renderLyrics();
            if (stored) resultStatus(lines.length ? '本地 LRC 已保存并同步。可用毫秒偏移微调。' : '已保存，但该文件没有有效时间轴，仅显示文本。');
          } catch { resultStatus('LRC 无法解析或过大，请检查 UTF-8 文件。'); }
        });
        find('offset').addEventListener('change', () => { const delay = Math.max(-10000, Math.min(10000, Number(find('offset').value) || 0)); find('offset').value = String(delay); persist({ delay }); active = -2; updateLyrics(); });
        find('follow').addEventListener('change', () => { active = -2; updateLyrics(); });
        find('clear-metadata').addEventListener('click', () => { cancel(); delete metadata[tracks[selected].id]; let stored = true; try { localStorage.setItem(key, JSON.stringify(metadata)); } catch { stored = false; } refreshMetadata(); resultStatus(stored ? '已重置当前曲目的封面、歌词和偏移，音频没有改动。' : '本页已重置，但浏览器阻止了持久化；下次打开可能恢复旧设置。'); });
        refreshMetadata();
      } catch { find('search-status').textContent = '歌词工具未能载入，基础播放仍可用。请刷新本地页面重试。'; }
    })();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
