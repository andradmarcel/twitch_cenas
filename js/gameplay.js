// DEC4LAND Gameplay Overlay Controller - Dynamic Webcam HUD & Real Twitch Events
(function() {
  const urlParams = new URLSearchParams(window.location.search);

  // Position modifier (?pos=top-left | top-right | bottom-left | bottom-right)
  const pos = urlParams.get('pos') || 'top-left';
  const webcamModule = document.getElementById('webcam-module');
  if (webcamModule) {
    webcamModule.classList.remove('pos-top-left', 'pos-top-right', 'pos-bottom-left', 'pos-bottom-right');
    webcamModule.classList.add(`pos-${pos}`);
  }

  const cfg = window.DEC4LAND_CONFIG || {};

  // Custom streamer name
  const customName = urlParams.get('name') || cfg.streamerName || localStorage.getItem('dec4land_streamer_name');
  if (customName) {
    const streamerNameEl = document.querySelector('.streamer-name-animated');
    if (streamerNameEl) streamerNameEl.textContent = customName;
  }

  // Custom social handle
  const customSocial = urlParams.get('social') || cfg.socialTwitter || localStorage.getItem('dec4land_social_handle');
  if (customSocial) {
    const socialEl = document.querySelector('.brand-social-pill');
    if (socialEl) socialEl.textContent = customSocial;
  }

  // Elements
  const followerEl = document.getElementById('latest-follower');
  const donateEl = document.getElementById('latest-donate');
  const subEl = document.getElementById('latest-sub');

  const pillFollower = document.getElementById('pill-follower');
  const pillDonate = document.getElementById('pill-donate');
  const pillSub = document.getElementById('pill-sub');

  // Load real values: Priority 1) URL Params, 2) localStorage, 3) Config file
  let realFollower = urlParams.get('follow') || localStorage.getItem('dec4land_real_follower') || cfg.latestFollower || '';
  let realDonate = urlParams.get('donate') || localStorage.getItem('dec4land_real_donate') || cfg.latestDonate || '-';
  let realSub = urlParams.get('sub') || localStorage.getItem('dec4land_real_sub') || cfg.latestSub || '';

  // Limpa automaticamente qualquer resquício de teste sintético 'Marcel_Gamer' ou 'Marcel (R$ 50,00)'
  if (realSub && (realSub.toLowerCase().includes('marcel_gamer') || realSub.toLowerCase() === 'marcel')) {
    realSub = (cfg.latestSub && !cfg.latestSub.toLowerCase().includes('marcel')) ? cfg.latestSub : '';
    try { localStorage.removeItem('dec4land_real_sub'); } catch(e) {}
  }
  if (realDonate && (realDonate.toLowerCase().includes('marcel') || realDonate.includes('50,00'))) {
    realDonate = (cfg.latestDonate && !cfg.latestDonate.toLowerCase().includes('marcel')) ? cfg.latestDonate : '-';
    try { localStorage.removeItem('dec4land_real_donate'); } catch(e) {}
  }
  if (realFollower && (realFollower.toLowerCase().includes('marcel_gamer') || realFollower.toLowerCase() === 'marcel')) {
    realFollower = (cfg.latestFollower && !cfg.latestFollower.toLowerCase().includes('marcel')) ? cfg.latestFollower : '';
    try { localStorage.removeItem('dec4land_real_follower'); } catch(e) {}
  }

  if (realFollower && followerEl) followerEl.textContent = realFollower;
  if (donateEl) donateEl.textContent = realDonate || '-';
  if (realSub && subEl) subEl.textContent = realSub;

  // Helper to animate pill value update
  function animateValueChange(el, pillEl, newVal) {
    if (!el || !newVal) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    setTimeout(() => {
      el.textContent = newVal;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      if (pillEl) {
        pillEl.classList.remove('pill-updated');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            pillEl.classList.add('pill-updated');
          });
        });
      }
    }, 250);
  }

  window.updateFollower = function(name) {
    if (!name) return;
    try { localStorage.setItem('dec4land_real_follower', name); } catch(e) {}
    animateValueChange(followerEl, pillFollower, name);
  };

  window.updateDonate = function(name, amount) {
    if (!name) return;
    let text = name;
    if (amount) {
      const formattedAmount = String(amount).trim();
      text = `${name} (${formattedAmount})`;
    }
    try { localStorage.setItem('dec4land_real_donate', text); } catch(e) {}
    animateValueChange(donateEl, pillDonate, text);
  };

  window.updateSub = function(name, months) {
    if (!name) return;
    const text = months ? `${name} (${months}m)` : name;
    try { localStorage.setItem('dec4land_real_sub', text); } catch(e) {}
    animateValueChange(subEl, pillSub, text);
  };

  // Update HUD event pills from alert events & delegate to visual/audio alert manager
  const _existingAlertTrigger = window.triggerTwitchAlert;
  window.triggerTwitchAlert = function(data, broadcast = true) {
    if (!data) return;

    // Normalizing event types (follower/follow, donation/donate/pix, sub/resub, bits/cheer)
    const type = (data.type || '').toLowerCase();
    const user = data.user || 'Viewer';

    if (type === 'follow' || type === 'follower') {
      window.updateFollower(user);
    } else if (type === 'donate' || type === 'donation' || type === 'pix') {
      const amt = data.amount ? (String(data.amount).includes('R$') ? data.amount : `R$ ${data.amount}`) : 'R$ 10,00';
      window.updateDonate(user, amt);
    } else if (type === 'sub' || type === 'resub') {
      window.updateSub(user, data.months || null);
    } else if (type === 'bits' || type === 'cheer') {
      window.updateDonate(user, `${data.amount || '100'} bits`);
    }

    // Na cena de gameplay, os alertas são passivos: apenas atualizam a moldura.
    // O alerta visual e sonoro é delegado para a fonte dedicada alerts.html via BroadcastChannel
    if (broadcast && streamAlertBroadcast) {
      try {
        streamAlertBroadcast.postMessage({
          action: 'trigger_alert',
          payload: data
        });
      } catch (e) {}
    }
  };

  // Broadcast channel for sync between index.html, alerts.html, and gameplay.html
  let streamAlertBroadcast = null;
  try {
    if ('BroadcastChannel' in window) {
      streamAlertBroadcast = new BroadcastChannel('dec4land_stream_alerts');
      streamAlertBroadcast.onmessage = function(e) {
        if (!e.data) return;
        if (e.data.action === 'trigger_alert' && e.data.payload) {
          window.triggerTwitchAlert(e.data.payload, false);
        } else if (e.data.action === 'update_hud_info') {
          if (e.data.follower) window.updateFollower(e.data.follower);
          if (e.data.donate) window.updateDonate(e.data.donate);
          if (e.data.sub) window.updateSub(e.data.sub);
        }
      };
    }
  } catch (err) {}

  // Storage listener for cross-window real-time synchronization
  window.addEventListener('storage', function(e) {
    if (e.key === 'dec4land_real_follower' && e.newValue) {
      animateValueChange(followerEl, pillFollower, e.newValue);
    } else if (e.key === 'dec4land_real_donate' && e.newValue) {
      animateValueChange(donateEl, pillDonate, e.newValue);
    } else if (e.key === 'dec4land_real_sub' && e.newValue) {
      animateValueChange(subEl, pillSub, e.newValue);
    }
  });

  // Also listen to postMessage
  window.addEventListener('message', function(e) {
    if (e.data && e.data.action === 'trigger_alert' && e.data.payload) {
      window.triggerTwitchAlert(e.data.payload, false);
    } else if (e.data && e.data.action === 'update_hud_info') {
      if (e.data.follower) window.updateFollower(e.data.follower);
      if (e.data.donate) window.updateDonate(e.data.donate);
      if (e.data.sub) window.updateSub(e.data.sub);
    }
  });

  function broadcastAlert(alertData) {
    if (streamAlertBroadcast) {
      try {
        streamAlertBroadcast.postMessage({
          action: 'trigger_alert',
          payload: alertData
        });
      } catch (e) {}
    }
  }

  // FAKE MOCK ROTATION: ONLY active if ?mock=true is explicitly requested
  const allowMock = urlParams.get('mock') === 'true';

  if (allowMock) {
    const sampleFollowers = ['pedro_streamer', 'bia_rodrigues', 'carlos_kill', 'thiago_fps', 'vanessa_games'];
    const sampleDonates = [
      { name: 'lucas_r', amount: 'R$ 25,00' },
      { name: 'gamer_br', amount: 'R$ 50,00' },
      { name: 'felipe_99', amount: 'R$ 10,00' },
      { name: 'rafael', amount: 'R$ 100,00' }
    ];
    const sampleSubs = [
      { name: 'marina_games', months: null },
      { name: 'lucas_prime', months: '3' },
      { name: 'andre_pro', months: '6' },
      { name: 'juliana_sub', months: null }
    ];

    let fIdx = 0, dIdx = 0, sIdx = 0;

    setInterval(() => {
      fIdx = (fIdx + 1) % sampleFollowers.length;
      animateValueChange(followerEl, pillFollower, sampleFollowers[fIdx]);
    }, 14000);

    setTimeout(() => {
      setInterval(() => {
        dIdx = (dIdx + 1) % sampleDonates.length;
        animateValueChange(donateEl, pillDonate, `${sampleDonates[dIdx].name} (${sampleDonates[dIdx].amount})`);
      }, 18000);
    }, 5000);

    setTimeout(() => {
      setInterval(() => {
        sIdx = (sIdx + 1) % sampleSubs.length;
        const sText = sampleSubs[sIdx].months ? `${sampleSubs[sIdx].name} (${sampleSubs[sIdx].months}m)` : sampleSubs[sIdx].name;
        animateValueChange(subEl, pillSub, sText);
      }, 16000);
    }, 9000);
  }

  const twitchChannel = (urlParams.get('channel') || cfg.twitchChannel || localStorage.getItem('dec4land_twitch_channel') || 'dec4land').toLowerCase().replace(/^@|^#/, '');

  // Conexão Twitch IRC via Shared TwitchIrcClient para captura de Subs, Raids e Bits
  let twitchIrc = null;
  function connectTwitch() {
    if (!window.TwitchIrcClient) {
      console.warn('[Gameplay] TwitchIrcClient não encontrado.');
      return;
    }

    twitchIrc = new window.TwitchIrcClient({
      channel: twitchChannel,
      onNotice: (notice) => {
        if (notice.msgId === 'sub' || notice.msgId === 'resub') {
          const monthsNum = parseInt(notice.months, 10) || 1;
          const detailText = monthsNum > 1
            ? `renovou a inscrição (${monthsNum} meses)!`
            : 'acabou de se inscrever no canal!';
          window.updateSub(notice.user, monthsNum > 1 ? monthsNum : null);
          broadcastAlert({
            type: 'sub',
            user: notice.user,
            months: notice.months,
            detail: detailText
          });
        } else if (notice.msgId === 'subgift' || notice.msgId === 'anonsubgift') {
          broadcastAlert({
            type: 'sub',
            user: notice.user,
            detail: `presenteou um Sub para ${notice.recipient}!`
          });
        } else if (notice.msgId === 'raid') {
          broadcastAlert({
            type: 'raid',
            user: notice.user,
            amount: notice.viewers,
            detail: `chegou com ${notice.viewers} espectadores!`
          });
        }
      },
      onMessage: (msg) => {
        if (msg.bits) {
          window.updateDonate(msg.displayName || msg.username, `${msg.bits} bits`);
          broadcastAlert({
            type: 'bits',
            user: msg.displayName || msg.username,
            amount: msg.bits
          });
        }
      }
    });

    twitchIrc.connect();
  }

  connectTwitch();
})();
