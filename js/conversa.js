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

  // Limpa estritamente valores sintéticos de teste de desenvolvimento sem afetar usuários reais
  const isSyntheticTestValue = (val) => {
    if (!val) return false;
    const v = String(val).toLowerCase().trim();
    return v === 'marcel_gamer' ||
           v === 'marcel_gamer (r$ 50,00)' ||
           v === 'marcel_gamer (r$ 25,00)' ||
           v === 'marcel (r$ 50,00)' ||
           v === 'marcel (tier 1)' ||
           v === 'lucas_apoiador (r$ 25,00)';
  };

  if (realSub && isSyntheticTestValue(realSub)) {
    realSub = (cfg.latestSub && !isSyntheticTestValue(cfg.latestSub)) ? cfg.latestSub : '-';
    try { localStorage.removeItem('dec4land_real_sub'); } catch(e) {}
  }
  if (realDonate && isSyntheticTestValue(realDonate)) {
    realDonate = (cfg.latestDonate && !isSyntheticTestValue(cfg.latestDonate)) ? cfg.latestDonate : '-';
    try { localStorage.removeItem('dec4land_real_donate'); } catch(e) {}
  }
  if (realFollower && isSyntheticTestValue(realFollower)) {
    realFollower = (cfg.latestFollower && !isSyntheticTestValue(cfg.latestFollower)) ? cfg.latestFollower : '-';
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

  // Atualiza pílulas da moldura de conversa e delega o alerta visual/sonoro para alerts.html via BroadcastChannel
  window.triggerTwitchAlert = function(data, broadcast = true) {
    if (!data) return;
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

    if (broadcast && alertBroadcast) {
      try {
        alertBroadcast.postMessage({
          action: 'trigger_alert',
          payload: data
        });
      } catch(e) {}
    }
  };

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
    if (!text) return '';
    if (window.TwitchIrcClient && typeof window.TwitchIrcClient.formatEmotes === 'function') {
      return window.TwitchIrcClient.formatEmotes(text, emotesTag);
    }
    if (!emotesTag) return escapeHtml(text);

    const replacements = [];
    const emoteParts = emotesTag.split('/');
    emoteParts.forEach(part => {
      const [id, positions] = part.split(':');
      if (!positions) return;
      positions.split(',').forEach(pos => {
        const [start, end] = pos.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end) && start >= 0 && end >= start && end < text.length) {
          replacements.push({ id, start, end });
        }
      });
    });

    if (replacements.length === 0) return escapeHtml(text);

    replacements.sort((a, b) => a.start - b.start);
    let cur = 0;
    let html = '';
    for (const r of replacements) {
      if (r.start < cur) continue;
      html += escapeHtml(text.substring(cur, r.start));
      const safeAlt = escapeHtml(text.substring(r.start, r.end + 1));
      html += `<img class="twitch-emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/2.0" alt="${safeAlt}" title="${safeAlt}">`;
      cur = r.end + 1;
    }
    if (cur < text.length) {
      html += escapeHtml(text.substring(cur));
    }
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

    // Normaliza badges para suportar tanto Array ['broadcaster/1'] quanto Objeto { broadcaster: true }
    let badgeList = [];
    if (Array.isArray(badges)) {
      badgeList = badges;
    } else if (badges && typeof badges === 'object') {
      badgeList = Object.keys(badges).filter(k => badges[k]);
    }

    // Badges HTML
    let badgesHtml = '';
    badgeList.forEach(b => {
      const bKey = String(b).toLowerCase();
      if (bKey.startsWith('broadcaster')) {
        badgesHtml += '<span class="chat-badge badge-broadcaster">STREAMER</span>';
      } else if (bKey.startsWith('moderator') || bKey === 'mod') {
        badgesHtml += '<span class="chat-badge badge-mod">MOD</span>';
      } else if (bKey.startsWith('vip')) {
        badgesHtml += '<span class="chat-badge badge-vip">VIP</span>';
      } else if (bKey.startsWith('subscriber') || bKey === 'sub') {
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

  // Keyboard shortcuts: 'C' to simulate chat message, 'T' to trigger test alert
  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      window.simulateChatMessage();
    } else if (e.key === 't' || e.key === 'T') {
      if (typeof window.triggerTwitchAlert === 'function') {
        window.triggerTwitchAlert({
          id: `test_${Date.now()}`,
          type: 'follower',
          user: 'Viewer_Teste',
          detail: 'começou a seguir o canal!',
          isTest: true
        });
      }
    }
  });

})();
