// DEC4LAND Ending Scene Controller
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const customTitle = urlParams.get('title');

  if (customTitle) {
    const headlineEl = document.querySelector('.ending-headline');
    if (headlineEl) headlineEl.textContent = customTitle;
  }

  // Subtle pulsing highlight on social cards sequentially
  const cards = document.querySelectorAll('.showcase-card');
  let activeCard = 0;

  setInterval(() => {
    cards.forEach((c, idx) => {
      if (idx === activeCard) {
        c.style.borderColor = 'var(--neon-red)';
        c.style.boxShadow = '0 0 25px var(--neon-red-glow)';
      } else {
        c.style.borderColor = 'rgba(255, 26, 75, 0.35)';
        c.style.boxShadow = 'none';
      }
    });
    activeCard = (activeCard + 1) % cards.length;
  }, 4000);
})();
