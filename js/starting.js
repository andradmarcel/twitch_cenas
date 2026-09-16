// DEC4LAND Starting Scene Controller
(function() {
  // Parse URL options: e.g. starting.html?time=5&title=BORA+PRO+SHOW
  const urlParams = new URLSearchParams(window.location.search);
  const initialMinutes = parseInt(urlParams.get('time') || '5', 10);
  const customTitle = urlParams.get('title');

  if (customTitle) {
    const headlineEl = document.querySelector('.starting-headline');
    if (headlineEl) headlineEl.textContent = customTitle;
  }

  let totalSeconds = initialMinutes * 60;
  let remainingSeconds = totalSeconds;
  let timerInterval = null;
  let isRunning = true;

  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const progressBar = document.getElementById('timer-progress');
  const statusEl = document.getElementById('status-message');

  const statusMessages = [
    'Aquecendo os motores para a gameplay...',
    'Ajustando áudio, câmera e bitrate...',
    'Separando aquela água gelada e os lanches...',
    'Chamando a galera no Twitter e Discord...',
    'Tudo pronto! A live vai começar em instantes!'
  ];
  let statusIndex = 0;

  function updateTimerDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    if (minutesEl) minutesEl.textContent = String(mins).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(secs).padStart(2, '0');

    if (progressBar) {
      const percentage = (remainingSeconds / totalSeconds) * 100;
      progressBar.style.width = `${Math.max(0, percentage)}%`;
    }

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      isRunning = false;
      if (statusEl) statusEl.textContent = '🔥 LIVE INICIANDO AGORA! BEM-VINDOS!';
      const headlineEl = document.querySelector('.starting-headline');
      if (headlineEl) headlineEl.textContent = 'ESTAMOS AO VIVO!';
    }
  }

  function tick() {
    if (remainingSeconds > 0) {
      remainingSeconds--;
      updateTimerDisplay();
    }
  }

  // Cycle status messages every 8 seconds
  setInterval(() => {
    if (remainingSeconds > 0 && statusEl) {
      statusIndex = (statusIndex + 1) % statusMessages.length;
      statusEl.style.opacity = '0';
      setTimeout(() => {
        statusEl.textContent = statusMessages[statusIndex];
        statusEl.style.opacity = '1';
      }, 400);
    }
  }, 8000);

  function addMinutes(mins) {
    const secondsDelta = mins * 60;
    if (remainingSeconds + secondsDelta < 10) return;
    totalSeconds = Math.max(10, totalSeconds + secondsDelta);
    remainingSeconds = Math.max(0, remainingSeconds + secondsDelta);
    updateTimerDisplay();
  }

  function togglePause() {
    if (isRunning) {
      clearInterval(timerInterval);
      isRunning = false;
    } else {
      timerInterval = setInterval(tick, 1000);
      isRunning = true;
    }
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
      updateTimerDisplay();
      if (!isRunning) {
        timerInterval = setInterval(tick, 1000);
        isRunning = true;
      }
    }
  }

  // Register in capturing phase on both window and document so OBS cannot drop it
  window.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keydown', handleKeyDown, true);

  // Start timer
  updateTimerDisplay();
  timerInterval = setInterval(tick, 1000);
})();
