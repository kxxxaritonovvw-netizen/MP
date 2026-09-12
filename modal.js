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
  const timeline = document.createElement('input');
  timeline.type = 'range';
  timeline.className = 'modal-timeline';
  timeline.min = '0';
  timeline.max = '100';
  timeline.step = '0.1';
  timeline.value = '0';
  timeline.disabled = true;
  timeline.setAttribute('aria-label', 'Позиция воспроизведения');
  modal.append(timeline);
  const waveform = document.createElement('div');
  waveform.className = 'modal-waveform';
  waveform.setAttribute('aria-hidden', 'true');
  const waveBars = Array.from({ length: 256 }, () => {
    const bar = document.createElement('span');
    waveform.append(bar);
    return bar;
  });
  modal.append(waveform);
  new ResizeObserver(() => {
    const width = Math.floor(waveform.clientWidth);
    const stride = Math.max(1, Math.ceil(waveBars.length / Math.max(1, Math.floor(width / 3))));
    waveBars.forEach((bar, i) => {
      bar.style.left = Math.round(i * Math.max(0, width - 1) / (waveBars.length - 1)) + 'px';
      bar.hidden = i % stride !== 0;
    });
  }).observe(waveform);
  const waveCache = new Map();
  async function loadWaveform(audio) {
    const source = audio.src;
    const startAt = Number(audio.dataset.startAt) || 0;
    const cacheKey = source + '#' + startAt;
    waveBars.forEach(bar => { bar.style.height = '3px'; });
    try {
      if (!waveCache.has(cacheKey)) {
        waveCache.set(cacheKey, (async () => {
          const response = await fetch(source);
          if (!response.ok) throw new Error('Audio unavailable');
          const context = new OfflineAudioContext(1, 1, 44100);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          const samples = buffer.getChannelData(0);
          const firstSample = Math.min(samples.length - 1, Math.floor(startAt * buffer.sampleRate));
          const playableSamples = samples.length - firstSample;
          const peaks = waveBars.map((_, i) => {
            const start = firstSample + Math.floor(i * playableSamples / waveBars.length);
            const end = firstSample + Math.floor((i + 1) * playableSamples / waveBars.length);
            let sum = 0;
            for (let j = start; j < end; j++) sum += samples[j] * samples[j];
            return Math.sqrt(sum / Math.max(1, end - start));
          });
          const max = Math.max(...peaks, .001);
          return peaks.map(peak => 3 + 29 * peak / max);
        })());
      }
      const heights = await waveCache.get(cacheKey);
      if (playerArea.querySelector('audio') !== audio) return;
      waveBars.forEach((bar, i) => { bar.style.height = heights[i] + 'px'; });
    } catch { waveCache.delete(cacheKey); }
  }
  function syncTimeline() {
    const audio = playerArea.querySelector('audio');
    const duration = audio?.duration;
    const startAt = Number(audio?.dataset.startAt) || 0;
    const ready = Number.isFinite(duration) && duration > 0;
    timeline.disabled = !ready;
    timeline.min = ready ? String(startAt) : '0';
    timeline.max = ready ? String(duration) : '100';
    timeline.value = ready ? String(Math.max(startAt, audio.currentTime)) : '0';
    const percent = ready ? Math.max(0, audio.currentTime - startAt) / Math.max(.1, duration - startAt) * 100 : 0;
    timeline.style.setProperty('--progress', percent + '%');
    waveBars.forEach((bar, i) => {
      bar.classList.toggle('played', i / waveBars.length * 100 < percent);
      if (!audio) bar.style.height = '3px';
    });
    const time = value => Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
    timeline.setAttribute('aria-valuetext', ready ? time(Math.max(0, audio.currentTime - startAt)) + ' из ' + time(duration - startAt) : 'Трек не загружен');
  }
  timeline.addEventListener('input', () => {
    const audio = playerArea.querySelector('audio');
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Number(timeline.value);
    syncTimeline();
  });
  function connectTimeline(audio) {
    loadWaveform(audio);
    for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'emptied', 'ended']) {
      audio.addEventListener(event, syncTimeline);
    }
    syncTimeline();
  }
  button.setAttribute('aria-keyshortcuts', 'Escape');
  const escapeHint = document.createElement('span');
  escapeHint.className = 'modal-escape-hint';
  escapeHint.textContent = 'esc';
  escapeHint.setAttribute('aria-hidden', 'true');
  button.append(escapeHint);
  const tracks = {
    'Пошлая Молли — Клеопатри': 'audio/tracks/kleopatri.mp3',
    'Lil Wayne, Drake — Right Above It': 'audio/tracks/right-above-it.mp3'
  };
  const trackStarts = {
    'Lil Wayne, Drake — Right Above It': 0
  };
  const playerArea = document.createElement('div');
  playerArea.className = 'modal-player';
  modal.append(playerArea);
  const subtitle = document.createElement('div');
  const subtitleFrameBox = document.createElement('div');
  subtitleFrameBox.className = 'modal-subtitle-frame';
  modal.append(subtitleFrameBox);
  subtitle.className = 'modal-subtitle';
  subtitle.hidden = true;
  subtitleFrameBox.append(subtitle);
  function layoutSubtitleFrame() {
    const controlsBottom = Math.max(...[[playButton, playHint], [button, escapeHint]].map(([control, hint]) =>
      control.offsetTop + (hint.offsetHeight ? hint.offsetTop + hint.offsetHeight : control.offsetHeight)));
    subtitleFrameBox.style.top = controlsBottom + 'px';
    // The revealed disc sits half outside the modal. Use its resting geometry
    // so the lyrics do not drift while the disc slides into position.
    subtitleFrameBox.style.bottom = discTray.offsetHeight / 2 + 'px';
  }
  const subtitleLayoutObserver = new ResizeObserver(layoutSubtitleFrame);
  [modal, discTray, playHint, escapeHint].forEach(element => subtitleLayoutObserver.observe(element));
  const countdown = document.createElement('div');
  countdown.className = 'modal-countdown';
  countdown.hidden = true;
  countdown.setAttribute('role', 'status');
  modal.append(countdown);
  function cancelCountdown() {
    countdown.hidden = true;
    countdown.textContent = '';
    countdown.getAnimations().forEach(animation => animation.cancel());
  }
  function syncCountdown(audio) {
    const first = subtitleLines.find(cue => cue.text);
    const remaining = first ? first.time - audio.currentTime : -1;
    if (remaining <= 0 || remaining > 3 || closing || audio.ended) { cancelCountdown(); return; }
    const number = String(Math.ceil(remaining));
    countdown.hidden = false;
    if (countdown.textContent !== number) {
      countdown.textContent = number;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        countdown.getAnimations().forEach(animation => animation.cancel());
        countdown.animate([{ opacity: .35, scale: '.92' }, { opacity: 1, scale: '1' }], { duration: 220, easing: 'ease-out' });
      }
    }
  }
  // Petaluma handwritten glyphs, Steinberg; SIL OFL (assets/notes/Petaluma-LICENSE.txt).
  const notePresets = [
    "<path fill=\"currentColor\" stroke=\"none\" transform=\"translate(20.0807 45.2190) scale(0.04844 -0.04844)\" d=\"M104 -140C109 -140 115 -140 121 -139C242 -128 321 -42 322 80V414C322 495 322 575 325 656C326 683 326 709 326 736V816C326 837 313 850 296 851C286 851 283 845 283 838C283 832 285 826 285 821C282 638 280 456 278 274V172C276 170 274 169 272 168C251 187 228 195 206 195C187 195 168 189 149 180C129 169 109 160 91 147C32 105 1 49 1 -26C1 -99 38 -140 104 -140ZM123 -41C103 -41 82 -34 63 -29C53 -26 48 -19 48 -8V-3C48 5 51 11 56 16C95 57 141 82 180 90C230 92 247 68 266 46C272 39 267 32 261 27C227 -3 188 -27 143 -38C136 -40 130 -41 123 -41Z\"/>",
    "<path fill=\"currentColor\" stroke=\"none\" transform=\"translate(20.0000 45.1915) scale(0.04863 -0.04863)\" d=\"M115 -137C208 -116 270 -55 313 28C321 45 326 63 326 83C325 108 324 132 324 157C324 199 326 242 327 284V466C328 578 328 690 329 802C329 820 323 833 308 842C303 845 299 847 295 847C289 847 285 841 284 830V818C282 746 283 673 281 600C277 464 275 327 275 192C275 186 275 180 273 174C269 172 266 173 263 174C250 178 236 180 223 180C204 180 185 176 167 168C97 139 45 90 12 21C4 4 0 -14 0 -33C0 -39 0 -45 1 -51C5 -103 44 -140 92 -140C99 -140 107 -139 115 -137Z\"/>",
    "<path fill=\"currentColor\" stroke=\"none\" transform=\"translate(14.6776 45.1429) scale(0.04898 -0.04898)\" d=\"M112 -138C205 -120 266 -59 308 24C316 40 322 56 322 75V579C322 601 323 624 326 647C331 643 335 642 338 639C415 559 468 465 493 356C501 321 512 286 512 251C512 230 508 209 498 188C486 163 481 138 481 111C481 92 484 73 489 52C509 75 519 99 527 124C540 167 544 211 544 256C544 267 543 278 543 289C542 351 531 411 517 471C492 577 440 667 364 745C345 764 324 783 324 816C324 829 312 840 298 840C285 840 283 834 283 827C283 822 284 816 284 812C282 709 281 606 280 503C278 397 277 290 276 184C276 172 274 166 267 166C264 166 261 167 256 169C246 173 235 175 224 175C214 175 205 173 195 171C106 148 46 91 9 8C1 -7 0 -27 0 -43C0 -99 36 -140 89 -140C96 -140 104 -140 112 -138Z\"/>",
    "<path fill=\"currentColor\" stroke=\"none\" transform=\"translate(20.2760 12.3438) scale(0.04768 -0.04768)\" d=\"M17 -830C27 -836 36 -825 44 -819C85 -794 113 -755 143 -719C198 -650 241 -575 258 -488C263 -460 265 -431 265 -403C265 -371 262 -338 257 -306C250 -263 239 -219 198 -191C194 -188 190 -187 187 -187C183 -187 180 -189 180 -193C181 -211 177 -228 177 -246C177 -261 180 -275 189 -289C202 -309 207 -330 207 -352C207 -359 207 -365 206 -371C194 -486 127 -571 53 -659C48 -480 51 -306 49 -131C66 -134 82 -140 97 -140C101 -140 104 -140 107 -139C199 -127 305 -27 322 64C323 71 324 77 324 83C324 137 285 175 225 175C185 175 150 161 117 137C47 89 0 28 0 -59C0 -67 0 -75 1 -84C3 -100 3 -116 3 -133V-165C6 -381 11 -596 11 -810C11 -818 12 -827 17 -830Z\"/>",
    "<path fill=\"currentColor\" stroke=\"none\" transform=\"translate(13.8653 45.2462) scale(0.04824 -0.04824)\" d=\"M112 -138C205 -120 265 -59 308 23C317 41 322 59 322 80V479C328 475 330 475 331 473C390 407 458 348 514 279C535 254 551 226 551 195C551 181 548 167 541 152C536 140 534 127 534 115C534 94 538 72 539 48C551 58 554 65 557 73C574 104 580 139 583 174C584 192 586 210 586 228C586 260 582 293 568 324C562 338 559 351 559 364C559 371 560 377 561 384C564 406 566 427 566 447C566 549 523 635 441 706C394 747 346 787 312 840C309 845 309 855 302 855C301 855 300 854 299 854C291 852 286 845 286 836C285 829 284 822 284 815C282 711 281 607 280 503C278 397 277 290 276 184C276 172 274 166 267 166C264 166 261 167 256 169C246 173 235 175 224 175C214 175 205 173 195 171C106 148 46 91 9 8C1 -7 0 -25 0 -42C0 -99 37 -140 90 -140C97 -140 104 -139 112 -138ZM534 400C471 460 409 519 346 578C332 592 323 606 323 625C323 629 323 633 324 637C325 646 326 654 326 664C326 676 325 689 325 704C372 649 427 610 470 558C499 525 521 488 534 445C535 441 536 437 536 433C536 423 533 414 533 407C533 404 533 402 534 400Z\"/>",
    "<path fill=\"currentColor\" stroke=\"none\" transform=\"translate(20.2887 12.3416) scale(0.04767 -0.04767)\" d=\"M17 -831C24 -835 29 -826 35 -822C79 -788 113 -744 149 -703C184 -663 215 -621 236 -572C252 -535 261 -498 261 -461C261 -435 256 -408 246 -381C244 -376 244 -370 238 -370H237C231 -371 226 -375 224 -381C223 -388 222 -396 222 -404C220 -440 212 -474 194 -504C156 -568 107 -622 56 -679C53 -663 52 -652 52 -642C52 -620 60 -608 79 -584C140 -513 184 -432 223 -348C238 -316 246 -284 246 -252C246 -228 241 -204 232 -179C229 -174 229 -165 222 -165H220C211 -166 208 -173 207 -182C203 -211 198 -240 185 -265C158 -317 130 -367 100 -417C87 -438 73 -459 50 -477V-393C49 -312 49 -231 48 -150C48 -139 49 -133 56 -133C59 -133 63 -134 68 -136C76 -139 85 -140 94 -140C99 -140 105 -140 111 -139C206 -125 324 -9 324 84C324 132 293 167 242 174C237 175 232 175 227 175C221 175 216 175 211 174C120 167 -9 54 0 -59C3 -94 3 -129 3 -164C6 -379 8 -594 11 -810C11 -818 10 -828 17 -831Z\"/>",
    "<path fill=\"currentColor\" stroke=\"none\" transform=\"translate(16.1940 46.2809) scale(0.04085 -0.04085)\" d=\"M112 -139C153 -133 188 -113 219 -87C267 -48 309 -2 320 62C324 86 326 111 326 135C326 158 324 181 323 203C321 234 320 266 320 297C320 343 322 390 321 438C345 415 367 396 388 376C428 338 469 302 499 254C509 238 516 222 516 206C516 195 513 183 504 171C497 162 495 150 488 141C468 110 451 79 451 43C451 33 453 22 456 10C457 5 456 -3 461 -5C468 -7 471 0 474 4C482 15 489 27 498 37C547 90 565 152 565 217C565 240 563 263 559 287C558 297 558 306 561 315C571 346 578 379 578 410C578 434 574 458 566 481C552 520 546 557 546 596C546 605 546 613 547 622V641C541 712 522 781 476 835C424 897 368 955 321 1020C318 1025 315 1035 307 1035C305 1035 303 1034 301 1033C291 1028 287 1020 287 1008C287 973 290 939 291 905C292 872 293 838 293 805C293 694 287 583 287 472V179C287 169 286 161 279 161C275 161 270 163 263 167C252 173 239 176 226 176C217 176 207 174 197 172C114 152 58 100 18 28C5 6 0 -18 0 -42C0 -101 39 -140 95 -140C100 -140 106 -140 112 -139ZM515 590C471 632 432 670 393 708C383 718 374 729 363 738C339 761 322 786 322 820C322 825 322 830 323 835C323 839 324 844 324 848C324 862 322 875 321 889C366 828 421 777 463 717C489 680 504 640 515 590ZM530 363C483 441 410 491 341 546C326 559 320 572 322 591C324 611 325 631 327 653C380 596 433 541 484 485C506 460 521 432 533 401C535 395 537 390 537 384C537 377 535 371 530 363Z\"/>",
    "<path fill=\"currentColor\" stroke=\"none\" transform=\"translate(21.3839 11.0815) scale(0.04047 -0.04047)\" d=\"M23 -1010C35 -1015 40 -1003 46 -997C67 -978 86 -956 107 -936C173 -871 233 -801 259 -709C269 -673 275 -637 275 -601C275 -570 271 -539 259 -509C257 -503 255 -497 255 -492C255 -486 257 -481 260 -475C278 -438 288 -400 288 -361C288 -341 286 -321 280 -301C275 -285 273 -269 273 -253C273 -229 277 -206 280 -183C281 -176 281 -168 281 -161C281 -132 274 -105 260 -79C256 -73 255 -69 255 -64C255 -59 257 -55 263 -49C293 -18 315 18 324 61C326 70 327 79 327 87C327 130 302 159 255 171C244 174 233 175 223 175C188 175 156 161 126 141C67 101 20 52 5 -22C4 -27 4 -32 4 -37C4 -50 6 -64 6 -77C4 -146 0 -216 0 -285C0 -307 0 -328 1 -350C5 -451 0 -551 7 -652C9 -679 9 -706 9 -734C9 -774 8 -815 8 -856C6 -879 4 -902 4 -925C4 -944 5 -963 8 -982C10 -994 12 -1005 23 -1010ZM33 -412C33 -362 32 -313 32 -263C32 -216 33 -169 36 -122C59 -135 81 -140 101 -140C149 -140 191 -111 234 -80C234 -115 233 -147 238 -178C240 -199 226 -219 214 -237C163 -314 105 -384 33 -450ZM44 -660C37 -656 37 -651 37 -646V-641C37 -629 38 -617 38 -606C38 -600 38 -594 37 -588C34 -565 43 -550 60 -534C124 -474 181 -406 230 -333C233 -328 234 -322 241 -319C245 -331 246 -342 246 -353C246 -387 230 -417 208 -446L82 -611C70 -627 57 -643 44 -660ZM39 -886C38 -874 37 -863 37 -852C37 -827 40 -804 41 -781C41 -772 48 -766 53 -759C105 -692 157 -625 209 -559C216 -550 222 -541 230 -530C233 -546 234 -562 234 -578C234 -623 223 -665 199 -705C157 -774 98 -827 39 -886Z\"/>"
];
  const recentNotes = [];
  function nextNotePreset() {
    const choices = notePresets.map((_, i) => i).filter(i => !recentNotes.includes(i));
    const selected = choices[Math.floor(Math.random() * choices.length)];
    recentNotes.push(selected);
    if (recentNotes.length > 6) recentNotes.shift();
    return notePresets[selected];
  }
  let waterFrame = null;
  let waterRipples = [];
  function clearWaterRipples() {
    cancelAnimationFrame(waterFrame);
    waterFrame = null;
    waterRipples = [];
    waveBars.forEach(bar => { bar.style.translate = ''; });
  }
  function rippleDisplacement(distance, elapsed) {
    const age = elapsed - distance / 380;
    if (age <= 0 || age >= 1.3) return 0;
    const fade = Math.pow(1 - age / 1.3, 2);
    return 5.5 * Math.sin(age * Math.PI * 5) * fade * Math.exp(-distance / 125);
  }
  function rippleTimeline(position = .5) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    waterRipples.push({ position, start: performance.now() });
    if (waterFrame !== null) return;
    function tick(now) {
      if (!modal.open || closing || matchMedia('(prefers-reduced-motion: reduce)').matches) { clearWaterRipples(); return; }
      const width = waveform.clientWidth;
      waterRipples = waterRipples.filter(ripple => (now - ripple.start) / 1000 < 1.3 + width / 380);
      if (!waterRipples.length) { clearWaterRipples(); return; }
      waveBars.forEach(bar => {
        if (bar.hidden) return;
        const x = parseFloat(bar.style.left) || 0;
        const offset = waterRipples.reduce((sum, ripple) => sum +
          rippleDisplacement(Math.abs(x - ripple.position * width), (now - ripple.start) / 1000), 0);
        // Superpose drops without restarting a moving bar; limit overlapping crests.
        bar.style.translate = '0 ' + (.8 * 6 * Math.tanh(offset / 6)).toFixed(3) + 'px';
      });
      waterFrame = requestAnimationFrame(tick);
    }
    waterFrame = requestAnimationFrame(tick);
  }
  const lyricFlights = new Set();
  function clearLyricFlights() {
    clearWaterRipples();
    lyricFlights.forEach(node => {
      node.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      node.remove();
    });
    lyricFlights.clear();
  }
  function releaseLyric(source = null) {
    if (closing || !modal.open || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const words = source || subtitle.querySelector('.subtitle-words');
    if (!words) return;
    const from = words.getBoundingClientRect(), box = modal.getBoundingClientRect();
    const target = waveform.getBoundingClientRect();
    const landingPosition = Math.random();
    const x = from.left + from.width / 2 - box.left;
    const y = from.top + from.height / 2 - box.top;
    const tx = target.left + target.width * landingPosition - box.left - x;
    const ty = target.top + target.height / 2 - box.top - y;
    const flight = document.createElement('div');
    flight.className = 'lyric-flight';
    flight.setAttribute('aria-hidden', 'true');
    flight.style.left = x + 'px';
    flight.style.top = y + 'px';
    const text = document.createElement('span');
    text.className = 'lyric-flight-text';
    text.textContent = words.textContent;
    text.style.font = getComputedStyle(words).font;
    const note = document.createElement('span');
    note.className = 'lyric-flight-note';
    note.innerHTML = '<svg viewBox="0 0 56 56" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + nextNotePreset() + '</svg>';
    flight.append(text, note);
    modal.append(flight);
    lyricFlights.add(flight);
    text.animate([
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', filter: 'blur(0px)' },
      { opacity: .45, transform: 'translate(-50%,-50%) scale(.82)', filter: 'blur(1px)', offset: .5 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)', filter: 'blur(5px)' }
    ], { duration: 620, fill: 'forwards', easing: 'ease-in-out' });
    note.animate([{ opacity: 0, scale: '.5' }, { opacity: .9, scale: '1' }], { delay: 200, duration: 440, fill: 'both', easing: 'ease-in-out' });
    const trajectory = Array.from({ length: 61 }, (_, i) => {
      const t = i / 60;
      const p = Math.max(0, (t - .18) / .82);
      const q = 1 - p;
      const dx = 3 * q * q * p * 22 + 3 * q * p * p * (tx + 32) + p * p * p * tx;
      const dy = 3 * q * q * p * -20 + 3 * q * p * p * (ty * .7) + p * p * p * ty;
      const absorb = Math.max(0, (p - .8) / .2);
      return { offset: t, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (1 - .9 * absorb * absorb) + ')', opacity: 1 - absorb * absorb };
    });
    const travel = flight.animate(trajectory, { duration: 1900, easing: 'cubic-bezier(.25,.05,.25,1)', fill: 'forwards' });
    // Use eased animation progress: absorption begins before the flight ends.
    // Waiting for finished leaves a visible gap between contact and the ripple.
    let contactFrame;
    function checkContact() {
      if (!lyricFlights.has(flight) || closing || !modal.open || travel.playState === 'idle') return;
      const progress = travel.effect.getComputedTiming().progress;
      if (progress !== null && progress >= .18 + .82 * .8) {
        rippleTimeline(landingPosition);
        return;
      }
      contactFrame = requestAnimationFrame(checkContact);
    }
    contactFrame = requestAnimationFrame(checkContact);
    travel.finished.catch(() => {}).finally(() => {
      cancelAnimationFrame(contactFrame);
      flight.remove();
      lyricFlights.delete(flight);
    });
  }
  let subtitleLines = [], subtitleIndex = -2, subtitleFrame, lastWordTime = null;
  function releaseCompletedWords(audio, animate) {
    const row = subtitle.querySelector('.subtitle-row');
    if (!row) return;
    const cue = subtitleLines[Number(row.dataset.cue)];
    if (!cue) return;
    row.querySelectorAll('.subtitle-word').forEach((token, i) => {
      const word = cue.words?.[i];
      if (!word) return;
      const complete = audio.currentTime >= word.end;
      if (complete && token.dataset.flown !== 'true') {
        if (animate && lastWordTime < word.end) releaseLyric(token);
        token.dataset.flown = 'true';
        // Keep the word's space so the remaining words never jump sideways.
        token.style.opacity = '0';
      } else if (!complete) {
        delete token.dataset.flown;
        token.style.opacity = '';
      }
    });
  }
  function syncSubtitle(audio) {
    if (playerArea.querySelector('audio') !== audio) return;
    let index = -1;
    for (let i = 0; i < subtitleLines.length; i++) {
      if (subtitleLines[i].time > audio.currentTime) break;
      index = i;
    }
    syncCountdown(audio);
    const cue = subtitleLines[index];
    const forwardPlayback = !audio.seeking && !audio.paused && lastWordTime !== null &&
      audio.currentTime >= lastWordTime && audio.currentTime - lastWordTime < .5;
    // Finish the last word before its row is removed at the next cue boundary.
    releaseCompletedWords(audio, forwardPlayback);

    subtitle.hidden = !cue?.text || audio.ended;
    if (subtitle.hidden) { subtitleIndex = -2; lastWordTime = audio.currentTime; return; }
    if (subtitleIndex !== index) {
      const continuous = index === subtitleIndex + 1 && !audio.seeking;
      const previousRows = new Map([...subtitle.children].map(row => [Number(row.dataset.cue), {
        row, top: row.getBoundingClientRect().top, opacity: getComputedStyle(row).opacity
      }]));
      subtitleIndex = index;
      const visible = subtitleLines.map((line, cueIndex) => ({ line, cueIndex }))
        .filter(item => item.cueIndex >= index && item.line.text).slice(0, 3);
      const keep = new Set(visible.map(item => item.cueIndex));
      for (const [cueIndex, item] of previousRows) {
        item.row.getAnimations().forEach(animation => animation.cancel());
        if (!keep.has(cueIndex)) item.row.remove();
      }
      visible.forEach(({ line, cueIndex }, position) => {
        const prior = previousRows.get(cueIndex);
        const row = prior?.row || document.createElement('div');
        if (!prior) {
          row.className = 'subtitle-row';
          row.dataset.cue = String(cueIndex);
          const text = document.createElement('span');
          text.className = 'subtitle-words';
          if (line.words?.length) {
            line.words.forEach((word, i) => {
              if (i) text.append(document.createTextNode(' '));
              const token = document.createElement('span');
              token.className = 'subtitle-word';
              token.textContent = word.text;
              text.append(token);
            });
            text.classList.add('has-word-timing');
          } else text.textContent = line.text;
          row.append(text);
        }
        subtitle.append(row);
        if (!prior) {
          const text = row.firstElementChild;
          const size = parseFloat(getComputedStyle(row).fontSize);
          if (text.scrollWidth > row.clientWidth) row.style.fontSize = Math.max(10, size * row.clientWidth / text.scrollWidth) + 'px';
        }
      });
      // Reuse the actual next rows and animate from their current screen positions.
      // Measuring all destinations after layout also keeps interrupted transitions smooth.
      const step = parseFloat(getComputedStyle(subtitle).gridAutoRows) + parseFloat(getComputedStyle(subtitle).rowGap);
      const moves = [...subtitle.children].map((row, position) => {
        const prior = previousRows.get(Number(row.dataset.cue));
        const delta = continuous ? (prior ? prior.top - row.getBoundingClientRect().top : step) : 0;
        return { row, delta, fromOpacity: continuous && prior ? prior.opacity : 0, opacity: [1, .28, .1][position] };
      });
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        moves.forEach(({ row, delta, fromOpacity, opacity }) => row.animate([
          { transform: 'translateY(' + delta + 'px)', opacity: fromOpacity },
          { transform: 'translateY(0)', opacity }
        ], { duration: continuous ? 560 : 220, easing: 'cubic-bezier(.22,.68,.2,1)' }));
      }
    }
    const end = subtitleLines[index + 1]?.time ?? audio.duration;
    const progress = Math.min(1, Math.max(0, (audio.currentTime - cue.time) / Math.max(.1, end - cue.time)));
    subtitle.style.setProperty('--sung', (progress * 100) + '%');
    if (cue.words?.length) {
      subtitle.querySelectorAll('.subtitle-row:first-child .subtitle-word').forEach((token, i) => {
        const word = cue.words[i];
        const fill = Math.min(1, Math.max(0, (audio.currentTime - word.start) / Math.max(.02, word.end - word.start)));
        token.style.setProperty('--word-sung', (fill * 100) + '%');
      });
    }
    releaseCompletedWords(audio, forwardPlayback);
    lastWordTime = audio.currentTime;
  }
  function animateSubtitles(audio) {
    cancelAnimationFrame(subtitleFrame);
    function tick() {
      syncSubtitle(audio);
      if (!audio.paused && !audio.ended && playerArea.querySelector('audio') === audio) subtitleFrame = requestAnimationFrame(tick);
    }
    tick();
  }
  async function loadSubtitles(audio, source) {
    try {
      const subtitleSource = source.replace('/tracks/', '/lyrics/').replace(/\.[^.]+$/, '.lrc');
      const response = await fetch(subtitleSource);
      if (!response.ok) return;
      const text = await response.text();
      if (playerArea.querySelector('audio') !== audio) return;
      subtitleLines = text.split(/\r?\n/).flatMap(line => {
        const stamps = [...line.matchAll(/\[(\d+):(\d{2}(?:\.\d+)?)\]/g)];
        const body = line.replace(/\[[^\]]*\]/g, '').trim();
        const marked = [...body.matchAll(/<(\d+):(\d{2}(?:\.\d+)?)>([^<]*)/g)];
        const words = marked.flatMap((match, i) => {
          const text = match[3].trim();
          const next = marked[i + 1];
          if (!text || !next) return [];
          return [{ text, start: Number(match[1]) * 60 + Number(match[2]), end: Number(next[1]) * 60 + Number(next[2]) }];
        });
        return stamps.map(match => ({ time: Number(match[1]) * 60 + Number(match[2]), text: body.replace(/<[^>]*>/g, '').trim(), words }));
      }).sort((a, b) => a.time - b.time);
      syncSubtitle(audio);
    } catch { /* A track may have no subtitles yet. */ }
  }
  const emptyTrack = document.createElement('div');
  emptyTrack.className = 'modal-empty-track';
  emptyTrack.innerHTML = '<p class="modal-empty-title">Трек пока не добавлен</p><p class="modal-empty-description">Трек будет скоро загружен, пока ожидай</p>';
  emptyTrack.hidden = true;
  modal.append(emptyTrack);
  let fadeFrame, fadeTimer;
  // Energy accents within the aligned stressed vowel, not the first lyric letter.
  // Estimates from the mixed recording; analysis is saved in audio/analysis.
  const chorusAccents = {
    'Пошлая Молли — Клеопатри': [25.065, 110.645, 147.465],
    'Lil Wayne, Drake — Right Above It': [26.96, 81.39, 157.18, 232.97]
  };
  const fireworks = new Set();
  let lingeringHaze = null;
  function clearFireworks(keepHaze = false) {
    fireworks.forEach(node => {
      node.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      node.remove();
    });
    fireworks.clear();
    if (!keepHaze && lingeringHaze) {
      lingeringHaze.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      lingeringHaze.remove();
      lingeringHaze = null;
    }
  }
  function celebrateChorus() {
    if (!modal.open || closing) return;
    clearFireworks(true);
    const layer = document.createElement('div');
    layer.className = 'chorus-fireworks';
    layer.setAttribute('aria-hidden', 'true');
    modal.prepend(layer);
    fireworks.add(layer);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lifetime = layer.animate([{ opacity: 1 }, { opacity: 1, offset: .85 }, { opacity: 0 }], { duration: 7000, fill: 'both' });
    const coverColor = origin?.hoverColor || { h: 0, s: 0 };
    const accentColor = coverColor.accent || coverColor;
    const tint = (color, lightness) => `hsl(${color.h} ${color.s}% ${lightness}%)`;
    const palette = [tint(coverColor, 78), tint(accentColor, 68), tint(coverColor, 58), tint(accentColor, 88)];
    if (!lingeringHaze) {
      lingeringHaze = document.createElement('div');
      lingeringHaze.className = 'chorus-fireworks chorus-atmosphere';
      lingeringHaze.setAttribute('aria-hidden', 'true');
      modal.prepend(lingeringHaze);
    }
    [coverColor, accentColor, coverColor].forEach((color, i) => {
      const existing = lingeringHaze.children[i];
      const haze = existing || document.createElement('div');
      const opacity = existing ? getComputedStyle(haze).opacity : 0;
      haze.getAnimations().filter(animation => animation.effect.getKeyframes().some(frame => 'opacity' in frame)).forEach(animation => animation.cancel());
      haze.className = 'chorus-haze';
      haze.style.left = (12 + i * 30) + '%';
      haze.style.top = (30 + (i % 2) * 20) + '%';
      haze.style.color = tint(color, 65);
      if (!existing) {
        lingeringHaze.append(haze);
        haze.style.opacity = '0';
        haze.style.transform = 'translate(-50%,-54%) scale(1.1)';
        if (!reduced) {
          const direction = i % 2 ? -1 : 1;
          haze.animate([
            { transform: `translate(-58%,-50%) rotate(${-12 * direction}deg) scale(1.08,.95)`, borderRadius: '48% 62% 42% 58%' },
            { transform: `translate(-34%,-66%) rotate(${14 * direction}deg) scale(1.28,1.1)`, borderRadius: '62% 38% 64% 36%', offset: .33 },
            { transform: `translate(-55%,-32%) rotate(${28 * direction}deg) scale(.98,1.24)`, borderRadius: '38% 58% 42% 66%', offset: .67 },
            { transform: `translate(-58%,-50%) rotate(${-12 * direction}deg) scale(1.08,.95)`, borderRadius: '48% 62% 42% 58%' }
          ], { duration: 10500 + i * 2300, delay: -i * 3100, iterations: Infinity, easing: 'ease-in-out' });
          haze.animate([
            { color: tint(color, 65) },
            { color: tint(i % 2 ? coverColor : accentColor, 72) },
            { color: tint(color, 65) }
          ], { duration: 15000 + i * 1700, delay: -i * 2600, iterations: Infinity, easing: 'ease-in-out' });
        }
      }
      haze.animate([
        { opacity },
        { opacity: .24, offset: .24 },
        { opacity: .18, offset: .55 },
        { opacity: .14 }
      ], { delay: 700 + i * 140, duration: 5600, fill: 'both', easing: 'ease-in-out' });
    });
    const lightPosition = progress => ({ x: -.12 + 1.24 * progress, y: .3 + .22 * Math.sin(progress * Math.PI) });
    if (!reduced) {
      const light = document.createElement('div');
      light.className = 'chorus-light';
      light.style.color = tint(accentColor, 76);
      layer.append(light);
      light.animate(Array.from({ length: 61 }, (_, frame) => {
        const t = frame / 60, position = lightPosition(t);
        return { offset: t, left: position.x * 100 + '%', top: position.y * 100 + '%', opacity: Math.sin(t * Math.PI) * .13 };
      }), { duration: 3000, fill: 'both', easing: 'linear' });
    }
    [[.5, .2], [.2, .35], [.8, .32]].forEach(([x, y], burst) => {
      const glow = document.createElement('div');
      glow.className = 'chorus-glow';
      glow.style.left = x * 100 + '%';
      glow.style.top = y * 100 + '%';
      glow.style.color = palette[burst];
      layer.append(glow);
      glow.animate([{ opacity: reduced ? .15 : .65, scale: '.7' }, { opacity: 0, scale: '1.25' }], { delay: burst * 16, duration: reduced ? 500 : 170, fill: 'both', easing: 'ease-out' });
      if (reduced) return;
      const radiusX = modal.clientWidth * .6;
      const radiusY = modal.clientHeight * .62;
      const silhouettes = [
        [[18,0],[100,12],[78,100],[0,78]],
        [[50,0],[100,48],[50,100],[0,52]],
        [[8,0],[100,32],[32,100]],
        [[0,15],[70,0],[100,35],[76,100],[12,85]],
        [[28,0],[75,8],[100,85],[62,100],[0,22]],
        [[0,0],[100,0],[100,100],[0,100]]
      ];
      for (let i = 0; i < 44; i++) {
        const spark = document.createElement('span');
        spark.className = 'chorus-spark';
        const shape = silhouettes[(i + burst) % silhouettes.length];
        spark.style.clipPath = 'polygon(' + shape.map(([px, py]) =>
          `${Math.max(0, Math.min(100, px + (Math.random() - .5) * 12))}% ${Math.max(0, Math.min(100, py + (Math.random() - .5) * 12))}%`).join(',') + ')';
        spark.style.width = (8 + Math.random() * 9) + 'px';
        spark.style.height = (18 + Math.random() * 18) + 'px';
        spark.style.left = x * 100 + '%';
        spark.style.top = y * 100 + '%';
        spark.style.color = palette[(i + burst) % palette.length];
        const angle = i / 44 * Math.PI * 2 + Math.random() * .1;
        const reach = .6 + Math.random() * .4;
        const duration = 2400 + Math.random() * 300;
        const base = (i + burst) % 2 ? accentColor : coverColor;
        const hueDelta = ((accentColor.h - base.h + 540) % 360) - 180;
        const direction = Math.random() < .5 ? -1 : 1;
        const tumbleX = direction * (100 + Math.random() * 360);
        const tumbleY = (Math.random() - .5) * 620;
        const spin = direction * (80 + Math.random() * 360);
        const spiral = i % 3 === 0 ? 14 + Math.random() * 24 : 0;
        const depth = (Math.random() - .45) * 230;
        const tilt = (Math.random() - .5) * 40;
        layer.append(spark);
        spark.animate(Array.from({ length: 101 }, (_, frame) => {
          const t = frame / 100;
          const attack = Math.min(1, t / .04);
          const distance = .8 * (1 - Math.pow(1 - attack, 2)) + .2 * t;
          const drift = Math.max(0, (t - .04) / .96);
          const orbit = drift * Math.PI * 3 * direction;
          const dx = Math.cos(angle) * radiusX * reach * distance + Math.sin(orbit) * spiral * drift;
          const dy = Math.sin(angle) * radiusY * reach * distance + t * t * 34 + (Math.cos(orbit) - 1) * spiral * drift;
          const light = lightPosition((burst * 16 + t * duration) / 3000);
          const lightDistance = Math.hypot((x + dx / modal.clientWidth - light.x) / .3, (y + dy / modal.clientHeight - light.y) / .35);
          const illumination = Math.exp(-lightDistance * lightDistance * 1.6);
          const size = .55 + .45 * Math.min(1, t / .055);
          const rotationX = tilt + drift * tumbleX;
          const rotationY = drift * tumbleY;
          const reflection = Math.pow(Math.max(0, Math.cos(rotationX * Math.PI / 180) * Math.cos(rotationY * Math.PI / 180)), 6) * illumination;
          return {
            offset: t,
            transform: `perspective(700px) translate3d(${dx}px,${dy}px,${Math.sin(drift * Math.PI * .8) * depth}px) rotateZ(${angle * 180 / Math.PI + drift * spin}deg) rotateX(${rotationX}deg) rotateY(${rotationY}deg) scale(${size})`,
            color: `hsl(${base.h + hueDelta * illumination} ${base.s * (1 - .3 * reflection)}% ${56 + 22 * illumination + 16 * reflection}%)`,
            opacity: Math.pow(1 - t, 1.05)
          };
        }), { delay: burst * 16, duration, fill: 'both' });
      }
    });
    lifetime.finished.catch(() => {}).finally(() => { layer.remove(); fireworks.delete(layer); });
  }
  function connectChorus(audio, title) {
    // Start the visual attack ahead of the musical peak so its expansion lands on it.
    const accents = (chorusAccents[title] || []).map(accent => accent - .18);
    let previous = audio.currentTime, frame;
    function tick() {
      const now = audio.currentTime;
      if (!audio.paused && !audio.seeking && now >= previous && now - previous < .5 &&
          accents.some(accent => previous < accent && now >= accent)) celebrateChorus();
      previous = now;
      if (!audio.paused && !audio.ended && playerArea.querySelector('audio') === audio) frame = requestAnimationFrame(tick);
    }
    audio.addEventListener('play', () => { cancelAnimationFrame(frame); previous = audio.currentTime; tick(); });
    // Seeking should interrupt only the transient burst. The cover-colour haze is
    // the persistent atmosphere between choruses, so keep it alive across timeline jumps.
    audio.addEventListener('seeking', () => { previous = audio.currentTime; clearFireworks(true); });
    audio.addEventListener('seeked', () => { previous = audio.currentTime; });
    audio.addEventListener('pause', () => { cancelAnimationFrame(frame); clearFireworks(true); });
    audio.addEventListener('ended', () => { cancelAnimationFrame(frame); clearFireworks(); });
  }
  function stopTrack() {
    clearFireworks();
    lastWordTime = null;
    cancelCountdown();
    clearLyricFlights();
    cancelAnimationFrame(subtitleFrame);
    subtitleIndex = -2;
    subtitleLines = [];
    subtitle.textContent = '';
    subtitle.hidden = true;
    cancelAnimationFrame(fadeFrame);
    clearTimeout(fadeTimer);
    const audio = playerArea.querySelector('audio');
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    playerArea.replaceChildren();
    syncTimeline();
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
    const startAt = trackStarts[title] || 0;
    audio.dataset.startAt = String(startAt);
    audio.setAttribute('aria-label', title);
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    audio.addEventListener('error', () => {
      status.textContent = 'Трек недоступен. Добавьте аудиофайл в папку audio.';
    });
    for (const event of ['play', 'pause', 'ended', 'error']) audio.addEventListener(event, syncPlayButton);
    audio.src = source;
    playerArea.append(audio, status);
    connectChorus(audio, title);
    for (const event of ['timeupdate', 'seeked', 'ended']) audio.addEventListener(event, () => syncSubtitle(audio));
    audio.addEventListener('play', () => animateSubtitles(audio));
    audio.addEventListener('pause', () => cancelAnimationFrame(subtitleFrame));
    audio.addEventListener('seeking', () => { lastWordTime = null; subtitleIndex = -2; clearLyricFlights(); syncSubtitle(audio); });
    loadSubtitles(audio, source);
    connectTimeline(audio);
    const play = () => {
      if (startAt && audio.currentTime < startAt) audio.currentTime = startAt;
      audio.play().catch(error => {
        if (error.name === 'NotAllowedError') status.textContent = 'Браузер заблокировал воспроизведение. Нажмите кнопку воспроизведения.';
      });
    };
    if (startAt && audio.readyState < 1) audio.addEventListener('loadedmetadata', play, { once: true });
    else play();
  }
  let discTimer, trackTimer;
  function resetDisc() {
    clearFireworks();
    clearLyricFlights();
    cancelCountdown();
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
      if (audio.ended) audio.currentTime = Number(audio.dataset.startAt) || 0;
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
