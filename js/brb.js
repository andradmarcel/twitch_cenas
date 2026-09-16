// DEC4LAND BRB Scene Controller (Já Volto)
(function () {
  // 1. URL Parameters handling: e.g. brb.html?time=3&title=JA+VOLTO
  const urlParams = new URLSearchParams(window.location.search);
  const initialMinutes = parseInt(urlParams.get('time') || '60', 10);
  const customTitle = urlParams.get('title');

  if (customTitle) {
    const headlineEl = document.querySelector('.brb-headline');
    if (headlineEl) {
      headlineEl.textContent = customTitle;
      headlineEl.setAttribute('data-text', customTitle);
    }
  }

  let totalSeconds = Math.max(1, initialMinutes) * 60;
  let remainingSeconds = totalSeconds;
  let elapsedSeconds = 0;
  let isCountDown = true; // true = countdown, false = countup (AFK elapsed)
  let timerInterval = null;
  let isRunning = true;

  const minutesEl = document.getElementById('brb-minutes');
  const secondsEl = document.getElementById('brb-seconds');
  const progressBar = document.getElementById('brb-timer-progress');
  const timerModeLabel = document.getElementById('timer-mode-label');
  const statusEl = document.getElementById('brb-status-message');
  const hydrationFill = document.getElementById('hydration-fill');
  const hydrationPct = document.getElementById('hydration-pct');

  // Dynamic Ticker Status Messages
  const statusMessages = [
    'Fui buscar aquela água bem gelada 🥤',
    'Alongando a coluna e conferindo a postura 🧘‍♂️',
    'Pegando um snack rápido para recarregar as energias ⚡',
    'Ajustando os equipamentos e lendo o chat 👀',
    'Não saia daí! Voltamos em poucos minutinhos 🔥',
    'Aproveita a pausa para pegar água e esticar as pernas! 🎮'
  ];
  let statusIndex = 0;

  function updateTimerDisplay() {
    let mins, secs;

    if (isCountDown) {
      mins = Math.floor(remainingSeconds / 60);
      secs = remainingSeconds % 60;
    } else {
      mins = Math.floor(elapsedSeconds / 60);
      secs = elapsedSeconds % 60;
    }

    if (minutesEl) minutesEl.textContent = String(mins).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(secs).padStart(2, '0');

    if (progressBar) {
      if (isCountDown) {
        const percentage = (remainingSeconds / totalSeconds) * 100;
        progressBar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
      } else {
        progressBar.style.width = '100%';
      }
    }

    // Dynamic hydration recharge calculation
    if (hydrationFill && hydrationPct) {
      let percentCharged;
      if (isCountDown) {
        // As countdown goes to zero, energy refills from 60% to 100%
        const ratio = 1 - (remainingSeconds / totalSeconds);
        percentCharged = Math.min(100, Math.floor(60 + (ratio * 40)));
      } else {
        percentCharged = Math.min(100, 75 + ((elapsedSeconds % 60) / 60 * 25));
      }
      hydrationFill.style.width = `${percentCharged}%`;
      hydrationPct.textContent = `${percentCharged}%`;
    }

    if (isCountDown && remainingSeconds <= 0) {
      clearInterval(timerInterval);
      isRunning = false;
      if (statusEl) statusEl.textContent = '🚀 VOLTANDO À TRANSMISSÃO AGORA MESMO!';
      const headlineEl = document.querySelector('.brb-headline');
      if (headlineEl) headlineEl.textContent = 'VOLTANDO JÁ!';
    }
  }

  function tick() {
    if (isCountDown) {
      if (remainingSeconds > 0) {
        remainingSeconds--;
      }
    } else {
      elapsedSeconds++;
    }
    updateTimerDisplay();
  }

  // Cycle funny/interactive status messages
  setInterval(() => {
    if (statusEl) {
      statusIndex = (statusIndex + 1) % statusMessages.length;
      statusEl.style.opacity = '0';
      setTimeout(() => {
        statusEl.textContent = statusMessages[statusIndex];
        statusEl.style.opacity = '1';
      }, 400);
    }
  }, 7000);

  // Equalizer dynamic heights jitter
  const eqCols = document.querySelectorAll('.eq-column');
  if (eqCols.length > 0) {
    setInterval(() => {
      eqCols.forEach(col => {
        const h = Math.floor(Math.random() * 85) + 15;
        col.style.height = `${h}%`;
      });
    }, 180);
  }

  function addMinutes(mins) {
    const secondsDelta = mins * 60;
    if (isCountDown) {
      if (remainingSeconds + secondsDelta < 10) return;
      totalSeconds = Math.max(10, totalSeconds + secondsDelta);
      remainingSeconds = Math.max(0, remainingSeconds + secondsDelta);
    } else {
      elapsedSeconds = Math.max(0, elapsedSeconds + secondsDelta);
    }
    updateTimerDisplay();
  }

  function togglePause() {
    if (isRunning) {
      clearInterval(timerInterval);
      isRunning = false;
      if (timerModeLabel) timerModeLabel.textContent = 'PAUSADO';
    } else {
      timerInterval = setInterval(tick, 1000);
      isRunning = true;
      if (timerModeLabel) timerModeLabel.textContent = isCountDown ? 'REGRESSIVO' : 'TEMPO AFK';
    }
    const pauseBtn = document.getElementById('btn-time-pause');
    if (pauseBtn) pauseBtn.textContent = isRunning ? 'PAUSAR' : 'RETOMAR';
  }

  // Focus window and body so OBS "Interagir" window immediately catches keypresses
  function ensureFocus() {
    window.focus();
    if (document.body) {
      document.body.focus();
    }
  }
  ensureFocus();
  document.addEventListener('click', ensureFocus, true);
  window.addEventListener('focus', ensureFocus);

  // Keyboard controls for streamer (OBS Interagir)
  function handleKeyDown(e) {
    const code = e.code || '';
    const key = e.key || '';
    const keyCode = e.keyCode || 0;

    const isUp = code === 'ArrowUp' || key === 'ArrowUp' || key === 'Up' || keyCode === 38;
    const isDown = code === 'ArrowDown' || key === 'ArrowDown' || key === 'Down' || keyCode === 40;
    const isRight = code === 'ArrowRight' || key === 'ArrowRight' || key === 'Right' || keyCode === 39;
    const isLeft = code === 'ArrowLeft' || key === 'ArrowLeft' || key === 'Left' || keyCode === 37;
    const isPlus = key === '+' || key === '=' || code === 'NumpadAdd';
    const isMinus = key === '-' || key === '_' || code === 'NumpadSubtract';
    const isSpace = code === 'Space' || key === ' ' || key === 'Spacebar' || keyCode === 32;
    const isR = code === 'KeyR' || key === 'r' || key === 'R' || keyCode === 82;
    const isM = code === 'KeyM' || key === 'm' || key === 'M' || keyCode === 77;

    if (isUp || isPlus) {
      e.preventDefault();
      e.stopPropagation();
      addMinutes(1);
    } else if (isDown || isMinus) {
      e.preventDefault();
      e.stopPropagation();
      addMinutes(-1);
    } else if (isRight) {
      e.preventDefault();
      e.stopPropagation();
      addMinutes(5);
    } else if (isLeft) {
      e.preventDefault();
      e.stopPropagation();
      addMinutes(-5);
    } else if (isSpace) {
      e.preventDefault();
      e.stopPropagation();
      togglePause();
    } else if (isR) {
      e.preventDefault();
      e.stopPropagation();
      remainingSeconds = totalSeconds;
      elapsedSeconds = 0;
      updateTimerDisplay();
      if (!isRunning) {
        timerInterval = setInterval(tick, 1000);
        isRunning = true;
      }
      if (timerModeLabel) timerModeLabel.textContent = isCountDown ? 'REGRESSIVO' : 'TEMPO AFK';
    } else if (isM) {
      e.preventDefault();
      e.stopPropagation();
      isCountDown = !isCountDown;
      if (timerModeLabel) timerModeLabel.textContent = isCountDown ? 'REGRESSIVO' : 'TEMPO AFK';
      updateTimerDisplay();
    }
  }

  // Register in capturing phase on both window and document so OBS cannot drop it
  window.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keydown', handleKeyDown, true);

  // Start timer loop
  updateTimerDisplay();
  timerInterval = setInterval(tick, 1000);
})();
