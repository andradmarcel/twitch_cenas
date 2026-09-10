// Cyber Particle Engine for DEC4LAND Stream Scenes
// Highly optimized for OBS Studio CEF (Chromium Embedded Framework)
class CyberParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.numParticles = 40;
    this.isRunning = false;
    this.animId = null;

    // Pre-render glow particle sprites on offscreen canvases
    // Replaces expensive per-frame Gaussian shadowBlur with hardware-accelerated texture blits
    this.sprites = {
      red: this.createGlowSprite(255, 26, 75),
      pink: this.createGlowSprite(255, 120, 150)
    };

    this.resize();
    this.init();
    this.animate = this.animate.bind(this);

    // Visibility listener: automatically pauses when OBS switches to another scene
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    });

    window.addEventListener('pagehide', () => this.stop());
    window.addEventListener('pageshow', () => this.start());
    window.addEventListener('resize', () => this.resize());

    // Start rendering if page is visible
    if (!document.hidden) {
      this.start();
    }
  }

  createGlowSprite(r, g, b) {
    const size = 64;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = size;
    offCanvas.height = size;
    const offCtx = offCanvas.getContext('2d');
    const center = size / 2;
    const radius = size / 2;

    const grad = offCtx.createRadialGradient(center, center, 0, center, center, radius);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1.0)`);
    grad.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.85)`);
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.3)`);
    grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);

    offCtx.fillStyle = grad;
    offCtx.beginPath();
    offCtx.arc(center, center, radius, 0, Math.PI * 2);
    offCtx.fill();

    return offCanvas;
  }

  resize() {
    this.canvas.width = 1920;
    this.canvas.height = 1080;
  }

  init() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      const isRed = Math.random() > 0.3;
      this.particles.push({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        size: Math.random() * 3 + 2,
        speedX: (Math.random() - 0.4) * 0.6,
        speedY: -(Math.random() * 0.8 + 0.2), // float upwards
        opacity: Math.random() * 0.6 + 0.3,
        sprite: isRed ? this.sprites.red : this.sprites.pink,
        pulseSpeed: Math.random() * 0.02 + 0.005,
        pulseVal: Math.random() * Math.PI
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animId = requestAnimationFrame(this.animate);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  animate() {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, 1920, 1080);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.speedX;
      p.y += p.speedY;
      p.pulseVal += p.pulseSpeed;

      const currentOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.pulseVal));

      if (p.y < -20) {
        p.y = 1100;
        p.x = Math.random() * 1920;
      }
      if (p.x < -20) p.x = 1940;
      if (p.x > 1940) p.x = -20;

      // Draw cached hardware-accelerated sprite without Gaussian blur recalculation
      this.ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));
      const drawSize = p.size * 4;
      this.ctx.drawImage(p.sprite, p.x - drawSize / 2, p.y - drawSize / 2, drawSize, drawSize);
    }

    this.ctx.globalAlpha = 1.0;
    this.animId = requestAnimationFrame(this.animate);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new CyberParticles('particles-bg');
});
