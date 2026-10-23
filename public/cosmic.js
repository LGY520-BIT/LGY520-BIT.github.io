/* 未完 · 月夜主题交互。寄语与环境音均为本小站原创，不使用作品台词或远程音乐。 */
(() => {
  'use strict';

  const initialize = (scope) => {
    const on = (target, ...args) => scope ? scope.listen(target, ...args) : target?.addEventListener(...args);
    const delay = (...args) => scope ? scope.timeout(...args) : setTimeout(...args);
    const every = (...args) => scope ? scope.interval(...args) : setInterval(...args);
    const raf = (...args) => scope ? scope.frame(...args) : requestAnimationFrame(...args);

    const root = document.documentElement;
    const all = (selector) => [...document.querySelectorAll(selector)];
    const readPreference = (key) => {
      try { return localStorage.getItem(key); } catch { return null; }
    };
    const savePreference = (key, value) => {
      try { localStorage.setItem(key, value); } catch { /* 隐私模式下仍可使用本页控制。 */ }
    };
    const listenToMedia = (media, callback) => {
      if (typeof media.addEventListener === 'function') on(media, 'change', callback);
      else if (typeof media.addListener === 'function') {
        media.addListener(callback);
        scope?.cleanup(() => media.removeListener?.(callback));
      }
    };

    // 人物只由受控的三个值选择；立绘的显示与过渡交给 CSS。
    const characters = ['kaguya', 'iroha', 'yachiyo'];
    const characterButtons = all('button[data-character-switch]');
    const validCharacter = (value) => characters.includes(value);
    const rememberedCharacter = readPreference('cosmic-character');
    let character = validCharacter(rememberedCharacter)
      ? rememberedCharacter
      : validCharacter(root.dataset.character) ? root.dataset.character : 'kaguya';

    const selectCharacter = (next, remember = true) => {
      if (!validCharacter(next)) return;
      character = next;
      root.dataset.character = next;
      const number = String(characters.indexOf(next) + 1).padStart(2, '0');
      all('[data-character-number]').forEach((element) => { element.textContent = number; });
      all('[data-character-name]').forEach((element) => { element.textContent = next.toUpperCase(); });
      characterButtons.forEach((button) => {
        const target = button.dataset.characterSwitch;
        button.setAttribute('aria-pressed', String(validCharacter(target) ? target === next : true));
      });
      if (remember) savePreference('cosmic-character', next);
    };
    characterButtons.forEach((button) => on(button, 'click', () => {
      const target = button.dataset.characterSwitch;
      selectCharacter(validCharacter(target) ? target : characters[(characters.indexOf(character) + 1) % characters.length]);
    }));
    selectCharacter(character, false);

    const messages = [
      '把今天的一点灵感，留给明天的自己。',
      '月光只是背景，认真生活的你才是主角。',
      '让好奇心在线，让故事慢慢发生。',
      '不急着抵达，新的章节正在路上。',
      '欢迎接入未完，愿你带走一小束光。'
    ];
    let messageIndex = -1;
    all('button[data-cosmic-message]').forEach((button) => on(button, 'click', () => {
      messageIndex = (messageIndex + 1) % messages.length;
      all('[data-message-text]').forEach((element) => {
        if (!element.hasAttribute('aria-live')) element.setAttribute('aria-live', 'polite');
        element.textContent = messages[messageIndex];
      });
    }));

    const clock = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const clockElements = all('[data-local-clock]');
    const updateClock = () => {
      const now = new Date();
      clockElements.forEach((element) => {
        element.textContent = clock.format(now);
        element.setAttribute('title', '上海时间 · Asia/Shanghai');
        if (element.tagName === 'TIME') element.setAttribute('datetime', now.toISOString());
      });
    };
    updateClock();
    if (clockElements.length) every(updateClock, 30_000);

    // 用户偏好与系统偏好分开保存：系统减少动态效果始终具有优先级。
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');
    const motionButtons = all('button.motion-toggle');
    const rememberedMotion = readPreference('cosmic-motion');
    let motionPreference = ['quiet', 'normal'].includes(rememberedMotion) ? rememberedMotion : 'normal';
    let quiet = reducedMotion.matches || motionPreference === 'quiet';

    const stageStates = all('div[data-cosmic-stage]').map((element) => ({
      element, frame: 0, x: 0, y: 0
    }));
    const resetStage = (stage) => {
      if (stage.frame) window.cancelAnimationFrame(stage.frame);
      stage.frame = 0;
      stage.x = 0;
      stage.y = 0;
      stage.element.style.setProperty('--pointer-x', '0px');
      stage.element.style.setProperty('--pointer-y', '0px');
    };
    const canAnimate = () => !quiet && document.visibilityState !== 'hidden';
    const clamp = (value) => Math.max(-8, Math.min(8, value));
    stageStates.forEach((stage) => {
      resetStage(stage);
      on(stage.element, 'pointermove', (event) => {
        if (!canAnimate() || !finePointer.matches || event.pointerType === 'touch') return;
        const bounds = stage.element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        stage.x = clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 16);
        stage.y = clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 16);
        if (stage.frame) return;
        stage.frame = raf(() => {
          stage.frame = 0;
          if (!canAnimate() || !finePointer.matches) { resetStage(stage); return; }
          stage.element.style.setProperty('--pointer-x', `${stage.x.toFixed(2)}px`);
          stage.element.style.setProperty('--pointer-y', `${stage.y.toFixed(2)}px`);
        });
      });
      on(stage.element, 'pointerleave', () => resetStage(stage));
      on(stage.element, 'pointercancel', () => resetStage(stage));
    });

    const typewriterElements = all('[data-typewriter]');
    const phrases = ['收集月光，也收集日常。', '让想象上线，让文字落地。', '故事仍未完，新的章节等你。'];
    let typewriterTimer = 0;
    let phraseIndex = 0;
    const showPhrase = (text) => typewriterElements.forEach((element) => { element.textContent = text; });
    const stopTypewriter = () => {
      window.clearTimeout(typewriterTimer);
      typewriterTimer = 0;
      showPhrase(phrases[phraseIndex]);
    };
    const startTypewriter = () => {
      stopTypewriter();
      if (!typewriterElements.length || !canAnimate()) return;
      let position = Array.from(phrases[phraseIndex]).length;
      let deleting = true;
      const step = () => {
        if (!canAnimate()) { stopTypewriter(); return; }
        const letters = Array.from(phrases[phraseIndex]);
        position += deleting ? -1 : 1;
        showPhrase(letters.slice(0, position).join(''));
        if (!deleting && position === letters.length) {
          deleting = true;
          typewriterTimer = delay(step, 3_500);
        } else if (deleting && position === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          typewriterTimer = delay(step, 300);
        } else typewriterTimer = delay(step, deleting ? 45 : 100);
      };
      typewriterTimer = delay(step, 3_500);
    };
    const applyMotion = () => {
      quiet = reducedMotion.matches || motionPreference === 'quiet';
      root.dataset.motion = quiet ? 'quiet' : 'normal';
      motionButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(quiet));
        button.setAttribute('aria-label', reducedMotion.matches ? '系统已减少动态效果' : quiet ? '启用轻量动态效果' : '减少背景动效');
        button.setAttribute('title', reducedMotion.matches
          ? '系统已启用减少动态效果，动画保持关闭'
          : quiet ? '启用轻量动态效果' : '减少动态效果');
      });
      all('[data-motion-status]').forEach((element) => { element.textContent = quiet ? '静止模式' : '动态模式'; });
      if (quiet) stageStates.forEach(resetStage);
      startTypewriter();
    };
    motionButtons.forEach((button) => on(button, 'click', () => {
      motionPreference = motionPreference === 'quiet' ? 'normal' : 'quiet';
      savePreference('cosmic-motion', motionPreference);
      applyMotion();
    }));
    listenToMedia(reducedMotion, applyMotion);
    listenToMedia(finePointer, () => { if (!finePointer.matches) stageStates.forEach(resetStage); });
    applyMotion();

    // 仅在用户明确点击后创建 AudioContext；音频完全由本页合成，无外部请求。
    const soundButtons = all('button[data-sound-toggle]');
    let soundSession = null;
    let soundStarting = false;
    let soundEpoch = 0;
    const updateSound = (playing, status) => {
      root.dataset.sound = playing ? 'playing' : 'off';
      soundButtons.forEach((button) => {
        const label = playing ? '关闭原创环境音' : '开启原创环境音（仅在点击后播放）';
        button.setAttribute('aria-pressed', String(playing));
        button.setAttribute('title', label);
        button.setAttribute('aria-label', label);
        button.textContent = playing ? '■' : '▶';
      });
      all('[data-sound-status]').forEach((element) => { element.textContent = status; });
    };
    const disposeSound = (session) => {
      if (!session) return;
      try { session.gain?.gain.setValueAtTime(0, session.context.currentTime); } catch { /* 已关闭。 */ }
      try { session.source?.stop(); } catch { /* 尚未开始，或已经停止。 */ }
      try { session.source?.disconnect(); session.filter?.disconnect(); session.gain?.disconnect(); } catch { /* 已断开。 */ }
      if (session.context.state !== 'closed') {
        try { void session.context.close().catch(() => {}); } catch { /* 浏览器已释放上下文。 */ }
      }
    };
    const stopSound = (status = '环境音 · 关闭') => {
      soundEpoch++;
      soundStarting = false;
      const previous = soundSession;
      soundSession = null;
      disposeSound(previous);
      updateSound(false, status);
    };
    const startSound = async () => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) { updateSound(false, '环境音 · 当前浏览器不支持'); return; }
      if (document.visibilityState === 'hidden') { updateSound(false, '环境音 · 页面不可见时不播放'); return; }
      const epoch = ++soundEpoch;
      soundStarting = true;
      updateSound(false, '环境音 · 正在开启');
      let session;
      try {
        // 此函数只从 click 处理器调用，保留浏览器的用户激活上下文。
        const context = new AudioContextClass();
        session = { context, source: null, filter: null, gain: null };
        soundSession = session;
        if (context.state !== 'running') await context.resume();
        if (epoch !== soundEpoch || document.visibilityState === 'hidden') { disposeSound(session); return; }
        if (context.state !== 'running') throw new Error('AudioContext 未进入 running 状态');

        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 4), context.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        session.source = source;
        session.filter = filter;
        session.gain = gain;
        source.buffer = buffer;
        source.loop = true;
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.5;
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.035, context.currentTime + 0.7);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);
        source.start();
        soundStarting = false;
        window.dispatchEvent(new CustomEvent('fieldnotes:audio-start', { detail: { source: 'ambient' } }));
        updateSound(true, '原创环境音 · 已开启');
        on(context, 'statechange', () => {
          if (soundSession === session && context.state !== 'running') stopSound('环境音 · 已暂停，点击重新开启');
        });
      } catch (error) {
        disposeSound(session);
        if (epoch !== soundEpoch) return;
        soundSession = null;
        soundStarting = false;
        updateSound(false, '环境音 · 暂不可用');
        console.warn('[未完] 无法开启本地合成环境音：', error);
      }
    };
    updateSound(false, '环境音 · 关闭');
    on(window, 'fieldnotes:audio-start', (event) => {
      if (event.detail?.source !== 'ambient') stopSound('环境音 · 已让位给乐曲播放');
    });
    soundButtons.forEach((button) => on(button, 'click', () => {
      if (soundSession || soundStarting) stopSound();
      else void startSound();
    }));

    on(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        stopTypewriter();
        stageStates.forEach(resetStage);
        stopSound('环境音 · 关闭');
      } else {
        updateClock();
        startTypewriter();
      }
    });
    on(window, 'pagehide', () => {
      stopTypewriter();
      stageStates.forEach(resetStage);
      stopSound();
    });
    scope?.cleanup(() => {
      stopTypewriter();
      stageStates.forEach(resetStage);
      stopSound();
    });
  };

  if (globalThis.FieldnotesRoute) globalThis.FieldnotesRoute.run('cosmic', initialize);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initialize(), { once: true });
  else initialize();
})();
