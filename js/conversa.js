// DEC4LAND Conversa (Just Chatting) Controller
// Real-time Twitch Chat IRC WebSocket, Badges, Emotes, Events & Camera Helper
(function() {
  const urlParams = new URLSearchParams(window.location.search);

  // Config parameters
  const channelParam = urlParams.get('channel') || localStorage.getItem('dec4land_twitch_channel') || 'dec4land';
  const twitchChannel = channelParam.toLowerCase().replace(/^@|^#/, '');
  const streamerName = urlParams.get('name') || localStorage.getItem('dec4land_streamer_name') || 'DEC4LAND';
  const socialHandle = urlParams.get('social') || localStorage.getItem('dec4land_social_handle') || '@DEC4LANDOFICIAL';
  const allowMock = urlParams.get('mock') === 'true';

  // Apply names & branding
  const nameEl = document.getElementById('streamer-display-name');
  if (nameEl) nameEl.textContent = streamerName;

  const socialEls = document.querySelectorAll('.hud-social-item');
  if (socialEls.length > 0 && socialHandle) {
    socialEls[0].innerHTML = `<span class="social-icon">𝕏</span> ${socialHandle}`;
  }

  const channelBadgeEl = document.getElementById('chat-channel-badge');
  if (channelBadgeEl) channelBadgeEl.textContent = `#${twitchChannel}`;

  // ==========================================================================
  // EVENT PILLS (Follower, Donate, Sub)
  // ==========================================================================
  const followerEl = document.getElementById('pill-val-follower');
  const donateEl = document.getElementById('pill-val-donate');
  const subEl = document.getElementById('pill-val-sub');

  const realFollower = urlParams.get('follow') || localStorage.getItem('dec4land_real_follower') || 'andre_pro';
  const realDonate = urlParams.get('donate') || localStorage.getItem('dec4land_real_donate') || 'Lucas (R$ 25,00)';
  const realSub = urlParams.get('sub') || localStorage.getItem('dec4land_real_sub') || 'Bia (3m)';

  if (followerEl) followerEl.textContent = realFollower;
  if (donateEl) donateEl.textContent = realDonate;
  if (subEl) subEl.textContent = realSub;

  function updatePill(el, val) {
    if (!el || !val) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    setTimeout(() => {
      el.textContent = val;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 200);
  }

  window.updateFollower = function(name) {
    if (!name) return;
    try { localStorage.setItem('dec4land_real_follower', name); } catch(e) {}
    updatePill(followerEl, name);
  };

  window.updateDonate = function(name, amount) {
    if (!name) return;
    const text = amount ? `${name} (${amount})` : name;
    try { localStorage.setItem('dec4land_real_donate', text); } catch(e) {}
    updatePill(donateEl, text);
  };

  window.updateSub = function(name, months) {
    if (!name) return;
    const text = months ? `${name} (${months}m)` : name;
    try { localStorage.setItem('dec4land_real_sub', text); } catch(e) {}
    updatePill(subEl, text);
  };

  // Goal config
  const goalTitle = urlParams.get('goal_title') || 'META DE SEGUIDORES';
  const goalCurrent = parseInt(urlParams.get('current') || '340', 10);
  const goalTarget = parseInt(urlParams.get('goal') || '500', 10);

  const goalTitleEl = document.getElementById('goal-title-text');
  const goalCountEl = document.getElementById('goal-count-text');
  const goalBarEl = document.getElementById('goal-progress-bar');

  if (goalTitleEl) goalTitleEl.textContent = goalTitle;
  if (goalCountEl) goalCountEl.textContent = `${goalCurrent} / ${goalTarget}`;
  if (goalBarEl) {
    const pct = Math.min(100, Math.round((goalCurrent / goalTarget) * 100));
    goalBarEl.style.width = `${pct}%`;
  }

  // Cross-scene sync via BroadcastChannel & storage
  let alertBroadcast = null;
  try {
    if ('BroadcastChannel' in window) {
      alertBroadcast = new BroadcastChannel('dec4land_stream_alerts');
      alertBroadcast.onmessage = function(e) {
        if (!e.data) return;
        if (e.data.action === 'trigger_alert' && e.data.payload) {
          const p = e.data.payload;
          const type = (p.type || '').toLowerCase();
          if (type === 'follow' || type === 'follower') window.updateFollower(p.user);
          else if (type === 'donate' || type === 'pix') window.updateDonate(p.user, p.amount || 'R$ 10,00');
          else if (type === 'sub' || type === 'resub') window.updateSub(p.user, p.months);
          else if (type === 'bits' || type === 'cheer') window.updateDonate(p.user, `${p.amount || 100} bits`);

          // Trigger screen alert if alerts engine is loaded
          if (window.triggerTwitchAlert) {
            window.triggerTwitchAlert(p);
          }
        } else if (e.data.action === 'update_hud_info') {
          if (e.data.follower) window.updateFollower(e.data.follower);
          if (e.data.donate) window.updateDonate(e.data.donate);
          if (e.data.sub) window.updateSub(e.data.sub);
        }
      };
    }
  } catch(e) {}

  window.addEventListener('storage', (e) => {
    if (e.key === 'dec4land_real_follower' && e.newValue) updatePill(followerEl, e.newValue);
    if (e.key === 'dec4land_real_donate' && e.newValue) updatePill(donateEl, e.newValue);
    if (e.key === 'dec4land_real_sub' && e.newValue) updatePill(subEl, e.newValue);
  });

  // ==========================================================================
  // TWITCH CHAT ENGINE (WebSocket IRC)
  // ==========================================================================
  const chatViewport = document.getElementById('chat-messages-viewport');
  const chatStatusText = document.getElementById('chat-status-text');
  const MAX_MESSAGES = 50;

  function parseIrcTags(rawTags) {
    const tags = {};
    if (!rawTags) return tags;
    rawTags.split(';').forEach(tag => {
      const eq = tag.indexOf('=');
      if (eq !== -1) tags[tag.substring(0, eq)] = tag.substring(eq + 1);
    });
    return tags;
  }

  // Parse Twitch Emotes in text
  function formatEmotes(text, emotesTag) {
    if (!emotesTag) return escapeHtml(text);

    // Emotes format: emoteId:start-end,start-end/emoteId2:start-end
    const replacements = [];
    const emoteParts = emotesTag.split('/');
    emoteParts.forEach(part => {
      const [id, positions] = part.split(':');
      if (!positions) return;
      positions.split(',').forEach(pos => {
        const [start, end] = pos.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          replacements.push({ id, start, end });
        }
      });
    });

    replacements.sort((a, b) => b.start - a.start);

    let html = text;
    replacements.forEach(r => {
      const before = html.substring(0, r.start);
      const after = html.substring(r.end + 1);
      const emoteImg = `<img class="twitch-emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/2.0" alt="emote">`;
      html = before + emoteImg + after;
    });

    return html;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Add message to chat box
  window.addChatMessage = function(options) {
    if (!chatViewport) return;

    const {
      user = 'Viewer',
      color = '',
      badges = [],
      message = '',
      emotes = '',
      highlight = '', // 'broadcaster', 'sub', 'bits'
      time = null
    } = options;

    const now = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg-item';
    if (highlight) msgEl.classList.add(`msg-highlight-${highlight}`);

    // Badges HTML
    let badgesHtml = '';
    badges.forEach(b => {
      const bKey = b.toLowerCase();
      if (bKey.includes('broadcaster')) {
        badgesHtml += '<span class="chat-badge badge-broadcaster">STREAMER</span>';
      } else if (bKey.includes('moderator')) {
        badgesHtml += '<span class="chat-badge badge-mod">MOD</span>';
      } else if (bKey.includes('vip')) {
        badgesHtml += '<span class="chat-badge badge-vip">VIP</span>';
      } else if (bKey.includes('subscriber')) {
        badgesHtml += '<span class="chat-badge badge-sub">SUB</span>';
      } else if (bKey.includes('prime')) {
        badgesHtml += '<span class="chat-badge badge-prime">PRIME</span>';
      }
    });

    const userColor = color || '#ff5c82';
    const bodyHtml = formatEmotes(message, emotes);

    msgEl.innerHTML = `
      <div class="msg-header">
        ${badgesHtml}
        <span class="msg-author" style="color: ${userColor};">${escapeHtml(user)}:</span>
        <span class="msg-time">${now}</span>
      </div>
      <div class="msg-body">${bodyHtml}</div>
    `;

    chatViewport.appendChild(msgEl);

    // Prune old messages
    while (chatViewport.children.length > MAX_MESSAGES) {
      chatViewport.removeChild(chatViewport.firstChild);
    }

    // Smooth scroll down
    chatViewport.scrollTop = chatViewport.scrollHeight;
  };

  // Connect to Twitch Chat IRC
  let twitchSocket = null;
  function connectTwitchChat() {
    try {
      if (chatStatusText) chatStatusText.textContent = 'CONECTANDO...';
      twitchSocket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

      twitchSocket.onopen = function() {
        twitchSocket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        twitchSocket.send('PASS SCHMOOPIIE');
        twitchSocket.send('NICK justinfan' + Math.floor(Math.random() * 80000 + 10000));
        twitchSocket.send('JOIN #' + twitchChannel);

        if (chatStatusText) {
          chatStatusText.textContent = `AO VIVO (#${twitchChannel})`;
        }
      };

      twitchSocket.onmessage = function(e) {
        const lines = e.data.split('\r\n');
        lines.forEach(line => {
          if (line.startsWith('PING')) {
            twitchSocket.send('PONG :tmi.twitch.tv');
            return;
          }

          // Handle PRIVMSG (Live chat message)
          if (line.includes(' PRIVMSG ')) {
            let tags = {};
            let rest = line;
            if (line.startsWith('@')) {
              const sp = line.indexOf(' ');
              tags = parseIrcTags(line.substring(1, sp));
              rest = line.substring(sp + 1);
            }

            const colonIdx = rest.indexOf(' :');
            const messageText = colonIdx !== -1 ? rest.substring(colonIdx + 2) : '';
            const user = tags['display-name'] || tags['login'] || 'Viewer';
            const color = tags['color'] || '';
            const rawBadges = (tags['badges'] || '').split(',');
            const emotesTag = tags['emotes'] || '';

            let highlight = '';
            if (rawBadges.some(b => b.startsWith('broadcaster'))) highlight = 'broadcaster';
            else if (tags['bits']) highlight = 'bits';
            else if (rawBadges.some(b => b.startsWith('subscriber'))) highlight = 'sub';

            window.addChatMessage({
              user,
              color,
              badges: rawBadges,
              message: messageText,
              emotes: emotesTag,
              highlight
            });
          }

          // Handle USERNOTICE (Subscriptions / Raids)
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
              window.addChatMessage({
                user: 'DEC4LAND SYSTEM',
                color: '#ffb800',
                badges: ['subscriber'],
                message: `🎉 ${user} acabou de assinar o canal (${months} meses)! Bem-vindo(a) ao clube!`,
                highlight: 'sub'
              });
            } else if (msgId === 'raid') {
              const viewers = tags['msg-param-viewerCount'] || '10';
              window.addChatMessage({
                user: 'DEC4LAND SYSTEM',
                color: '#00d2ff',
                badges: ['broadcaster'],
                message: `🚀 RAID INCOMING! ${user} chegou com ${viewers} espectadores!`,
                highlight: 'broadcaster'
              });
            }
          }
        });
      };

      twitchSocket.onerror = function() {
        if (chatStatusText) chatStatusText.textContent = 'ERRO DE CONEXÃO';
      };

      twitchSocket.onclose = function() {
        if (chatStatusText) chatStatusText.textContent = 'RECONECTANDO...';
        setTimeout(connectTwitchChat, 7000);
      };

    } catch (err) {
      console.warn('[Twitch Chat] Socket error:', err);
    }
  }

  connectTwitchChat();

  // ==========================================================================
  // SIMULATOR / MOCK CHAT MESSAGES
  // ==========================================================================
  const sampleChatters = [
    { name: 'pedro_gamer', color: '#00d2ff', badges: ['subscriber'], msg: 'Boa tarde rapaziada! Live tá braba hoje 🔥' },
    { name: 'bia_souza', color: '#ff70a6', badges: ['vip', 'subscriber'], msg: 'Cheguei a tempo do bate-papo! E aí Marcel?' },
    { name: 'lucas_fps', color: '#ffb800', badges: ['moderator'], msg: 'Chat na moral hoje hein tropa, sem spam!' },
    { name: 'carlos_pro', color: '#70d6ff', badges: ['subscriber'], msg: 'Essa cena de conversa ficou absurda demais 👏' },
    { name: 'vanessa_stream', color: '#e0aaff', badges: ['subscriber'], msg: 'Salve salve! Bora que hoje promete!' },
    { name: 'thiago_tech', color: '#00ff7f', badges: [], msg: 'Qual vai ser o jogo de hoje depois da resenha?' },
    { name: 'gabriel_99', color: '#ff9e00', badges: ['subscriber'], msg: 'Alô alô Dec4land! Melhor live da Twitch 🚀' },
    { name: 'marina_rj', color: '#f72585', badges: ['vip'], msg: 'Cadê o mascote bombado na tela? kkkk' }
  ];

  let sampleIndex = 0;
  window.simulateChatMessage = function() {
    const s = sampleChatters[sampleIndex % sampleChatters.length];
    sampleIndex++;
    window.addChatMessage({
      user: s.name,
      color: s.color,
      badges: s.badges,
      message: s.msg,
      highlight: s.badges.includes('subscriber') ? 'sub' : ''
    });
  };

  // Initial welcome message
  setTimeout(() => {
    window.addChatMessage({
      user: 'DEC4LAND BOT',
      color: '#ff1a4b',
      badges: ['broadcaster'],
      message: `Bem-vindo(a) à cena de conversa! Conectado ao canal #${twitchChannel}. Interaja pelo chat da Twitch!`,
      highlight: 'broadcaster'
    });
    // Add 2 initial friendly mock messages for immediate nice preview
    setTimeout(window.simulateChatMessage, 800);
    setTimeout(window.simulateChatMessage, 1600);
  }, 500);

  // If mock mode is active, simulate continuous chat
  if (allowMock) {
    setInterval(() => {
      window.simulateChatMessage();
    }, 6500);
  }

  // ==========================================================================
  // IN-BROWSER WEBCAM TEST HELPER (TEST WEBCAM DIRECTLY IN BROWSER)
  // ==========================================================================
  let localMediaStream = null;
  const videoEl = document.getElementById('browser-cam-video');
  const guideBox = document.getElementById('obs-camera-guide');

  window.toggleWebcamPreview = async function() {
    if (localMediaStream) {
      // Turn off
      localMediaStream.getTracks().forEach(t => t.stop());
      localMediaStream = null;
      if (videoEl) videoEl.style.display = 'none';
      if (guideBox) guideBox.style.display = 'flex';
      const btn = document.getElementById('btn-toggle-cam');
      if (btn) btn.textContent = 'Ligar Câmera para Teste';
    } else {
      // Turn on
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        localMediaStream = stream;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.play();
          videoEl.style.display = 'block';
        }
        if (guideBox) guideBox.style.display = 'none';
        const btn = document.getElementById('btn-toggle-cam');
        if (btn) btn.textContent = 'Desligar Câmera de Teste';
      } catch (err) {
        alert('Não foi possível acessar a webcam no navegador. Certifique-se de permitir o acesso nas permissões do navegador.\n\nNo OBS Studio, lembre-se que a sua câmera é adicionada normalmente como uma fonte de Dispositivo de Captura de Vídeo atrás desta moldura!');
      }
    }
  };

  // Keyboard shortcut: 'C' to simulate chat message, 'V' to toggle webcam
  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      window.simulateChatMessage();
    } else if (e.key === 'v' || e.key === 'V') {
      window.toggleWebcamPreview();
    }
  });

})();
