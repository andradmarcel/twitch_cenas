// DEC4LAND BRB Scene Controller (Já Volto)
(function() {
  // 1. URL Parameters handling: e.g. brb.html?time=3&title=JA+VOLTO
  const urlParams = new URLSearchParams(window.location.search);
  const initialMinutes = parseInt(urlParams.get('time') || '3', 10);
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

  // Keyboard controls for streamer
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        if (timerModeLabel) timerModeLabel.textContent = 'PAUSADO';
      } else {
        timerInterval = setInterval(tick, 1000);
        isRunning = true;
        if (timerModeLabel) timerModeLabel.textContent = isCountDown ? 'REGRESSIVO' : 'TEMPO AFK';
      }
    } else if (e.code === 'KeyR') {
      remainingSeconds = totalSeconds;
      elapsedSeconds = 0;
      updateTimerDisplay();
      if (!isRunning) {
        timerInterval = setInterval(tick, 1000);
        isRunning = true;
      }
      if (timerModeLabel) timerModeLabel.textContent = isCountDown ? 'REGRESSIVO' : 'TEMPO AFK';
    } else if (e.code === 'KeyM') {
      // Toggle countdown / count-up
      isCountDown = !isCountDown;
      if (timerModeLabel) timerModeLabel.textContent = isCountDown ? 'REGRESSIVO' : 'TEMPO AFK';
      updateTimerDisplay();
    } else if (e.code === 'ArrowUp') {
      totalSeconds += 60;
      remainingSeconds += 60;
      updateTimerDisplay();
    } else if (e.code === 'ArrowDown' && remainingSeconds > 60) {
      totalSeconds -= 60;
      remainingSeconds -= 60;
      updateTimerDisplay();
    }
  });

  // Start timer loop
  updateTimerDisplay();
  timerInterval = setInterval(tick, 1000);
})();
