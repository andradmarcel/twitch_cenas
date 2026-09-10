// DEC4LAND Stream Alert Engine - Audio Synthesizer & Queue Controller
(function(window) {
  // Web Audio Synthesizer for high-impact esport alert sounds (No external audio files needed!)
  class AlertAudioSynth {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playTone(freq, type, duration, startTime = 0, gainLevel = 0.25) {
      if (this.muted || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type; // 'sine', 'triangle', 'square', 'sawtooth'
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

      gain.gain.setValueAtTime(gainLevel, this.ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + startTime);
      osc.stop(this.ctx.currentTime + startTime + duration);
    }

    playSound(alertType) {
      this.init();
      if (this.muted || !this.ctx) return;

      switch (alertType) {
        case 'follower':
          // Futuristic 2-tone chime
          this.playTone(523.25, 'sine', 0.25, 0.0, 0.25); // C5
          this.playTone(783.99, 'sine', 0.45, 0.12, 0.3); // G5
          this.playTone(1046.50, 'triangle', 0.6, 0.25, 0.35); // C6
          break;

        case 'sub':
          // Triumphant 4-note victory chord
          this.playTone(440.0, 'sawtooth', 0.2, 0.0, 0.18);  // A4
          this.playTone(554.37, 'sawtooth', 0.25, 0.1, 0.2); // C#5
          this.playTone(659.25, 'sawtooth', 0.3, 0.2, 0.22); // E5
          this.playTone(880.0, 'triangle', 0.7, 0.3, 0.35);  // A5
          this.playTone(1108.73, 'sine', 0.9, 0.35, 0.4);    // C#6
          break;

        case 'donation':
          // Cash register / coin drop + sub bass
          this.playTone(1318.51, 'sine', 0.3, 0.0, 0.35); // E6
          this.playTone(1760.00, 'sine', 0.4, 0.08, 0.4); // A6
          this.playTone(2637.02, 'sine', 0.55, 0.16, 0.45); // E7
          this.playTone(110.00, 'triangle', 0.5, 0.18, 0.3); // Bass hit
          break;

        case 'bits':
          // Rapid digital spark arpeggio
          const notes = [659.25, 880.0, 987.77, 1318.51, 1567.98];
          notes.forEach((f, idx) => {
            this.playTone(f, 'sine', 0.18, idx * 0.06, 0.25);
          });
          break;

        case 'raid':
          // Dramatic hazard pulse + victory fanfare
          this.playTone(329.63, 'square', 0.15, 0.0, 0.15);
          this.playTone(493.88, 'square', 0.2, 0.12, 0.18);
          this.playTone(329.63, 'square', 0.15, 0.24, 0.15);
          this.playTone(659.25, 'sawtooth', 0.6, 0.38, 0.3);
          this.playTone(987.77, 'sine', 0.8, 0.48, 0.4);
          break;

        default:
          this.playTone(880, 'sine', 0.4, 0, 0.3);
      }
    }
  }

  // Alert Manager with Queue System
  class AlertManager {
    constructor() {
      this.queue = [];
      this.isShowing = false;
      this.audio = new AlertAudioSynth();
      this.container = null;
      this.broadcastChannel = null;
      this.recentAlertIds = new Set(); // Prevents duplicate triggers

      this.initDOM();
      this.initBroadcast();
    }

    initDOM() {
      let cont = document.querySelector('.alert-container');
      if (!cont) {
        cont = document.createElement('div');
        cont.className = 'alert-container';
        document.body.appendChild(cont);
      }
      this.container = cont;

      // Unlock AudioContext on any user gesture
      const unlockAudio = () => {
        this.audio.init();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('click', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
    }

    initBroadcast() {
      // BroadcastChannel allows index.html (or any tab) on the same origin to trigger alerts in OBS
      try {
        if ('BroadcastChannel' in window) {
          this.broadcastChannel = new BroadcastChannel('dec4land_stream_alerts');
          this.broadcastChannel.onmessage = (e) => {
            if (e.data && e.data.action === 'trigger_alert') {
              this.enqueue(e.data.payload);
            }
          };
        }
      } catch (err) {
        console.log('[Alerts] BroadcastChannel not supported:', err);
      }

      // Storage event listener (syncs across tabs and windows on same origin)
      window.addEventListener('storage', (e) => {
        if (e.key === 'dec4land_stream_alert_trigger' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed && parsed.payload) {
              this.enqueue(parsed.payload);
            }
          } catch(err) {}
        }
      });

      // Also listen to postMessage
      window.addEventListener('message', (e) => {
        if (e.data && e.data.action === 'trigger_alert') {
          this.enqueue(e.data.payload);
        }
      });

      // Keyboard test triggers when interacting with the source in OBS (Right click -> Interagir -> teclas 1 a 5)
      window.addEventListener('keydown', (e) => {
        const tests = {
          '1': { type: 'follower', user: 'Marcel_Gamer' },
          '2': { type: 'sub', user: 'Marcel_Gamer', detail: 'assinou o canal (Tier 1)!' },
          '3': { type: 'donation', user: 'Marcel_Gamer', amount: 'R$ 50,00' },
          '4': { type: 'bits', user: 'Marcel_Gamer', amount: '500' },
          '5': { type: 'raid', user: 'Marcel_Gamer', amount: '25' }
        };
        if (tests[e.key]) {
          this.enqueue({ id: 'key_test_' + Date.now(), ...tests[e.key] });
        }
      });

      // Instant test on load if URL has ?test=follower (or ?test=1)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('test')) {
          setTimeout(() => {
            const t = urlParams.get('test');
            const type = (t === '1' || t === 'true' || !t) ? 'follower' : t;
            this.enqueue({
              id: 'url_test_' + Date.now(),
              type: type,
              user: 'Marcel_Gamer',
              amount: 'R$ 50,00',
              detail: 'começou a seguir o canal!'
            });
          }, 1000);
        }
      } catch(e) {}
    }

    enqueue(alertData) {
      if (!alertData) return;

      // Deduplication check: prevent identical alert firing twice within 5 seconds
      const alertId = alertData.id || `${alertData.type}_${alertData.user || ''}_${Math.floor(Date.now() / 1500)}`;
      if (this.recentAlertIds.has(alertId)) {
        return; // Ignore duplicate
      }
      this.recentAlertIds.add(alertId);
      setTimeout(() => this.recentAlertIds.delete(alertId), 5000);

      this.queue.push(alertData);
      if (!this.isShowing) {
        this.processNext();
      }
    }

    processNext() {
      if (this.queue.length === 0) {
        this.isShowing = false;
        return;
      }

      this.isShowing = true;
      const data = this.queue.shift();
      this.renderAlert(data);
    }

    // Strict HTML sanitizer to prevent XSS attacks in OBS Studio Browser Source
    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    renderAlert(data) {
      const type = (data.type || 'follower').toLowerCase();
      const safeUser = this.escapeHtml(data.user || 'Novo Viewer');
      const safeAmount = this.escapeHtml(data.amount || '');
      const safeMessage = this.escapeHtml(data.message || '');
      const rawDetail = data.detail || '';

      // Set config based on type
      let badgeText = '★ NOVO SEGUIDOR';
      let defaultDetail = 'começou a seguir o canal!';
      let typeClass = 'type-follower';

      if (type === 'sub' || type === 'resub') {
        badgeText = '💎 NOVO SUB';
        defaultDetail = rawDetail ? this.escapeHtml(rawDetail) : 'acabou de se inscrever no canal!';
        typeClass = 'type-sub';
      } else if (type === 'donation' || type === 'pix') {
        badgeText = '💵 NOVA DOAÇÃO // PIX';
        defaultDetail = `doou <b>${safeAmount || 'R$ 10,00'}</b>!`;
        typeClass = 'type-donation';
      } else if (type === 'bits' || type === 'cheer') {
        badgeText = '⚡ CHEER DE BITS';
        defaultDetail = `enviou <b>${safeAmount || '100'} Bits</b>!`;
        typeClass = 'type-bits';
      } else if (type === 'raid' || type === 'host') {
        badgeText = '🚨 RAID ENTRANTE';
        defaultDetail = `chegou com <b>${safeAmount || '50'} espectadores</b>!`;
        typeClass = 'type-raid';
      }

      const detailHtml = rawDetail ? this.escapeHtml(rawDetail) : defaultDetail;

      // Build safe alert HTML
      const alertBox = document.createElement('div');
      alertBox.className = `alert-box ${typeClass}`;
      alertBox.innerHTML = `
        <div class="alert-mascot-avatar">
          <div class="alert-ring-pulse"></div>
          <img src="assets/mascot.png" alt="DEC4LAND Mascote" class="alert-mascot-img">
        </div>

        <div class="alert-content">
          <div class="alert-type-badge">${badgeText}</div>
          <div class="alert-user-name">${safeUser}</div>
          <div class="alert-detail-text">${detailHtml}</div>
          ${safeMessage ? `<div class="alert-custom-message">"${safeMessage}"</div>` : ''}
        </div>
      `;

      // Clear any remaining elements in container to prevent memory leaks
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild);
      }
      this.container.appendChild(alertBox);

      // Play custom synth audio
      this.audio.playSound(type);

      // Trigger animation in GPU layer
      requestAnimationFrame(() => {
        alertBox.classList.add('active');
      });

      // Clear pending dismiss timer if exists
      if (this._dismissTimer) clearTimeout(this._dismissTimer);
      if (this._removeTimer) clearTimeout(this._removeTimer);

      // Clean node disposal when alert leaves
      const cleanupAlertNode = () => {
        alertBox.removeEventListener('transitionend', cleanupAlertNode);
        if (alertBox.parentElement) {
          alertBox.remove();
        }
        setTimeout(() => this.processNext(), 350);
      };

      // Stay on screen for 6.2 seconds
      this._dismissTimer = setTimeout(() => {
        alertBox.classList.remove('active');
        alertBox.classList.add('leaving');

        alertBox.addEventListener('transitionend', cleanupAlertNode, { once: true });
        // Fallback safeguard timer if transitionend is skipped by OBS throttling
        this._removeTimer = setTimeout(cleanupAlertNode, 600);
      }, 6200);
    }
  }

  // Instantiate singleton
  const manager = new AlertManager();

  // Global helper to trigger alert locally or broadcast
  window.triggerTwitchAlert = function(alertData, broadcast = true) {
    manager.enqueue(alertData);
    if (broadcast && manager.broadcastChannel) {
      try {
        manager.broadcastChannel.postMessage({
          action: 'trigger_alert',
          payload: alertData
        });
      } catch (e) {}
    }
  };

  window.dec4landAlertManager = manager;

  // Universal Twitch IRC listener for scenes running without gameplay.js (starting, ending, alerts.html)
  setTimeout(() => {
    if (window._dec4landTwitchIrcConnected) return; // gameplay.js handles its own connection
    window._dec4landTwitchIrcConnected = true;

    const urlParams = new URLSearchParams(window.location.search);
    const channel = (urlParams.get('channel') || localStorage.getItem('dec4land_twitch_channel') || 'dec4land').toLowerCase().replace('#', '');

    try {
      const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send('PASS SCHMOOPIIE');
        ws.send('NICK justinfan' + Math.floor(Math.random() * 80000 + 10000));
        ws.send('JOIN #' + channel);
      };
      ws.onmessage = (e) => {
        const lines = e.data.split('\r\n');
        lines.forEach(line => {
          if (line.startsWith('PING')) {
            ws.send('PONG :tmi.twitch.tv');
            return;
          }
          if (line.includes(' USERNOTICE ')) {
            let tags = {};
            if (line.startsWith('@')) {
              const sp = line.indexOf(' ');
              line.substring(1, sp).split(';').forEach(t => {
                const eq = t.indexOf('=');
                if (eq !== -1) tags[t.substring(0, eq)] = t.substring(eq + 1);
              });
            }
            const colon = line.indexOf(' :');
            const msg = colon !== -1 ? line.substring(colon + 2) : '';
            const msgId = tags['msg-id'];
            const user = tags['display-name'] || tags['login'] || 'Viewer';
            const months = tags['msg-param-cumulative-months'] || '1';

            if (msgId === 'sub' || msgId === 'resub') {
              window.triggerTwitchAlert({ type: 'sub', user, detail: `assinou o canal! (${months} meses)`, message: msg });
            } else if (msgId === 'subgift' || msgId === 'anonsubgift') {
              const rec = tags['msg-param-recipient-display-name'] || 'um espectador';
              window.triggerTwitchAlert({ type: 'sub', user, detail: `presenteou um Sub para ${rec}!` });
            } else if (msgId === 'raid') {
              const viewers = tags['msg-param-viewerCount'] || '10';
              window.triggerTwitchAlert({ type: 'raid', user, amount: viewers, detail: `chegou com ${viewers} espectadores!` });
            }
          }
          if (line.includes(' PRIVMSG ') && line.includes('bits=')) {
            let tags = {};
            if (line.startsWith('@')) {
              const sp = line.indexOf(' ');
              line.substring(1, sp).split(';').forEach(t => {
                const eq = t.indexOf('=');
                if (eq !== -1) tags[t.substring(0, eq)] = t.substring(eq + 1);
              });
            }
            if (tags['bits']) {
              const colon = line.indexOf(' :');
              const msg = colon !== -1 ? line.substring(colon + 2) : '';
              const user = tags['display-name'] || tags['login'] || 'Viewer';
              window.triggerTwitchAlert({ type: 'bits', user, amount: tags['bits'], message: msg });
            }
          }
        });
      };
      ws.onclose = () => {
        window._dec4landTwitchIrcConnected = false;
      };
    } catch(err) {}
  }, 600);
})(window);
