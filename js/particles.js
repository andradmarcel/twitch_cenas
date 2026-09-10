// Cyber Particle Engine for DEC4LAND Stream Scenes
class CyberParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.numParticles = 45;
    this.resize();
    this.init();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = 1920;
    this.canvas.height = 1080;
  }

  init() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        size: Math.random() * 2.5 + 0.8,
        speedX: (Math.random() - 0.4) * 0.6,
        speedY: -(Math.random() * 0.8 + 0.2), // float upwards
        opacity: Math.random() * 0.6 + 0.2,
        color: Math.random() > 0.3 ? '255, 26, 75' : '255, 120, 150',
        pulseSpeed: Math.random() * 0.02 + 0.005,
        pulseVal: Math.random() * Math.PI
      });
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, 1920, 1080);

    for (let p of this.particles) {
      p.x += p.speedX;
      p.y += p.speedY;
      p.pulseVal += p.pulseSpeed;

      const currentOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.pulseVal));

      if (p.y < -10) {
        p.y = 1090;
        p.x = Math.random() * 1920;
      }
      if (p.x < -10) p.x = 1930;
      if (p.x > 1930) p.x = -10;

      this.ctx.fillStyle = `rgba(${p.color}, ${currentOpacity})`;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = `rgba(${p.color}, 0.8)`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    requestAnimationFrame(this.animate);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new CyberParticles('particles-bg');
});
