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

  // Custom streamer name
  const customName = urlParams.get('name') || localStorage.getItem('dec4land_streamer_name');
  if (customName) {
    const streamerNameEl = document.querySelector('.streamer-name-animated');
    if (streamerNameEl) streamerNameEl.textContent = customName;
  }

  // Custom social handle
  const customSocial = urlParams.get('social') || localStorage.getItem('dec4land_social_handle');
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

  // Load real values: Priority 1) URL Params, 2) localStorage, 3) Default dash '-'
  const realFollower = urlParams.get('follow') || localStorage.getItem('dec4land_real_follower');
  const realDonate = urlParams.get('donate') || localStorage.getItem('dec4land_real_donate');
  const realSub = urlParams.get('sub') || localStorage.getItem('dec4land_real_sub');

  if (realFollower && followerEl) followerEl.textContent = realFollower;
  if (realDonate && donateEl) donateEl.textContent = realDonate;
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
        void pillEl.offsetWidth; // trigger reflow
        pillEl.classList.add('pill-updated');
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

  // Update HUD event pills from alert events
  window.triggerTwitchAlert = function(data) {
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
  };

  // Broadcast channel for sync between index.html, alerts.html, and gameplay.html
  let streamAlertBroadcast = null;
  try {
    if ('BroadcastChannel' in window) {
      streamAlertBroadcast = new BroadcastChannel('dec4land_stream_alerts');
      streamAlertBroadcast.onmessage = function(e) {
        if (!e.data) return;
        if (e.data.action === 'trigger_alert' && e.data.payload) {
          window.triggerTwitchAlert(e.data.payload);
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
      window.triggerTwitchAlert(e.data.payload);
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

  // Twitch Channel WebSocket IRC listener (anonymous read-only real live stream events)
  const twitchChannel = (urlParams.get('channel') || localStorage.getItem('dec4land_twitch_channel') || 'dec4land').toLowerCase().replace(/^@|^#/, '');

  function parseIrcTags(rawTags) {
    const tags = {};
    if (!rawTags) return tags;
    rawTags.split(';').forEach(tag => {
      const eq = tag.indexOf('=');
      if (eq !== -1) {
        tags[tag.substring(0, eq)] = tag.substring(eq + 1);
      }
    });
    return tags;
  }

  function connectTwitch() {
    try {
      const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      socket.onopen = function() {
        socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        socket.send('PASS SCHMOOPIIE');
        socket.send('NICK justinfan' + Math.floor(Math.random() * 80000 + 10000));
        socket.send('JOIN #' + twitchChannel);
      };

      socket.onmessage = function(e) {
        const lines = e.data.split('\r\n');
        lines.forEach(line => {
          if (line.startsWith('PING')) {
            socket.send('PONG :tmi.twitch.tv');
            return;
          }

          // Handle Twitch USERNOTICE (Real Sub, Resub, Subgift, Raid)
          if (line.includes(' USERNOTICE ')) {
            let tags = {};
            if (line.startsWith('@')) {
              const sp = line.indexOf(' ');
              tags = parseIrcTags(line.substring(1, sp));
            }

            const msgId = tags['msg-id'] || '';
            const user = tags['display-name'] || tags['login'] || 'Viewer';
            const months = tags['msg-param-cumulative-months'] || '1';

            if (msgId === 'sub' || msgId === 'resub') {
              window.updateSub(user, months);
              broadcastAlert({ 
                type: 'sub', 
                user: user, 
                months: months,
                detail: `assinou o canal (${months} meses)!` 
              });
            } else if (msgId === 'subgift' || msgId === 'anonsubgift') {
              const recipient = tags['msg-param-recipient-display-name'] || 'um espectador';
              broadcastAlert({
                type: 'sub',
                user: user,
                detail: `presenteou um Sub para ${recipient}!`
              });
            } else if (msgId === 'raid') {
              const viewers = tags['msg-param-viewerCount'] || '10';
              broadcastAlert({
                type: 'raid',
                user: user,
                amount: viewers,
                detail: `chegou com ${viewers} espectadores!`
              });
            }
          }

          // Handle Twitch bits / cheer via PRIVMSG
          if (line.includes(' PRIVMSG ') && line.includes('bits=')) {
            let tags = {};
            if (line.startsWith('@')) {
              const sp = line.indexOf(' ');
              tags = parseIrcTags(line.substring(1, sp));
            }
            if (tags['bits']) {
              const user = tags['display-name'] || tags['login'] || 'Viewer';
              const bits = tags['bits'];
              window.updateDonate(user, `${bits} bits`);
              broadcastAlert({
                type: 'bits',
                user: user,
                amount: bits
              });
            }
          }
        });
      };

      socket.onclose = function() {
        setTimeout(connectTwitch, 8000);
      };
    } catch (err) {
      console.warn('[Twitch] WebSocket error:', err);
    }
  }

  connectTwitch();
})();
