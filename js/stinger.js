// DEC4LAND Stinger Scene Transition Engine
(function(window) {
  class StingerTransition {
    constructor() {
      this.overlay = null;
      this.isAnimating = false;
      this.audioCtx = null;
      this.initDOM();
    }

    initDOM() {
      let overlay = document.querySelector('.stinger-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'stinger-overlay';
        overlay.innerHTML = `
          <div class="stinger-blade stinger-blade-1"></div>
          <div class="stinger-blade stinger-blade-2"></div>
          <div class="stinger-blade stinger-blade-3"></div>
          <div class="stinger-blade stinger-blade-4"></div>
          <div class="stinger-flash"></div>

          <div class="stinger-center-content">
            <div class="stinger-mascot-ring">
              <div class="stinger-pulse-circle"></div>
              <img src="assets/mascot.png" alt="DEC4LAND" class="stinger-mascot-img">
            </div>
            <div class="stinger-title-wrap">
              <h2 class="stinger-title">DEC4LAND</h2>
              <span class="stinger-tagline">// STREAM NETWORK</span>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      }
      this.overlay = overlay;
    }

    playWhooshSound() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!this.audioCtx) this.audioCtx = new AudioContext();
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        const now = this.audioCtx.currentTime;

        // 1. High-speed whoosh filter sweep
        const bufferSize = this.audioCtx.sampleRate * 0.8;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(3500, now + 0.35);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.75);

        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.01, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.35, now + 0.35);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.audioCtx.destination);
        noise.start(now);

        // 2. Sub impact boom at 0.45s (Transition Cut Point)
        const bassOsc = this.audioCtx.createOscillator();
        const bassGain = this.audioCtx.createGain();

        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(120, now + 0.35);
        bassOsc.frequency.exponentialRampToValueAtTime(35, now + 0.8);

        bassGain.gain.setValueAtTime(0.01, now + 0.35);
        bassGain.gain.exponentialRampToValueAtTime(0.4, now + 0.45);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        bassOsc.connect(bassGain);
        bassGain.connect(this.audioCtx.destination);
        bassOsc.start(now + 0.35);
        bassOsc.stop(now + 0.95);

      } catch (err) {
        console.log('[Stinger Sound] Audio blocked or unavailable:', err);
      }
    }

    trigger(onTransitionCut, onComplete) {
      if (this.isAnimating) return;
      this.isAnimating = true;

      // Make overlay visible
      this.overlay.classList.remove('stinger-animating');
      void this.overlay.offsetWidth; // force reflow
      this.overlay.classList.add('active', 'stinger-animating');

      // Play audio swoosh + impact
      this.playWhooshSound();

      // Transition point: screen is 100% covered at ~500ms
      setTimeout(() => {
        if (typeof onTransitionCut === 'function') {
          onTransitionCut();
        }
      }, 500);

      // Transition ends at 1150ms
      setTimeout(() => {
        this.overlay.classList.remove('active', 'stinger-animating');
        this.isAnimating = false;
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }, 1150);
    }
  }

  const stingerInstance = new StingerTransition();

  window.playStinger = function(onCut, onDone) {
    stingerInstance.trigger(onCut, onDone);
  };

  window.dec4landStinger = stingerInstance;
})(window);
