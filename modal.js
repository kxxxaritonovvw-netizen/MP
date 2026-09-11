(() => {
  'use strict';
  const modal = document.createElement('dialog');
  modal.className = 'card-modal';
  modal.setAttribute('aria-label', 'Карточка');
  modal.innerHTML = '<button class="card-modal-close" aria-label="Закрыть карточку" autofocus><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>';
  document.body.append(modal);
  const grabber = document.createElement('div');
  grabber.className = 'modal-grabber';
  grabber.setAttribute('aria-hidden', 'true');
  modal.append(grabber);
  const discTray = document.createElement('div');
  discTray.className = 'modal-disc-tray';
  discTray.setAttribute('aria-hidden', 'true');
  const disc = document.createElement('button');
  disc.type = 'button';
  disc.disabled = true;
  disc.setAttribute('aria-label', 'Нажать на серый диск');
  disc.className = 'modal-disc';
  discTray.append(disc);
  modal.prepend(discTray);
  let discPress, clickAudio;
  disc.addEventListener('click', () => {
    if (disc.disabled || closing || !modal.classList.contains('disc-visible')) return;
    discPress?.cancel();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      discPress = disc.animate([{ scale: '1' }, { scale: '1.05', offset: .4 }, { scale: '1' }], {
        duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)'
      });
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      clickAudio ||= new AudioContext();
      const sound = () => {
        if (!modal.open || closing || disc.disabled) return;
        const now = clickAudio.currentTime;
        const oscillator = clickAudio.createOscillator();
        const gain = clickAudio.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(1000, now);
        oscillator.frequency.exponentialRampToValueAtTime(350, now + .025);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(.035, now + .002);
        gain.gain.exponentialRampToValueAtTime(.0001, now + .03);
        oscillator.connect(gain).connect(clickAudio.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(now);
        oscillator.stop(now + .035);
      };
      if (clickAudio.state === 'running') sound();
      else clickAudio.resume().then(sound).catch(() => {});
    } catch { /* Audio availability must not block the visual response. */ }
  });
  const button = modal.querySelector('.card-modal-close');
  const playButton = document.createElement('button');
  playButton.className = 'card-modal-play';
  playButton.type = 'button';
  playButton.setAttribute('aria-keyshortcuts', 'Space');
  const playHint = document.createElement('span');
  playHint.className = 'modal-escape-hint';
  playHint.textContent = 'space';
  playHint.setAttribute('aria-hidden', 'true');
  const playIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5.5 19 12 9 18.5Z" fill="currentColor"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 6v12M16 6v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  function syncPlayButton() {
    const audio = playerArea.querySelector('audio');
    const playing = audio && !audio.paused && !audio.ended;
    playButton.innerHTML = playing ? pauseIcon : playIcon;
    playButton.append(playHint);
    playButton.setAttribute('aria-label', playing ? 'Приостановить воспроизведение' : 'Воспроизвести трек');
  }
  playButton.innerHTML = playIcon;
  playButton.append(playHint);
  playButton.setAttribute('aria-label', 'Воспроизвести трек');
  modal.append(playButton);
  button.setAttribute('aria-keyshortcuts', 'Escape');
  const escapeHint = document.createElement('span');
  escapeHint.className = 'modal-escape-hint';
  escapeHint.textContent = 'esc';
  escapeHint.setAttribute('aria-hidden', 'true');
  button.append(escapeHint);
  const tracks = {
    'Пошлая Молли — Клеопатри': 'audio/kleopatri.mp3',
    'Lil Wayne, Drake — Right Above It': 'audio/right-above-it.mp3'
  };
  const playerArea = document.createElement('div');
  playerArea.className = 'modal-player';
  modal.append(playerArea);
  const emptyTrack = document.createElement('div');
  emptyTrack.className = 'modal-empty-track';
  emptyTrack.innerHTML = '<p class="modal-empty-title">Трек пока не добавлен</p><p class="modal-empty-description">Трек будет скоро загружен, пока ожидай</p>';
  emptyTrack.hidden = true;
  modal.append(emptyTrack);
  let fadeFrame, fadeTimer;
  function stopTrack() {
    cancelAnimationFrame(fadeFrame);
    clearTimeout(fadeTimer);
    const audio = playerArea.querySelector('audio');
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    playerArea.replaceChildren();
    syncPlayButton();
  }
  function fadeOutTrack() {
    const audio = playerArea.querySelector('audio');
    if (!audio || audio.paused) { stopTrack(); return; }
    const duration = 800;
    const started = performance.now();
    const volume = audio.volume;
    function step(now) {
      const progress = Math.min(1, Math.max(0, (now - started) / duration));
      // Smooth endpoints avoid an abrupt change in loudness.
      audio.volume = volume * (1 - progress * progress * (3 - 2 * progress));
      if (progress < 1) fadeFrame = requestAnimationFrame(step);
      else stopTrack();
    }
    fadeFrame = requestAnimationFrame(step);
    // Also release the track when animation frames are suspended in a hidden tab.
    fadeTimer = setTimeout(stopTrack, duration + 50);
  }
  function startTrack(title) {
    stopTrack();
    const source = tracks[title];
    playerArea.hidden = !source;
    if (!source) return;
    const audio = document.createElement('audio');
    audio.controls = false;
    audio.preload = 'metadata';
    audio.setAttribute('aria-label', title);
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    audio.addEventListener('error', () => {
      status.textContent = 'Трек недоступен. Добавьте аудиофайл в папку audio.';
    });
    for (const event of ['play', 'pause', 'ended', 'error']) audio.addEventListener(event, syncPlayButton);
    audio.src = source;
    playerArea.append(audio, status);
    audio.play().catch(error => {
      if (error.name === 'NotAllowedError') status.textContent = 'Браузер заблокировал воспроизведение. Нажмите кнопку воспроизведения.';
    });
  }
  let discTimer, trackTimer;
  function resetDisc() {
    discPress?.cancel();
    clearTimeout(discTimer);
    clearTimeout(trackTimer);
    modal.classList.remove('disc-visible');
  }
  let origin, animation, closing = false;
  function collapsed() {
    return {left: `${origin.px}px`, top: `${origin.py}px`, width: `${origin.w}px`, height: `${origin.h || origin.w}px`, margin: '0', right: 'auto', bottom: 'auto', borderRadius: `${origin.radius}px`};
  }
  function expanded() {
    const box = modal.getBoundingClientRect();
    return {left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, margin: '0', right: 'auto', bottom: 'auto', borderRadius: '40px'};
  }
  async function transition(opening) {
    const current = expanded();
    const currentRadius = getComputedStyle(modal).borderRadius;
    animation?.cancel();
    modal.style.transition = '';
    modal.style.transform = '';
    const large = expanded(), small = collapsed();
    modal.dataset.phase = opening ? 'opening' : 'closing';
    button.style.opacity = '0';
    playButton.style.opacity = '0';
    animation = modal.animate(opening ? [small, large] : [{...current,borderRadius:currentRadius}, small], {
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : opening ? 420 : 340,
      easing: 'cubic-bezier(.22,.65,.25,1)',
      fill: 'both'
    });
    try { await animation.finished; } catch { return; }
    animation.cancel();
    delete modal.dataset.phase;
    button.style.opacity = '';
    playButton.style.opacity = '';
    if (opening && !closing) {
      discTimer = setTimeout(() => {
        if (!modal.open || closing) return;
        modal.classList.add('disc-visible');
        const slideDuration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700;
        trackTimer = setTimeout(() => {
          if (modal.open && !closing && !playerArea.querySelector('audio')) startTrack(origin.title);
        }, slideDuration);
      }, 700);
    }
    if (!opening) {
      modal.close(); closing = false;
      window.dispatchEvent(new CustomEvent('card-modal-state',{detail:null}));
    }
  }
  function close() {
    if (!modal.open || closing) return;
    closing = true;
    swipe = null;
    fadeOutTrack();
    resetDisc();
    transition(false);
  }
  window.addEventListener('card-open', event => {
    if (modal.open) return;
    origin = event.detail;
    disc.disabled = Boolean(origin.cover);
    discTray.setAttribute('aria-hidden', String(disc.disabled));
    disc.tabIndex = disc.disabled ? -1 : 0;
    playButton.disabled = !tracks[origin.title];
    emptyTrack.hidden = !playButton.disabled;
    resetDisc();
    stopTrack();
    disc.style.backgroundImage = origin.cover ? `url("${origin.cover}")` : '';
    // Modal surfaces use the default gray background, independently of card artwork.
    modal.style.backgroundImage='none';
    modal.setAttribute('aria-label',origin.title || 'Карточка');
    modal.showModal();
    window.dispatchEvent(new CustomEvent('card-modal-state',{detail:origin}));
    transition(true);
  });
  playButton.addEventListener('click', () => {
    if (closing) return;
    clearTimeout(trackTimer);
    const audio = playerArea.querySelector('audio');
    if (!audio) { startTrack(origin.title); return; }
    if (audio.paused) {
      audio.play().then(() => {
        playerArea.querySelector('[role="status"]').textContent = '';
      }).catch(() => {
        playerArea.querySelector('[role="status"]').textContent = 'Не удалось воспроизвести трек.';
      });
    } else audio.pause();
  });
  button.addEventListener('click', close);
  modal.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (!modal.open || closing) return;
    // Suppress scrolling and the focused button's native Space activation.
    event.preventDefault();
    if (!event.repeat && !playButton.disabled) playButton.click();
  });
  modal.addEventListener('cancel', event => { event.preventDefault(); close(); });
  const mobileTouch = matchMedia('(hover: none) and (pointer: coarse)');
  let swipe = null;
  function resetSwipe() {
    swipe = null;
    modal.style.transition = matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'none' : 'transform 220ms cubic-bezier(.2,.8,.2,1)';
    modal.style.transform = '';
  }
  modal.addEventListener('pointerdown', event => {
    if (!mobileTouch.matches || event.pointerType !== 'touch' || !event.isPrimary ||
        closing || modal.dataset.phase || outside(event) ||
        event.target.closest('button, input, textarea, select, a, [contenteditable]')) return;
    modal.style.transition = 'none';
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY,
      start: performance.now(), distance: 0, active: false };
  });
  modal.addEventListener('pointermove', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    if (!swipe.active) {
      if (Math.hypot(dx, dy) < 10) return;
      if (dy <= 0 || Math.abs(dx) > dy) { resetSwipe(); return; }
      swipe.active = true;
      modal.setPointerCapture(event.pointerId);
    }
    swipe.distance = Math.max(0, dy);
    const widthScale = 1 - .12 * (1 - Math.exp(-swipe.distance / 140));
    modal.style.transform = `translateY(${swipe.distance * .8}px) scaleX(${widthScale})`;
  });
  modal.addEventListener('pointerup', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const { distance, start, active } = swipe;
    const speed = distance / Math.max(1, performance.now() - start);
    swipe = null;
    if (active && (distance >= 90 || (distance >= 35 && speed > .6))) close();
    else resetSwipe();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    modal.addEventListener(type, () => { if (swipe) resetSwipe(); });
  }
  let startedOutside = false;
  function outside(event) {
    const box = modal.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom;
  }
  modal.addEventListener('pointerdown', event => {
    startedOutside = event.button === 0 && event.target === modal && outside(event);
  });
  modal.addEventListener('click', event => {
    if (startedOutside && event.target === modal && outside(event)) close();
    startedOutside = false;
  });
  modal.addEventListener('pointercancel', () => { startedOutside = false; });
})();
