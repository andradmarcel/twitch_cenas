// DEC4LAND React & Apresentação Controller
// Sincroniza os 2 recortes transparentes (Captura de Janela + Câmera) e gerencia o Chat em tempo real
(function() {
  const urlParams = new URLSearchParams(window.location.search);

  // Configuration from URL > config.js > localStorage > fallback
  const cfg = window.DEC4LAND_CONFIG || {};
  const channelParam = urlParams.get('channel') || cfg.twitchChannel || localStorage.getItem('dec4land_twitch_channel') || 'dec4land';
  const twitchChannel = channelParam.toLowerCase().replace(/^@|^#/, '');
  const streamerName = urlParams.get('name') || cfg.streamerName || localStorage.getItem('dec4land_streamer_name') || 'DEC4LAND';
  const socialTwitter = urlParams.get('twitter') || cfg.socialTwitter || '@DEC4LANDOFICIAL';
  const socialInstagram = urlParams.get('instagram') || cfg.socialInstagram || '@ANDRADMARCEL';
  const socialYoutube = urlParams.get('youtube') || cfg.socialYoutube || '/DEC4LAND';
  const allowMock = urlParams.get('mock') === 'true';

  // Apply names & branding
  const nameEl = document.getElementById('streamer-display-name');
  if (nameEl) nameEl.textContent = streamerName;

  const twEl = document.getElementById('social-twitter');
  if (twEl) twEl.textContent = socialTwitter;
  const igEl = document.getElementById('social-instagram');
  if (igEl) igEl.textContent = socialInstagram;
  const ytEl = document.getElementById('social-youtube');
  if (ytEl) ytEl.textContent = socialYoutube;

  const channelBadgeEl = document.getElementById('chat-channel-badge');
  if (channelBadgeEl) channelBadgeEl.textContent = `#${twitchChannel.toUpperCase()}`;

  // ==========================================================================
  // DUAL 100% TRANSPARENT CUTOUT HOLES SYNCHRONIZATION (WINDOW & WEBCAM)
  // ==========================================================================
  function syncMaskHoles() {
    // 1. Recorte da Janela / Tela (Esquerda)
    const windowFrame = document.getElementById('screen-cutout-frame');
    const windowHole = document.getElementById('window-mask-hole');
    if (windowFrame && windowHole) {
      const r = windowFrame.getBoundingClientRect();
      windowHole.setAttribute('x', Math.round(r.left));
      windowHole.setAttribute('y', Math.round(r.top));
      windowHole.setAttribute('width', Math.round(r.width));
      windowHole.setAttribute('height', Math.round(r.height));
    }

    // 2. Recorte da Câmera do Streamer (Direita Superior)
    const webcamFrame = document.getElementById('webcam-cutout-frame');
    const webcamHole = document.getElementById('webcam-mask-hole');
    if (webcamFrame && webcamHole) {
      const r = webcamFrame.getBoundingClientRect();
      webcamHole.setAttribute('x', Math.round(r.left));
      webcamHole.setAttribute('y', Math.round(r.top));
      webcamHole.setAttribute('width', Math.round(r.width));
      webcamHole.setAttribute('height', Math.round(r.height));
    }
  }

  window.addEventListener('resize', syncMaskHoles);
  window.addEventListener('DOMContentLoaded', syncMaskHoles);
  window.addEventListener('load', syncMaskHoles);
  requestAnimationFrame(syncMaskHoles);
  setTimeout(syncMaskHoles, 150);
  setTimeout(syncMaskHoles, 600);

  // ==========================================================================
  // EVENT PILLS (Follower, Donate, Sub)
  // ==========================================================================
  const followerEl = document.getElementById('pill-val-follower');
  const donateEl = document.getElementById('pill-val-donate');
  const subEl = document.getElementById('pill-val-sub');

  let realFollower = urlParams.get('follow') || localStorage.getItem('dec4land_real_follower') || cfg.latestFollower || '-';
  let realDonate = urlParams.get('donate') || localStorage.getItem('dec4land_real_donate') || cfg.latestDonate || '-';
  let realSub = urlParams.get('sub') || localStorage.getItem('dec4land_real_sub') || cfg.latestSub || '-';

  // Limpa automaticamente qualquer resquício de teste sintético 'Marcel_Gamer' ou 'Marcel (R$ 50,00)'
  if (realSub && (realSub.toLowerCase().includes('marcel_gamer') || realSub.toLowerCase() === 'marcel')) {
    realSub = (cfg.latestSub && !cfg.latestSub.toLowerCase().includes('marcel')) ? cfg.latestSub : '-';
    try { localStorage.removeItem('dec4land_real_sub'); } catch(e) {}
  }
  if (realDonate && (realDonate.toLowerCase().includes('marcel') || realDonate.includes('50,00'))) {
    realDonate = (cfg.latestDonate && !cfg.latestDonate.toLowerCase().includes('marcel')) ? cfg.latestDonate : '-';
    try { localStorage.removeItem('dec4land_real_donate'); } catch(e) {}
  }
  if (realFollower && (realFollower.toLowerCase().includes('marcel_gamer') || realFollower.toLowerCase() === 'marcel')) {
    realFollower = (cfg.latestFollower && !cfg.latestFollower.toLowerCase().includes('marcel')) ? cfg.latestFollower : '-';
    try { localStorage.removeItem('dec4land_real_follower'); } catch(e) {}
  }

  if (followerEl) followerEl.textContent = realFollower;
  if (donateEl) donateEl.textContent = realDonate || '-';
  if (subEl) subEl.textContent = realSub;

  function updatePill(el, val) {
    if (!el || !val) return;
    el.style.transform = 'scale(1.25)';
    el.style.color = 'var(--neon-red-bright)';
    setTimeout(() => {
      el.textContent = val;
      el.style.transform = 'scale(1)';
      el.style.color = '#ffffff';
    }, 200);
  }

  window.updateFollower = function(name) {
    try { localStorage.setItem('dec4land_real_follower', name); } catch(e) {}
    updatePill(followerEl, name);
  };
  window.updateDonate = function(user, amount) {
    const text = amount ? `${user} (${amount})` : user;
    try { localStorage.setItem('dec4land_real_donate', text); } catch(e) {}
    updatePill(donateEl, text);
  };
  window.updateSub = function(name, months) {
    const text = months ? `${name} (${months}m)` : name;
    try { localStorage.setItem('dec4land_real_sub', text); } catch(e) {}
    updatePill(subEl, text);
  };

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
  // GOAL PROGRESS BAR WIDGET
  // ==========================================================================
  const goalTitleEl = document.getElementById('goal-title-text');
  const goalCountEl = document.getElementById('goal-count-text');
  const goalProgressEl = document.getElementById('goal-progress-bar');

  const goalTarget = parseInt(urlParams.get('goal') || '500', 10);
  let goalCurrent = parseInt(urlParams.get('current') || '340', 10);
  const goalTitle = urlParams.get('goal_title') || 'META DE SEGUIDORES';

  if (goalTitleEl) goalTitleEl.textContent = goalTitle;
  function refreshGoal() {
    if (goalCountEl) goalCountEl.textContent = `${goalCurrent} / ${goalTarget}`;
    if (goalProgressEl) {
      const pct = Math.min(100, Math.max(0, (goalCurrent / goalTarget) * 100));
      goalProgressEl.style.width = `${pct.toFixed(1)}%`;
    }
  }
  refreshGoal();

  // ==========================================================================
  // TWITCH LIVE CHAT IRC WEBSOCKET (NATIVE)
  // ==========================================================================
  const chatViewport = document.getElementById('chat-messages-viewport');
  const chatStatusText = document.getElementById('chat-status-text');
  const emptyNotice = document.getElementById('chat-empty-notice');

  function setChatStatus(status, text) {
    if (!chatStatusText) return;
    chatStatusText.textContent = text;
    const dot = document.querySelector('.chat-status-dot');
    if (dot) {
      if (status === 'connected') {
        dot.style.background = '#00ff7f';
        dot.style.boxShadow = '0 0 8px #00ff7f';
        chatStatusText.parentElement.style.borderColor = 'rgba(0, 255, 127, 0.4)';
        chatStatusText.parentElement.style.color = '#00ff7f';
      } else if (status === 'connecting') {
        dot.style.background = '#ffb800';
        dot.style.boxShadow = '0 0 8px #ffb800';
        chatStatusText.parentElement.style.borderColor = 'rgba(255, 184, 0, 0.4)';
        chatStatusText.parentElement.style.color = '#ffb800';
      } else {
        dot.style.background = '#ff1a4b';
        dot.style.boxShadow = '0 0 8px #ff1a4b';
        chatStatusText.parentElement.style.borderColor = 'rgba(255, 26, 75, 0.4)';
        chatStatusText.parentElement.style.color = '#ff1a4b';
      }
    }
  }

  function sanitize(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function appendChatMessage(data) {
    if (emptyNotice && emptyNotice.parentElement) {
      emptyNotice.remove();
    }

    const row = document.createElement('div');
    row.className = 'chat-msg-row';

    // Random or assigned vibrant user color
    const defaultColors = ['#ff527b', '#00e5ff', '#ffb800', '#a855f7', '#00ff7f', '#38bdf8', '#fb7185', '#f43f5e'];
    const userColor = data.color || defaultColors[Math.abs(data.username.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % defaultColors.length];

    // Build badges
    let badgesHtml = '';
    if (data.badges) {
      if (data.badges.broadcaster) badgesHtml += '<span class="chat-badge-icon chat-badge-broadcaster">STREAMER</span>';
      if (data.badges.moderator) badgesHtml += '<span class="chat-badge-icon chat-badge-mod">MOD</span>';
      if (data.badges.vip) badgesHtml += '<span class="chat-badge-icon chat-badge-vip">VIP</span>';
      if (data.badges.subscriber) badgesHtml += '<span class="chat-badge-icon chat-badge-sub">SUB</span>';
    }

    let parsedText = data.emotesHtml || sanitize(data.message);

    // Fallback de parsing de emotes se passado como objeto
    if (!data.emotesHtml && data.emotes && typeof data.emotes === 'object') {
      const replacements = [];
      Object.keys(data.emotes).forEach(id => {
        const ranges = data.emotes[id];
        ranges.forEach(range => {
          const [s, e] = range.split('-').map(Number);
          replacements.push({
            id,
            start: s,
            end: e,
            raw: data.message.substring(s, e + 1)
          });
        });
      });
      replacements.sort((a, b) => b.start - a.start);
      replacements.forEach(rep => {
        const imgTag = `<img src="https://static-cdn.jtvnw.net/emoticons/v2/${rep.id}/default/dark/1.0" alt="${sanitize(rep.raw)}" class="chat-emote-img" style="vertical-align: middle; height: 24px; margin: 0 2px;">`;
        parsedText = parsedText.substring(0, rep.start) + imgTag + parsedText.substring(rep.end + 1);
      });
    }

    row.innerHTML = `
      <div class="chat-msg-author">
        ${badgesHtml}
        <span class="chat-author-name" style="color: ${userColor};">${sanitize(data.displayName || data.username)}:</span>
      </div>
      <div class="chat-msg-text">${parsedText}</div>
    `;

    chatViewport.appendChild(row);

    // Keep DOM performant: limit to last 60 messages
    while (chatViewport.children.length > 60) {
      chatViewport.removeChild(chatViewport.firstChild);
    }

    // Smooth scroll to newest
    chatViewport.scrollTop = chatViewport.scrollHeight;
  }

  // Connect to Twitch Chat via Shared TwitchIrcClient
  let twitchIrc = null;
  function connectTwitchChat() {
    if (!window.TwitchIrcClient) {
      console.warn('[React Chat] TwitchIrcClient não encontrado.');
      return;
    }

    twitchIrc = new window.TwitchIrcClient({
      channel: twitchChannel,
      onStatusChange: (status, text) => {
        setChatStatus(status, text);
      },
      onMessage: (msg) => {
        appendChatMessage({
          username: msg.username,
          displayName: msg.displayName,
          message: msg.message,
          color: msg.color,
          badges: msg.badgesMap,
          emotesHtml: msg.emotesHtml
        });
      }
    });

    twitchIrc.connect();
  }

  // Simulator helper for testing chat in browser / OBS
  window.simulateChatMessage = function() {
    const mockUsers = [
      { name: 'Gaules_Fan', color: '#ff527b', badges: { subscriber: true }, msgs: ['Salve DEC4LAND!', 'Essa cena tá insana demais!', 'Olha a tela mano haha', 'Que setup monstro 🔥'] },
      { name: 'Fallen_CS', color: '#00ff7f', badges: { vip: true }, msgs: ['Boa live meu querido!', 'Aprovadíssimo esse overlay', 'Qual site você tá mostrando aí?', 'Bora pra cima!'] },
      { name: 'Mod_Gamer', color: '#00e5ff', badges: { moderator: true }, msgs: ['Lembrando da regra do chat pessoal!', 'Manda o link no chat aí streamer', 'React de respeito!'] },
      { name: 'Amahzy_Twitch', color: '#ff00ea', badges: { subscriber: true }, msgs: ['Kkkkkkk muito bom', 'Adorei a câmera aí no cantinho!', 'DEC4LAND voando 🚀'] },
      { name: 'Pedro_Viewer', color: '#ffb800', badges: {}, msgs: ['Cheguei agora rapaziada', 'Que qualidade de stream!', 'Salve salve!'] }
    ];
    const u = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    const m = u.msgs[Math.floor(Math.random() * u.msgs.length)];

    appendChatMessage({
      username: u.name.toLowerCase(),
      displayName: u.name,
      color: u.color,
      badges: u.badges,
      message: m
    });
  };

  // Keyboard shortcut: Press 'C' to simulate chat in OBS interaction mode
  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      window.simulateChatMessage();
    }
  });

  // Start Twitch Chat
  connectTwitchChat();

  // Mock simulation if ?mock=true
  if (allowMock) {
    setInterval(() => {
      window.simulateChatMessage();
    }, 4500);
  }

})();
