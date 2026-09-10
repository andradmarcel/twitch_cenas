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

  // Keyboard controls for streamer / testing
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
      } else {
        timerInterval = setInterval(tick, 1000);
        isRunning = true;
      }
    } else if (e.code === 'KeyR') {
      remainingSeconds = totalSeconds;
      updateTimerDisplay();
      if (!isRunning) {
        timerInterval = setInterval(tick, 1000);
        isRunning = true;
      }
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

  // Start timer
  updateTimerDisplay();
  timerInterval = setInterval(tick, 1000);
})();
