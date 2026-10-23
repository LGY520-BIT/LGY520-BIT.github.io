/* Original fan dialogue. Local clock + this player's actual playback only.
   No AI, network, browsing history, input capture, audio inspection or polling. */
(() => {
  'use strict';
  const lines = Object.freeze({
    morning: ['早安。管理员也要慢慢开机……先送你一份好心情。', '早上好。今天的频道，留一点位置给新的灵感吧。'],
    day: ['欢迎回来。忙碌间隙，也可以偷偷休息一小会儿。', '今天的月见频道已就位。想聊点什么？'],
    evening: ['今天辛苦了。晚风和月色，都给你留着呢。', '傍晚好。把没做完的事放轻一点，慢慢来就好。'],
    night: ['还没睡呀。管理员陪你收个尾，也记得给自己留足休息。', '夜深了。今天的频道先调暗一点，明天再继续吧。'],
    touch: ['嗯？管理员正在偷一点懒，被你发现了。', '收到。特别回应一次——今天也要照顾好自己。', '在这里哦。有什么有趣的事，分一点给我吧。', '不许催开播……好吧，给你一个小小的笑容。'],
    music: ['音乐开始了。让这段旋律，替今天留一盏灯吧。', '这会儿适合把脚步放慢一点，听一首歌。', '把这段播放中的旋律，夹进今天的回忆里吧。']
  });
  const period = hour => hour >= 6 && hour < 10 ? 'morning' : hour >= 10 && hour < 18 ? 'day' : hour >= 18 && hour < 23 ? 'evening' : 'night';
  function create({ pet, bubble, text, close, toggle, status, panel, storage, isBusy = () => false, isDragging = () => false, setState = () => {} }) {
    if (!pet || !bubble || !text) return null;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const privatePage = /^\/(?:studio|atelier)(?:\/|$)/.test(location.pathname);
    const disposers = [], previous = {};
    let enabled = storage.get('moon-companion-dialogue', true) !== 'off';
    let disposed = false, timer = 0, greetingTimer = 0, lastTouch = -Infinity, lastMusic = -Infinity, greetedStamp = null;
    const listen = (target, name, fn) => {
      if (!target) return;
      target.addEventListener(name, fn);
      disposers.push(() => target.removeEventListener(name, fn));
    };
    const quiet = () => reduced.matches || document.documentElement.dataset.motion === 'quiet';
    const unavailable = () => disposed || !enabled || pet.hidden || document.documentElement.dataset.companionVisibility === 'hidden' || document.visibilityState === 'hidden' || isBusy() || isDragging();
    const pick = name => {
      const pool = lines[name];
      let index = Math.floor(Math.random() * pool.length);
      if (index === previous[name]) index = (index + 1) % pool.length;
      previous[name] = index;
      return pool[index];
    };
    function dismiss() {
      clearTimeout(timer); clearTimeout(greetingTimer);
      timer = greetingTimer = 0;
      bubble.hidden = true;
      pet.classList.remove('is-reacting');
      delete pet.dataset.dialogueSource;
      if (!isBusy() && !isDragging()) setState('idle');
    }
    function place() {
      if (bubble.hidden || disposed) return;
      // The pet is scaled around its top-left. Convert viewport corrections to
      // local CSS pixels rather than changing the saved avatar coordinates.
      const rect = pet.getBoundingClientRect();
      const scale = rect.width / pet.offsetWidth || 1;
      const header = document.querySelector('.cosmic-header');
      const headerHeight = header?.getBoundingClientRect?.().bottom || header?.offsetHeight || 0;
      const safeTop = Math.max(8, Math.min(innerHeight - 8, headerHeight + 8));
      bubble.style.setProperty('--dialogue-max-width', `${Math.max(1, (innerWidth - 16) / scale)}px`);
      bubble.style.setProperty('--dialogue-max-height', `${Math.max(1, (innerHeight - safeTop - 8) / scale)}px`);
      bubble.style.left = '0px';
      bubble.style.top = `${-bubble.offsetHeight - 14}px`;
      bubble.dataset.side = 'above';
      let bounds = bubble.getBoundingClientRect();
      if (bounds.top < safeTop) {
        bubble.style.top = '12px';
        bubble.dataset.side = 'inside';
        bounds = bubble.getBoundingClientRect();
      }
      const dx = bounds.left < 8 ? 8 - bounds.left : bounds.right > innerWidth - 8 ? innerWidth - 8 - bounds.right : 0;
      const dy = bounds.top < safeTop ? safeTop - bounds.top : bounds.bottom > innerHeight - 8 ? innerHeight - 8 - bounds.bottom : 0;
      bubble.style.left = `${dx / scale}px`;
      bubble.style.top = `${parseFloat(bubble.style.top) + dy / scale}px`;
    }
    function say(message, source = 'manual', automatic = false) {
      if (unavailable() || (automatic && (privatePage || quiet() || !panel.hidden))) return false;
      const value = String(message).trim().slice(0, 140);
      if (!value) return false;
      clearTimeout(timer);
      text.textContent = value;
      bubble.hidden = false;
      pet.dataset.dialogueSource = source;
      pet.classList.add('is-reacting');
      if (!quiet()) setState('wave');
      place();
      timer = setTimeout(dismiss, 5600);
      return true;
    }
    function greet() {
      if (unavailable() || privatePage || quiet() || !panel.hidden) return false;
      const now = new Date(), slot = period(now.getHours());
      const stamp = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}:${slot}`;
      if (greetedStamp === stamp || storage.get('moon-dialogue-greeting') === stamp) return false;
      if (!say(pick(slot), 'greeting', true)) return false;
      greetedStamp = stamp;
      storage.put('moon-dialogue-greeting', stamp);
      return true;
    }
    function touch() {
      const now = Date.now();
      if (now - lastTouch < 900 || unavailable()) return false;
      const shown = say(pick('touch'), 'touch');
      if (shown) { lastTouch = now; clearTimeout(greetingTimer); greetingTimer = 0; }
      return shown;
    }
    const audio = document.querySelector('[data-music-audio]');
    function music() {
      const now = Date.now();
      // 'playing' means media really advanced beyond play() intent/buffering.
      if (!audio || audio.paused || audio.ended || now - lastMusic < 45000) return false;
      const shown = say(pick('music'), 'music', true);
      if (shown) { lastMusic = now; clearTimeout(greetingTimer); greetingTimer = 0; }
      return shown;
    }
    const stopMusic = () => { if (pet.dataset.dialogueSource === 'music') dismiss(); };
    const sync = () => {
      if (toggle) toggle.checked = enabled;
      if (status) status.textContent = enabled ? '本地原创台词已开启；静默／后台／工坊不主动问候，不调用 AI。' : '台词气泡已关闭；聊天、拖动和音乐不受影响。';
    };
    const change = () => {
      enabled = Boolean(toggle.checked);
      storage.put('moon-companion-dialogue', enabled ? 'on' : 'off', true);
      dismiss(); sync();
      // No queued greeting on re-enable; the next explicit touch works at once.
      if (enabled) lastTouch = -Infinity;
    };
    listen(close, 'click', dismiss);
    listen(toggle, 'change', change);
    listen(audio, 'playing', music);
    for (const event of ['pause', 'ended', 'error', 'emptied', 'waiting']) listen(audio, event, stopMusic);
    listen(window, 'resize', place);
    listen(window, 'storage', event => {
      if (event.key !== 'moon-companion-dialogue') return;
      storage.remove?.('moon-companion-dialogue');
      enabled = event.newValue !== 'off'; dismiss(); sync();
    });
    listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') dismiss();
      else greet();
    });
    const motionChange = () => { if (quiet()) dismiss(); };
    reduced.addEventListener('change', motionChange);
    disposers.push(() => reduced.removeEventListener('change', motionChange));
    const observer = new MutationObserver(() => { if (quiet() || pet.hidden || document.documentElement.dataset.companionVisibility === 'hidden') dismiss(); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion', 'data-companion-visibility'] });
    disposers.push(() => observer.disconnect());
    // BFCache does not reinstall hooks or replay a cancelled greeting.
    listen(window, 'pagehide', dismiss);
    sync(); bubble.hidden = true;
    greetingTimer = setTimeout(greet, 1200);
    return Object.freeze({ say, touch, greet, music, dismiss, place, dispose() { dismiss(); disposed = true; for (const stop of disposers) stop(); } });
  }
  window.FieldnotesDialogue = Object.freeze({ create, period });
})();
