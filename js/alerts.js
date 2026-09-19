// DEC4LAND Stream Alert Engine - Audio Synthesizer & Queue Controller
(function(window) {
  // Web Audio Synthesizer for high-impact esport alert sounds (No external audio files needed!)
  class AlertAudioSynth {
    constructor() {
      this.ctx = null;
      // Áudio centralizado exclusivamente em alerts.html e index.html (painel de testes)
      // Nas demais cenas de sobreposição, o áudio local é silenciado por padrão para eliminar eco/flanger no OBS
      const path = (window.location.pathname || '').toLowerCase();
      const isMasterAudioScene = path.includes('alerts.html') || path.includes('index.html') || path === '' || path === '/';
      const urlParams = new URLSearchParams(window.location.search);
      const forceAudio = urlParams.get('audio') === '1' || urlParams.get('sound') === '1';
      const forceMute = urlParams.get('audio') === '0' || urlParams.get('sound') === '0' || urlParams.get('mute') === '1';

      if (forceMute) {
        this.muted = true;
      } else if (forceAudio) {
        this.muted = false;
      } else {
        this.muted = !isMasterAudioScene;
      }

      // Volume Master (padrão 85%, configurável via ?vol=100 ou config.js)
      const cfg = window.DEC4LAND_CONFIG || {};
      const customVol = urlParams.get('vol') || urlParams.get('volume') || cfg.alertVolume;
      this.masterVolume = customVol !== null && customVol !== undefined ? Math.max(0, Math.min(1.0, parseFloat(customVol) > 1 ? parseFloat(customVol) / 100 : parseFloat(customVol))) : 0.85;
    }

    async init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        try {
          await this.ctx.resume();
        } catch (e) {
          console.warn('[Alerts] AudioContext resume:', e);
        }
      }
    }

    playTone(freq, type, duration, startTime = 0, gainLevel = 0.5) {
      if (this.muted || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const effectiveGain = Math.max(0.01, gainLevel * this.masterVolume);
      const startAt = Math.max(this.ctx.currentTime, this.ctx.currentTime + startTime);

      osc.type = type; // 'sine', 'triangle', 'square', 'sawtooth'
      osc.frequency.setValueAtTime(freq, startAt);

      gain.gain.setValueAtTime(effectiveGain, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startAt);
      osc.stop(startAt + duration);
    }

    async playSound(alertType) {
      await this.init();
      if (this.muted || !this.ctx) return;

      switch (alertType) {
        case 'follower':
          // Futuristic 3-tone high chime (agora audível e vibrante)
          this.playTone(587.33, 'sine', 0.22, 0.0, 0.55); // D5
          this.playTone(880.00, 'sine', 0.35, 0.10, 0.65); // A5
          this.playTone(1174.66, 'triangle', 0.55, 0.22, 0.75); // D6
          break;

        case 'sub':
          // Triumphant victory fanfare (5 notas potentes)
          this.playTone(440.00, 'sawtooth', 0.18, 0.0, 0.45);  // A4
          this.playTone(554.37, 'sawtooth', 0.22, 0.09, 0.50); // C#5
          this.playTone(659.25, 'sawtooth', 0.28, 0.18, 0.55); // E5
          this.playTone(880.00, 'triangle', 0.55, 0.28, 0.70); // A5
          this.playTone(1108.73, 'sine', 0.75, 0.34, 0.80);    // C#6
          break;

        case 'donation':
          // Cash register / coin drop + sub bass punch
          this.playTone(1318.51, 'sine', 0.25, 0.0, 0.65); // E6
          this.playTone(1760.00, 'sine', 0.35, 0.08, 0.70); // A6
          this.playTone(2637.02, 'sine', 0.50, 0.16, 0.80); // E7
          this.playTone(110.00, 'triangle', 0.45, 0.18, 0.60); // Bass hit
          break;

        case 'bits':
          // Rapid digital spark arpeggio
          const notes = [659.25, 880.0, 987.77, 1318.51, 1567.98];
          notes.forEach((f, idx) => {
            this.playTone(f, 'sine', 0.20, idx * 0.06, 0.60);
          });
          break;

        case 'raid':
          // Dramatic hazard pulse + victory fanfare
          this.playTone(329.63, 'square', 0.15, 0.0, 0.40);
          this.playTone(493.88, 'square', 0.2, 0.12, 0.45);
          this.playTone(329.63, 'square', 0.15, 0.24, 0.40);
          this.playTone(659.25, 'sawtooth', 0.6, 0.38, 0.65);
          this.playTone(987.77, 'sine', 0.8, 0.48, 0.75);
          break;

        default:
          this.playTone(880, 'sine', 0.4, 0, 0.6);
      }
    }
  }

  // Alert Manager with Queue System
  class AlertManager {
    constructor() {
      this.queue = [];
      this.isProcessing = false;
      this.displayDurationMs = 3000; // 3 seconds screen time per alert
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

      // Unlock AudioContext on load and on any user gesture
      const unlockAudio = () => {
        this.audio.init();
      };
      window.addEventListener('click', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
      window.addEventListener('pointerdown', unlockAudio);
      window.addEventListener('focus', unlockAudio);
      // Tenta desbloquear logo no carregamento
      setTimeout(() => { this.audio.init(); }, 300);
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

      const userKey = (alertData.user || '').toLowerCase().trim();
      let typeKey = (alertData.type || '').toLowerCase().trim();
      if (typeKey === 'follow') typeKey = 'follower';
      if (typeKey === 'resub') typeKey = 'sub';
      if (typeKey === 'pix' || typeKey === 'donate') typeKey = 'donation';
      if (typeKey === 'cheer') typeKey = 'bits';
      if (typeKey === 'host') typeKey = 'raid';

      // Chaves de desduplicação robustas (Universal: tipo + usuário, e ID explícito)
      const userTypeKey = userKey ? `${typeKey}::${userKey}` : null;
      const explicitId = alertData.id ? String(alertData.id).toLowerCase().trim() : null;

      // 1. Verificação de duplicata por ID explícito ou por Usuário+Tipo nos últimos 15 segundos
      if (explicitId && this.recentAlertIds.has(explicitId)) {
        console.log(`[Alerts] Descartando alerta duplicado por ID: ${explicitId}`);
        return;
      }
      if (userTypeKey && this.recentAlertIds.has(userTypeKey)) {
        console.log(`[Alerts] Descartando alerta duplicado por Usuário+Tipo: ${userTypeKey}`);
        return;
      }

      // 2. Se for sub de presente (gift), bloqueia alerta falso de novo sub individual para o recebedor
      const recipientKey = alertData.recipient ? String(alertData.recipient).toLowerCase().trim() : null;
      if (alertData.isGift && recipientKey) {
        this.recentAlertIds.add(`sub::${recipientKey}`);
        setTimeout(() => this.recentAlertIds.delete(`sub::${recipientKey}`), 25000);
      }

      // Registra chaves no conjunto de supressão temporária (15 segundos)
      if (explicitId) {
        this.recentAlertIds.add(explicitId);
        setTimeout(() => this.recentAlertIds.delete(explicitId), 15000);
      }
      if (userTypeKey) {
        this.recentAlertIds.add(userTypeKey);
        setTimeout(() => this.recentAlertIds.delete(userTypeKey), 15000);
      }

      this.queue.push(alertData);

      // Sincroniza letreiros nas outras cenas abertas no OBS (apenas se NÃO for teste sintético)
      const isTestAlert = alertData.isTest || 
        String(alertData.id || '').startsWith('test_') || 
        String(alertData.id || '').startsWith('key_test_') || 
        String(alertData.id || '').startsWith('url_test_') || 
        (alertData.user || '').toLowerCase() === 'marcel_gamer';

      if (!isTestAlert) {
        try {
          const type = (alertData.type || '').toLowerCase();
          if ((type === 'follower' || type === 'follow') && alertData.user) {
            localStorage.setItem('dec4land_real_follower', alertData.user);
            if (this.broadcastChannel) this.broadcastChannel.postMessage({ action: 'update_hud_info', follower: alertData.user });
          } else if ((type === 'sub' || type === 'resub') && alertData.user) {
            const subText = alertData.isGift ? `${alertData.user} (Gift)` : alertData.user;
            localStorage.setItem('dec4land_real_sub', subText);
            if (this.broadcastChannel) this.broadcastChannel.postMessage({ action: 'update_hud_info', sub: subText });
          } else if ((type === 'donation' || type === 'donate' || type === 'pix') && alertData.user) {
            const amt = alertData.amount ? `${alertData.user} (${alertData.amount})` : alertData.user;
            localStorage.setItem('dec4land_real_donate', amt);
            if (this.broadcastChannel) this.broadcastChannel.postMessage({ action: 'update_hud_info', donate: amt });
          }
        } catch(e) {}
      }

      this.processQueue();
    }

    async processQueue() {
      // Atomic mutex guard: guarantees alerts are processed strictly one by one
      if (this.isProcessing) return;
      this.isProcessing = true;

      while (this.queue.length > 0) {
        const data = this.queue.shift();
        try {
          await this.renderAlertLifecycle(data);
        } catch (err) {
          console.error('[Alerts] Error during alert lifecycle:', err);
        }
      }

      this.isProcessing = false;
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

    renderAlertLifecycle(data) {
      return new Promise((resolve) => {
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
          badgeText = alertData.isGift ? '🎁 PRESENTE DE SUB' : '💎 NOVO SUB';
          defaultDetail = alertData.isGift ? 'presenteou um Sub!' : (rawDetail ? this.escapeHtml(rawDetail) : 'acabou de se inscrever no canal!');
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
            <img src="assets/mascot.webp" alt="DEC4LAND Mascote" class="alert-mascot-img">
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

        let isDone = false;
        let removeTimer = null;
        let dismissTimer = null;

        const cleanupAndResolve = () => {
          if (isDone) return;
          isDone = true;

          alertBox.removeEventListener('transitionend', onTransitionEnd);
          if (removeTimer) clearTimeout(removeTimer);
          if (dismissTimer) clearTimeout(dismissTimer);

          if (alertBox.parentElement) {
            alertBox.remove();
          }

          // Rhythmic pause between consecutive alerts (350ms)
          setTimeout(() => {
            resolve();
          }, 350);
        };

        const onTransitionEnd = (e) => {
          if (e.target === alertBox) {
            cleanupAndResolve();
          }
        };

        // Screen display time: precisely 3.0 seconds (user configured)
        dismissTimer = setTimeout(() => {
          alertBox.classList.remove('active');
          alertBox.classList.add('leaving');

          alertBox.addEventListener('transitionend', onTransitionEnd);
          // Safeguard fallback timer in case OBS CEF suppresses transitionend
          removeTimer = setTimeout(cleanupAndResolve, 600);
        }, this.displayDurationMs);
      });
    }
  }

  // Instantiate singleton
  const manager = new AlertManager();

  // Global helper to trigger alert locally or broadcast
  window.triggerTwitchAlert = function(alertData, broadcast = false) {
    manager.enqueue(alertData);
    // alerts.html já é o renderizador de tela final. Não retransmite para evitar loops de eco.
    const path = (window.location.pathname || '').toLowerCase();
    const isAlertsPage = path.includes('alerts.html');
    if (broadcast && !isAlertsPage && manager.broadcastChannel) {
      try {
        manager.broadcastChannel.postMessage({
          action: 'trigger_alert',
          payload: alertData
        });
      } catch (e) {}
    }
  };

  window.dec4landAlertManager = manager;

  // Universal Twitch IRC listener using shared TwitchIrcClient
  setTimeout(() => {
    if (window._dec4landTwitchIrcConnected) return;
    window._dec4landTwitchIrcConnected = true;

    const urlParams = new URLSearchParams(window.location.search);
    const channel = (urlParams.get('channel') || localStorage.getItem('dec4land_twitch_channel') || 'dec4land').toLowerCase().replace('#', '');

    if (window.TwitchIrcClient) {
      const irc = new window.TwitchIrcClient({
        channel: channel,
        onNotice: (notice) => {
          if (notice.msgId === 'sub' || notice.msgId === 'resub') {
            window.triggerTwitchAlert({
              type: 'sub',
              user: notice.user,
              detail: `assinou o canal! (${notice.months} meses)`,
              message: notice.message
            });
          } else if (notice.msgId === 'subgift' || notice.msgId === 'anonsubgift') {
            const recipient = notice.recipient && notice.recipient !== 'um espectador' ? notice.recipient : '';
            window.triggerTwitchAlert({
              type: 'sub',
              user: notice.user,
              recipient: recipient,
              detail: recipient ? `presenteou um Sub para ${recipient}!` : `presenteou um Sub!`,
              isGift: true
            });
          } else if (notice.msgId === 'submysterygift') {
            const count = notice.tags?.['msg-param-mass-gift-count'] || 'vários';
            window.triggerTwitchAlert({
              type: 'sub',
              user: notice.user,
              detail: `presenteou ${count} Subs para a comunidade!`,
              isGift: true
            });
          } else if (notice.msgId === 'raid') {
            window.triggerTwitchAlert({
              type: 'raid',
              user: notice.user,
              amount: notice.viewers,
              detail: `chegou com ${notice.viewers} espectadores!`
            });
          }
        },
        onMessage: (msg) => {
          if (msg.bits) {
            window.triggerTwitchAlert({
              type: 'bits',
              user: msg.displayName || msg.username,
              amount: msg.bits,
              message: msg.message
            });
          }
        }
      });
      irc.connect();
    }
  }, 600);
})(window);
