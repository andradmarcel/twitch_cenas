// DEC4LAND Conversa (Just Chatting) Controller
// Real-time Twitch Chat IRC WebSocket, Badges, Emotes, Events & 100% OBS Cutout Sync
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
  // WEBCAM 100% TRANSPARENT CUTOUT HOLE SYNCHRONIZATION
  // ==========================================================================
  function syncMaskHole() {
    const frame = document.getElementById('big-webcam-cutout-frame');
    const hole = document.getElementById('webcam-mask-hole');
    if (frame && hole) {
      const r = frame.getBoundingClientRect();
      // Use exact coordinates of the cutout window
      hole.setAttribute('x', Math.round(r.left));
      hole.setAttribute('y', Math.round(r.top));
      hole.setAttribute('width', Math.round(r.width));
      hole.setAttribute('height', Math.round(r.height));
    }
  }

  window.addEventListener('resize', syncMaskHole);
  window.addEventListener('DOMContentLoaded', syncMaskHole);
  window.addEventListener('load', syncMaskHole);
  requestAnimationFrame(syncMaskHole);
  setTimeout(syncMaskHole, 150);
  setTimeout(syncMaskHole, 600);

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
  // REAL-TIME TWITCH CHAT ENGINE (WebSocket IRC)
  // ==========================================================================
  const chatViewport = document.getElementById('chat-messages-viewport');
  const chatStatusText = document.getElementById('chat-status-text');
  const chatEmptyNotice = document.getElementById('chat-empty-notice');
  const MAX_MESSAGES = 60;

  function parseIrcTags(rawTags) {
    const tags = {};
    if (!rawTags) return tags;
    rawTags.split(';').forEach(tag => {
      const eq = tag.indexOf('=');
      if (eq !== -1) tags[tag.substring(0, eq)] = tag.substring(eq + 1);
    });
    return tags;
  }

  function formatEmotes(text, emotesTag) {
    if (!emotesTag) return escapeHtml(text);

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

    // Hide the empty notice once messages start coming in
    if (chatEmptyNotice && chatEmptyNotice.parentNode) {
      chatEmptyNotice.style.display = 'none';
    }

    const {
      user = 'Viewer',
      color = '',
      badges = [],
      message = '',
      emotes = '',
      highlight = '',
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
      if (bKey.startsWith('broadcaster')) {
        badgesHtml += '<span class="chat-badge badge-broadcaster">STREAMER</span>';
      } else if (bKey.startsWith('moderator')) {
        badgesHtml += '<span class="chat-badge badge-mod">MOD</span>';
      } else if (bKey.startsWith('vip')) {
        badgesHtml += '<span class="chat-badge badge-vip">VIP</span>';
      } else if (bKey.startsWith('subscriber')) {
        badgesHtml += '<span class="chat-badge badge-sub">SUB</span>';
      } else if (bKey.startsWith('prime')) {
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
      const first = chatViewport.firstChild;
      if (first === chatEmptyNotice) break;
      chatViewport.removeChild(first);
    }

    // Smooth scroll down
    chatViewport.scrollTop = chatViewport.scrollHeight;
  };

  // Connect to Twitch Chat IRC via Shared TwitchIrcClient
  let twitchIrc = null;
  function connectTwitchChat() {
    if (!window.TwitchIrcClient) {
      console.warn('[Twitch Chat] TwitchIrcClient não encontrado.');
      return;
    }

    twitchIrc = new window.TwitchIrcClient({
      channel: twitchChannel,
      onStatusChange: (status, text) => {
        if (chatStatusText) chatStatusText.textContent = text;
      },
      onMessage: (msg) => {
        window.addChatMessage({
          user: msg.displayName || msg.username,
          color: msg.color,
          badges: msg.badges,
          message: msg.message,
          emotes: msg.emotes,
          highlight: msg.highlight
        });
      },
      onNotice: (notice) => {
        if (notice.msgId === 'sub' || notice.msgId === 'resub') {
          window.updateSub(notice.user, notice.months);
          window.addChatMessage({
            user: 'DEC4LAND SYSTEM',
            color: '#ffb800',
            badges: ['subscriber'],
            message: `🎉 ${notice.user} assinou o canal (${notice.months} meses)!`,
            highlight: 'sub'
          });
        } else if (notice.msgId === 'raid') {
          window.addChatMessage({
            user: 'DEC4LAND SYSTEM',
            color: '#00d2ff',
            badges: ['broadcaster'],
            message: `🚀 RAID! ${notice.user} chegou com ${notice.viewers} espectadores!`,
            highlight: 'broadcaster'
          });
        }
      }
    });

    twitchIrc.connect();
  }

  connectTwitchChat();

  // ==========================================================================
  // SIMULATOR / MOCK CHAT MESSAGES (ONLY TRIGGERS ON DEMAND OR ?mock=true)
  // ==========================================================================
  const sampleChatters = [
    { name: 'pedro_gamer', color: '#00d2ff', badges: ['subscriber'], msg: 'Boa tarde rapaziada! Live tá braba hoje 🔥' },
    { name: 'bia_souza', color: '#ff70a6', badges: ['vip', 'subscriber'], msg: 'Cheguei a tempo do bate-papo! E aí Marcel?' },
    { name: 'lucas_fps', color: '#ffb800', badges: ['moderator'], msg: 'Chat na moral hoje hein tropa, sem spam!' },
    { name: 'carlos_pro', color: '#70d6ff', badges: ['subscriber'], msg: 'Essa cena de conversa ficou absurda demais 👏' },
    { name: 'vanessa_stream', color: '#e0aaff', badges: ['subscriber'], msg: 'Salve salve! Bora que hoje promete!' },
    { name: 'thiago_tech', color: '#00ff7f', badges: [], msg: 'Qual vai ser o jogo de hoje depois da resenha?' }
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

  // Continuous mock rotation ONLY if explicitly requested via ?mock=true
  if (allowMock) {
    setInterval(() => {
      window.simulateChatMessage();
    }, 6500);
  }

  // Keyboard shortcut: 'C' to simulate chat message
  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      window.simulateChatMessage();
    }
  });

})();
