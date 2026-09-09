(() => {
  'use strict';
  const modal = document.createElement('dialog');
  modal.className = 'card-modal';
  modal.setAttribute('aria-label', 'Карточка');
  modal.innerHTML = '<button class="card-modal-close" aria-label="Закрыть карточку" autofocus><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>';
  document.body.append(modal);
  const discTray = document.createElement('div');
  discTray.className = 'modal-disc-tray';
  discTray.setAttribute('aria-hidden', 'true');
  const disc = document.createElement('div');
  disc.className = 'modal-disc';
  discTray.append(disc);
  modal.prepend(discTray);
  const button = modal.querySelector('button');
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
  let fadeFrame, fadeTimer;
  function stopTrack() {
    cancelAnimationFrame(fadeFrame);
    clearTimeout(fadeTimer);
    const audio = playerArea.querySelector('audio');
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    playerArea.replaceChildren();
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
    audio.src = source;
    playerArea.append(audio, status);
    audio.play().catch(error => {
      if (error.name === 'NotAllowedError') status.textContent = 'Браузер заблокировал воспроизведение. Попробуйте открыть карточку ещё раз.';
    });
  }
  let discTimer, trackTimer;
  function resetDisc() {
    clearTimeout(discTimer);
    clearTimeout(trackTimer);
    modal.classList.remove('disc-visible');
  }
  let origin, animation, closing = false;
  function collapsed() {
    return {left: `${origin.px}px`, top: `${origin.py}px`, width: `${origin.w}px`, height: `${origin.w}px`, margin: '0', right: 'auto', bottom: 'auto', borderRadius: `${origin.radius}px`};
  }
  function expanded() {
    const box = modal.getBoundingClientRect();
    return {left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, margin: '0', right: 'auto', bottom: 'auto', borderRadius: '40px'};
  }
  async function transition(opening) {
    const current = expanded();
    const currentRadius = getComputedStyle(modal).borderRadius;
    animation?.cancel();
    const large = expanded(), small = collapsed();
    modal.dataset.phase = opening ? 'opening' : 'closing';
    button.style.opacity = '0';
    animation = modal.animate(opening ? [small, large] : [{...current,borderRadius:currentRadius}, small], {
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : opening ? 320 : 240,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'both'
    });
    try { await animation.finished; } catch { return; }
    animation.cancel();
    delete modal.dataset.phase;
    button.style.opacity = '';
    if (opening && !closing) {
      discTimer = setTimeout(() => {
        if (!modal.open || closing) return;
        modal.classList.add('disc-visible');
        const slideDuration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700;
        trackTimer = setTimeout(() => {
          if (modal.open && !closing) startTrack(origin.title);
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
    fadeOutTrack();
    resetDisc();
    transition(false);
  }
  window.addEventListener('card-open', event => {
    if (modal.open) return;
    origin = event.detail;
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
  button.addEventListener('click', close);
  modal.addEventListener('cancel', event => { event.preventDefault(); close(); });
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
