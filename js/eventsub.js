// DEC4LAND Stream Suite - Twitch EventSub WebSocket Client
// Conecta diretamente à API oficial da Twitch (wss://eventsub.wss.twitch.tv/ws)
// Captura Follows, Subs, Bits e Raids em tempo real sem intermediários!

(function(window) {
  class TwitchEventSubClient {
    constructor() {
      this.ws = null;
      this.sessionId = null;
      const cfg = Object.assign({}, window.DEC4LAND_CONFIG || {}, window.DEC4LAND_LOCAL_CONFIG || {});
      const channel = (cfg.twitchChannel || 'dec4land').toLowerCase().replace(/^@|^#/, '').trim();
      this.broadcasterId = cfg.broadcasterId || (channel === 'dec4land' ? '227485020' : null);
      this.senderId = null;
      this.tokenScopes = new Set();
      this.recentFollowerWelcomeSet = new Set();
      this.knownFollowersSet = new Set();
      this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error' | 'unconfigured'
      this.statusMessage = '';
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = Infinity;
      this.reconnectTimer = null;
      this.keepaliveTimer = null;
      this.statusListeners = new Set();
      this.activeSubscriptions = new Set();
      this.lastKnownFollower = localStorage.getItem('dec4land_real_follower') || cfg.latestFollower || '-';

      this.initBroadcastSync();

      // Reconecta assim que credenciais locais forem carregadas
      window.addEventListener('dec4land_config_updated', () => {
        if (this.status !== 'connected') {
          console.log('[EventSub] Configuração local detectada! Conectando...');
          this.connect();
        }
      });
    }

    // Retorna credenciais combinando config.js, localStorage e URL
    getCredentials() {
      const cfg = Object.assign({}, window.DEC4LAND_CONFIG || {}, window.DEC4LAND_LOCAL_CONFIG || {});
      const urlParams = new URLSearchParams(window.location.search);

      const clientId = (
        urlParams.get('client_id') ||
        localStorage.getItem('dec4land_eventsub_client_id') ||
        cfg.twitchClientId ||
        'gp762nuuoqcoxypju8c569th9wz7q5'
      ).trim();

      let token = (
        urlParams.get('token') ||
        urlParams.get('oauth') ||
        localStorage.getItem('dec4land_eventsub_token') ||
        cfg.twitchOAuthToken ||
        ''
      ).trim();

      // Sanitiza o token removendo prefixos acidentais como 'oauth:' ou 'Bearer '
      token = token.replace(/^oauth:/i, '').replace(/^Bearer /i, '').trim();

      const channel = (
        urlParams.get('channel') ||
        localStorage.getItem('dec4land_twitch_channel') ||
        cfg.twitchChannel ||
        'dec4land'
      ).toLowerCase().replace(/^@|^#/, '').trim();

      return { clientId, token, channel };
    }

    setStatus(newStatus, message = '') {
      this.status = newStatus;
      this.statusMessage = message;
      this.statusListeners.forEach(listener => {
        try { listener(newStatus, message); } catch(e) {}
      });

      // Dispara evento DOM customizado para componentes na página
      window.dispatchEvent(new CustomEvent('dec4land_eventsub_status', {
        detail: { status: newStatus, message: message }
      }));

      // Notifica outras abas/cenas se aplicável
      this.postEventSubMessage({ action: 'status_update', status: newStatus, message });
    }

    onStatusChange(callback) {
      if (typeof callback === 'function') {
        this.statusListeners.add(callback);
        // Emite status atual imediatamente
        callback(this.status, this.statusMessage);
      }
    }

    postAlertMessage(msg) {
      if (this.alertsBc) {
        try { this.alertsBc.postMessage(msg); } catch(e) {}
      }
    }

    postEventSubMessage(msg) {
      if (this.eventsubBc) {
        try { this.eventsubBc.postMessage(msg); } catch(e) {}
      }
    }

    initBroadcastSync() {
      try {
        if ('BroadcastChannel' in window) {
          if (!this.eventsubBc) {
            this.eventsubBc = new BroadcastChannel('dec4land_eventsub_channel');
            this.eventsubBc.onmessage = (e) => {
              if (e.data && e.data.action === 'credentials_updated') {
                console.log('[EventSub] Credenciais atualizadas externamente. Reconectando...');
                this.connect();
              }
            };
          }

          if (!this.alertsBc) {
            this.alertsBc = new BroadcastChannel('dec4land_stream_alerts');
          }

          // Canal dedicado para sincronizar e travar o envio de boas-vindas entre todas as abas e cenas
          if (!this.welcomeBc) {
            this.welcomeBc = new BroadcastChannel('dec4land_welcome_bot');
            this.welcomeBc.onmessage = (e) => {
              if (e.data && e.data.action === 'claim_welcome' && e.data.user) {
                const u = String(e.data.user).toLowerCase().trim();
                this.recentFollowerWelcomeSet.add(u);
                try {
                  localStorage.setItem(`dec4land_welcome_sent_${u}`, (e.data.timestamp || Date.now()).toString());
                } catch(err) {}
              }
            };
          }
        }
      } catch(e) {}

      // Sincroniza via storage event quando outra aba grava no localStorage
      try {
        window.addEventListener('storage', (e) => {
          if (e.key && e.key.startsWith('dec4land_welcome_sent_')) {
            const u = e.key.replace('dec4land_welcome_sent_', '').toLowerCase().trim();
            if (u) this.recentFollowerWelcomeSet.add(u);
          }
        });
      } catch(e) {}

      // Escuta mensagens capturadas do chat via Twitch IRC para detectar se o bot já postou no chat
      try {
        window.addEventListener('dec4land_twitch_irc_message', (e) => {
          const d = e.detail;
          if (!d || !d.message) return;
          const channelName = (this.getCredentials().channel || 'dec4land').toLowerCase();
          const isBroadcaster = d.highlight === 'broadcaster' ||
            (d.username && d.username.toLowerCase() === channelName) ||
            (d.badges && d.badges.some(b => b.startsWith('broadcaster')));

          if (isBroadcaster) {
            const mentions = d.message.match(/@([a-zA-Z0-9_]{3,25})/g);
            if (mentions) {
              const now = Date.now();
              mentions.forEach(m => {
                const u = m.substring(1).toLowerCase();
                this.recentFollowerWelcomeSet.add(u);
                try {
                  localStorage.setItem(`dec4land_welcome_sent_${u}`, now.toString());
                } catch(err) {}
              });
            }
          }
        });
      } catch(e) {}
    }

    // Identifica o papel desta página na hierarquia de envio do bot
    getRole() {
      const pathname = (window.location.pathname || '').toLowerCase();
      const urlParams = new URLSearchParams(window.location.search);

      if (urlParams.get('bot') === 'false' || urlParams.get('welcome_bot') === 'false') {
        return 'disabled';
      }
      if (urlParams.get('role') === 'master' || pathname.includes('alerts.html')) {
        return 'master'; // Alertas dedicados = prioridade máxima (0ms delay)
      }
      if (pathname.includes('index.html')) {
        return urlParams.get('standalone_bot') === 'true' ? 'master' : 'dashboard';
      }
      // Cenas do OBS com overlay (gameplay.html, conversa.html, react.html)
      return 'scene'; // Prioridade secundária (aguarda 1200ms para checar envio mestre)
    }

    async connect(reconnectUrl = null) {
      this.manualDisconnect = false;
      if (this._configRetryTimer) {
        clearTimeout(this._configRetryTimer);
        this._configRetryTimer = null;
      }
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      const { clientId, token, channel } = this.getCredentials();

      if (!clientId || !token) {
        this.setStatus('unconfigured', 'Credenciais EventSub (Client ID ou Token) não configuradas.');
        console.log('[EventSub] Alertas de Follow aguardando Client ID e Token OAuth.');
        if (!this._configRetryTimer && !this.manualDisconnect) {
          this._configRetryTimer = setTimeout(() => {
            this._configRetryTimer = null;
            if (!this.manualDisconnect) this.connect();
          }, 1500);
        }
        return;
      }

      // Inicia imediatamente o Watchdog contínuo via API Helix em paralelo (resiliência total)
      this.startPeriodicSync();

      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        if (!reconnectUrl) {
          console.log('[EventSub] WebSocket já conectado ou conectando.');
          return;
        }
      }

      this.setStatus('connecting', 'Conectando ao Twitch EventSub WebSocket...');
      const targetUrl = reconnectUrl || 'wss://eventsub.wss.twitch.tv/ws';

      try {
        this.ws = new WebSocket(targetUrl);

        this.ws.onopen = () => {
          console.log('[EventSub] WebSocket conectado. Aguardando session_welcome...');
        };

        this.ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            await this.handleMessage(data);
          } catch(err) {
            console.error('[EventSub] Erro ao processar mensagem recebida:', err, event.data);
          }
        };

        this.ws.onerror = (err) => {
          console.error('[EventSub] Erro no WebSocket:', err);
          this.setStatus('error', 'Falha na conexão do WebSocket da Twitch.');
        };

        this.ws.onclose = (e) => {
          console.warn('[EventSub] Conexão encerrada:', e.code, e.reason);
          this.cleanupKeepalive();
          if (this.status !== 'unconfigured' && !this.manualDisconnect) {
            this.setStatus('disconnected', 'Desconectado da Twitch.');
            this.scheduleReconnect();
          }
        };

      } catch(err) {
        console.error('[EventSub] Exceção ao iniciar conexão:', err);
        this.setStatus('error', err.message);
        this.scheduleReconnect();
      }
    }

    disconnect() {
      this.manualDisconnect = true;
      if (this._configRetryTimer) {
        clearTimeout(this._configRetryTimer);
        this._configRetryTimer = null;
      }
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.cleanupKeepalive();
      if (this.ws) {
        try {
          this.ws.close();
        } catch(e) {}
        this.ws = null;
      }
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      this.setStatus('disconnected', 'Desconectado manualmente.');
    }

    scheduleReconnect() {
      if (this.manualDisconnect || this.reconnectTimer) return;

      this.reconnectAttempts++;
      const delay = Math.min(15000, 2000 * Math.pow(1.3, Math.min(this.reconnectAttempts, 8)));
      console.log(`[EventSub] Tentando reconectar em ${(delay / 1000).toFixed(1)}s (Tentativa ${this.reconnectAttempts})...`);
      
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    }

    cleanupKeepalive() {
      if (this.keepaliveTimer) {
        clearTimeout(this.keepaliveTimer);
        this.keepaliveTimer = null;
      }
    }

    resetKeepalive(timeoutSeconds = 10) {
      this.cleanupKeepalive();
      // Margem generosa de 45 segundos para nunca derrubar conexões saudáveis por jitter
      const margin = 45000;
      this.keepaliveTimer = setTimeout(() => {
        console.warn('[EventSub] Keepalive não recebido no tempo limite. Reconectando...');
        if (this.ws) {
          try { this.ws.close(); } catch(e) {}
        }
      }, (timeoutSeconds * 1000) + margin);
    }

    async handleMessage(msg) {
      const { metadata, payload } = msg;
      if (!metadata) return;

      switch (metadata.message_type) {
        case 'session_welcome': {
          this.reconnectAttempts = 0;
          this.sessionId = payload.session.id;
          const keepaliveSec = payload.session.keepalive_timeout_seconds || 10;
          this.resetKeepalive(keepaliveSec);
          console.log('[EventSub] Sessão iniciada com sucesso! Session ID:', this.sessionId);

          // Obtém o User ID do canal e registra as inscrições de eventos
          const success = await this.registerAllSubscriptions();
          if (success) {
            this.setStatus('connected', 'Conectado à Twitch EventSub! Alertas de Follow ativos.');
          }
          break;
        }

        case 'session_keepalive': {
          this.resetKeepalive(10);
          break;
        }

        case 'session_reconnect': {
          console.log('[EventSub] Servidor solicitou reconexão. URL:', payload.session.reconnect_url);
          if (payload.session.reconnect_url) {
            this.connect(payload.session.reconnect_url);
          }
          break;
        }

        case 'revocation': {
          console.warn('[EventSub] Inscrição revogada pela Twitch:', payload.subscription);
          break;
        }

        case 'notification': {
          this.resetKeepalive(10);
          this.handleNotification(metadata.subscription_type, payload.event, metadata);
          break;
        }

        default:
          break;
      }
    }

    // Busca o ID numérico do canal na API Helix
    async fetchBroadcasterId(clientId, token, channelName) {
      const url = `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channelName)}`;
      const res = await fetch(url, {
        headers: {
          'Client-Id': clientId,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Falha ao obter canal na Twitch (${res.status}): ${errorText}`);
      }

      const json = await res.json();
      if (!json.data || json.data.length === 0) {
        throw new Error(`Canal "${channelName}" não encontrado na Twitch.`);
      }

      return json.data[0].id;
    }

    // Realiza a chamada POST na API Helix para registrar a inscrição no WebSocket
    async subscribeHelixEvent(type, version, condition, clientId, token) {
      const url = 'https://api.twitch.tv/helix/eventsub/subscriptions';
      const body = {
        type: type,
        version: version,
        condition: condition,
        transport: {
          method: 'websocket',
          session_id: this.sessionId
        }
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const json = await res.json();
        if (res.ok) {
          console.log(`[EventSub] Inscrição ativa: ${type} (v${version})`);
          this.activeSubscriptions.add(type);
          return true;
        } else {
          // Se falhou por escopo ausente ou já existir, avisa no log sem quebrar as outras
          console.warn(`[EventSub] Aviso ao inscrever "${type}":`, json.message || json);
          return false;
        }
      } catch(err) {
        console.error(`[EventSub] Erro de rede ao inscrever "${type}":`, err);
        return false;
      }
    }

    async registerAllSubscriptions() {
      const { clientId, token, channel } = this.getCredentials();

      try {
        await this.validateToken(token);
        this.broadcasterId = await this.fetchBroadcasterId(clientId, token, channel);
        console.log(`[EventSub] Canal resolvido: ${channel} (ID: ${this.broadcasterId})`);
      } catch(err) {
        console.error('[EventSub] Erro ao autenticar canal:', err);
        this.setStatus('error', err.message);
        return false;
      }

      this.activeSubscriptions.clear();

      // 1. Alerta de Seguidor (canal.follow v2 - requer escopo moderator:read:followers)
      await this.subscribeHelixEvent(
        'channel.follow',
        '2',
        {
          broadcaster_user_id: this.broadcasterId,
          moderator_user_id: this.broadcasterId
        },
        clientId,
        token
      );

      // 2. Alerta de Inscrição / Sub (channel.subscribe v1 - requer channel:read:subscriptions)
      await this.subscribeHelixEvent(
        'channel.subscribe',
        '1',
        { broadcaster_user_id: this.broadcasterId },
        clientId,
        token
      );

      // Alerta de Inscrição de Presente / Sub Gift (channel.subscription.gift v1)
      await this.subscribeHelixEvent(
        'channel.subscription.gift',
        '1',
        { broadcaster_user_id: this.broadcasterId },
        clientId,
        token
      );

      // 3. Alerta de Renovação de Inscrição com mensagem (channel.subscription.message v1)
      await this.subscribeHelixEvent(
        'channel.subscription.message',
        '1',
        { broadcaster_user_id: this.broadcasterId },
        clientId,
        token
      );

      // 4. Alerta de Bits / Cheer (channel.cheer v1 - requer bits:read)
      await this.subscribeHelixEvent(
        'channel.cheer',
        '1',
        { broadcaster_user_id: this.broadcasterId },
        clientId,
        token
      );

      // 5. Alerta de Raid (channel.raid v1 - sem escopo adicional obrigatório)
      await this.subscribeHelixEvent(
        'channel.raid',
        '1',
        { to_broadcaster_user_id: this.broadcasterId },
        clientId,
        token
      );

      // Consulta o seguidor e o sub mais recentes já existentes no canal para preencher a moldura imediatamente
      await this.fetchLatestFollower(clientId, token);
      await this.fetchLatestSub(clientId, token);

      // Inicia sincronizador contínuo (Watchdog de 12s) para garantir 100% de detecção de follows e subs
      this.startPeriodicSync();

      return true;
    }

    startPeriodicSync() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }

      // Checagem imediata ao iniciar o sincronizador
      const initialCreds = this.getCredentials();
      if (initialCreds.clientId && initialCreds.token) {
        this.syncFollowerWatchdog(initialCreds.clientId, initialCreds.token);
      }

      let loopCount = 0;
      // Checagem a cada 4 segundos na Twitch Helix API (máxima velocidade e confiabilidade)
      this.syncInterval = setInterval(async () => {
        const { clientId, token } = this.getCredentials();
        if (!this.broadcasterId || !clientId || !token) return;

        // Reconecta se o WebSocket foi encerrado pelo OBS em segundo plano
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
          console.log('[EventSub] Reconectando WebSocket inativo...');
          this.connect();
        }

        loopCount++;
        // Sincroniza novos seguidores com a API oficial da Twitch (ordenado cronologicamente com followed_at)
        await this.syncFollowerWatchdog(clientId, token);
      }, 4000);
    }

    async syncFollowerWatchdog(clientId, token) {
      try {
        const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.broadcasterId}&first=10`;
        const res = await fetch(url, {
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            // Se o set ainda não foi populado no startup, inicializa com a lista atual sem disparar spam retroativo
            if (this.knownFollowersSet.size === 0) {
              json.data.forEach(f => {
                const name = (f.user_name || f.user_login || '').toLowerCase();
                if (name) this.knownFollowersSet.add(name);
              });
              const followerName = json.data[0].user_name || json.data[0].user_login;
              if (followerName) this.lastKnownFollower = followerName;
              return;
            }

            // Identifica novos seguidores (do mais antigo para o mais recente na lista)
            const newFollowers = [];
            for (let i = json.data.length - 1; i >= 0; i--) {
              const item = json.data[i];
              const name = item.user_name || item.user_login;
              const lower = (name || '').toLowerCase();
              if (lower && !this.knownFollowersSet.has(lower)) {
                newFollowers.push(name);
                this.knownFollowersSet.add(lower);
              }
            }

            // Dispara alerta visual para cada novo seguidor detectado
            for (const followerName of newFollowers) {
              console.log(`[EventSub] ★ NOVO SEGUIDOR IDENTIFICADO VIA WATCHDOG: ${followerName}`);
              this.dispatchAlert({
                id: `follow_${followerName.toLowerCase()}_${Date.now()}`,
                type: 'follower',
                user: followerName,
                detail: 'começou a seguir o canal!'
              });
              // O Watchdog SEMPRE dispara a mensagem de boas-vindas como garantia máxima!
              // A trava atômica anti-duplicação (recentFollowerWelcomeSet + localStorage + BroadcastChannel)
              // impede que mensagens duplicadas sejam enviadas caso o WebSocket também processe o evento.
              this.sendWelcomeMessage(followerName);
            }

            // Atualiza letreiro e HUD com o seguidor mais recente
            const latestName = json.data[0].user_name || json.data[0].user_login;
            if (latestName) {
              this.lastKnownFollower = latestName;
              const currentSaved = localStorage.getItem('dec4land_real_follower') || window.DEC4LAND_CONFIG?.latestFollower || '';
              if (!currentSaved || currentSaved.toLowerCase() !== latestName.toLowerCase()) {
                if (typeof window.updateFollower === 'function') {
                  window.updateFollower(latestName);
                }
                try {
                  localStorage.setItem('dec4land_real_follower', latestName);
                  this.postAlertMessage({ action: 'update_hud_info', follower: latestName });
                } catch(e) {}
              }
            }
          }
        }
      } catch(err) {}
    }


    // Consulta inicial do último sub (prioriza config/storage; evita sobrescrever com lista desordenada do Helix)
    async fetchLatestSub(clientId, token) {
      const isSynthetic = (v) => {
        if (!v) return true;
        const s = String(v).toLowerCase().trim();
        return s === '-' || s === 'marcel_gamer' || s === 'anarchyzera12' || s === 'anarchyzera';
      };

      const currentSavedSub = localStorage.getItem('dec4land_real_sub');
      const cfg = Object.assign({}, window.DEC4LAND_CONFIG || {}, window.DEC4LAND_LOCAL_CONFIG || {});
      const fallback = (!isSynthetic(currentSavedSub)) 
        ? currentSavedSub 
        : ((cfg.latestSub && !isSynthetic(cfg.latestSub)) ? cfg.latestSub : '');

      if (fallback && fallback !== '-') {
        if (typeof window.updateSub === 'function') {
          window.updateSub(fallback);
        }
        return fallback;
      }

      if (!this.broadcasterId || !token || !clientId) return null;
      try {
        let allSubs = [];
        const channelLower = (this.channel || 'dec4land').toLowerCase();

        const url = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${this.broadcasterId}&first=100`;
        const res = await fetch(url, {
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            allSubs = json.data;
          }
        }

        // Filtra a própria conta do streamer (que possui sub vitalício Tier 3 no canal)
        const validSubs = allSubs.filter(s => {
          const uId = String(s.user_id || '');
          const uName = (s.user_name || s.user_login || '').toLowerCase();
          return uId !== String(this.broadcasterId) && uName !== channelLower && uName !== 'dec4land';
        });

        if (validSubs.length === 1) {
          const sub = validSubs[0];
          const subName = sub.is_gift && sub.gifter_name 
            ? `${sub.gifter_name} (Gift)` 
            : (sub.user_name || sub.user_login);

          if (subName && !isSynthetic(subName)) {
            console.log(`[EventSub] 💎 Sub inicial carregado da Twitch: ${subName}`);
            if (typeof window.updateSub === 'function') {
              window.updateSub(subName);
            }
            try {
              localStorage.setItem('dec4land_real_sub', subName);
              this.postAlertMessage({
                action: 'update_hud_info',
                sub: subName
              });
            } catch(e) {}
            return subName;
          }
        }
      } catch(err) {
        console.warn('[EventSub] Erro ao consultar último sub via Helix:', err);
      }
      return null;
    }

    // Consulta o seguidor mais recente existente no canal na Twitch Helix API
    async fetchLatestFollower(clientId, token) {
      if (!this.broadcasterId || !token || !clientId) return null;
      try {
        const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.broadcasterId}&first=10`;
        const res = await fetch(url, {
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            // Popula os seguidores já conhecidos para não disparar retrospectivo
            json.data.forEach(f => {
              const name = (f.user_name || f.user_login || '').toLowerCase();
              if (name) this.knownFollowersSet.add(name);
            });

            const followerName = json.data[0].user_name || json.data[0].user_login;
            if (followerName) {
              console.log(`[EventSub] ★ Último seguidor carregado da Twitch: ${followerName}`);
              this.lastKnownFollower = followerName;
              if (typeof window.updateFollower === 'function') {
                window.updateFollower(followerName);
              }
              try {
                localStorage.setItem('dec4land_real_follower', followerName);
                this.postAlertMessage({
                  action: 'update_hud_info',
                  follower: followerName
                });
              } catch(e) {}
              return followerName;
            }
          }
        } else {
          console.warn('[EventSub] Aviso ao obter último seguidor via Helix:', res.status);
        }
      } catch(err) {
        console.warn('[EventSub] Erro ao consultar último seguidor via Helix:', err);
      }
      return null;
    }

    dispatchAlert(alertData) {
      if (typeof window.triggerTwitchAlert === 'function') {
        window.triggerTwitchAlert(alertData);
      } else {
        this.postAlertMessage({
          action: 'trigger_alert',
          payload: alertData
        });
      }
    }

    // Roteia eventos recebidos da Twitch diretamente para os alertas e letreiros
    handleNotification(type, event, metadata = {}) {
      if (!event) return;
      const alertId = metadata.message_id || (`eventsub_${type}_${Date.now()}`);

      switch (type) {
        case 'channel.follow': {
          const followerName = event.user_name || event.user_login || 'Novo Seguidor';
          console.log(`[EventSub] ★ NOVO SEGUIDOR REAL: ${followerName}`);

          this.knownFollowersSet.add(followerName.toLowerCase());
          this.lastKnownFollower = followerName;

          // Dispara alerta visual e sonoro DEC4LAND
          this.dispatchAlert({
            id: alertId,
            type: 'follower',
            user: followerName,
            detail: 'começou a seguir o canal!'
          });

          // Dispara mensagem automática de boas-vindas no chat da Twitch (com trava anti-duplicação OBS)
          this.sendWelcomeMessage(followerName);

          // Atualiza letreiro de último seguidor nas cenas
          if (typeof window.updateFollower === 'function') {
            window.updateFollower(followerName);
          }

          // Persiste e sincroniza em todas as cenas abertas no OBS
          try {
            localStorage.setItem('dec4land_real_follower', followerName);
            this.postAlertMessage({
              action: 'update_hud_info',
              follower: followerName
            });
          } catch(e) {}
          break;
        }

        case 'channel.subscribe': {
          // Se for sub de presente (gift), a Twitch envia o evento com is_gift: true para o recebedor.
          // NÃO disparar alerta individual de sub para o recebedor (apenas quem presenteou deve aparecer).
          if (event.is_gift) {
            console.log(`[EventSub] 🎁 Sub de presente recebido por ${event.user_name || event.user_login}. Ignorando alerta individual.`);
            break;
          }

          const subName = event.user_name || event.user_login || 'Viewer';
          const tier = event.tier === '3000' ? 'Tier 3' : event.tier === '2000' ? 'Tier 2' : 'Tier 1';
          console.log(`[EventSub] 💎 NOVO SUB REAL: ${subName} (${tier})`);

          this.dispatchAlert({
            id: alertId,
            type: 'sub',
            user: subName,
            detail: `assinou o canal (${tier})!`
          });

          if (typeof window.updateSub === 'function') {
            window.updateSub(subName);
          }

          try {
            localStorage.setItem('dec4land_real_sub', subName);
            this.postAlertMessage({
              action: 'update_hud_info',
              sub: subName
            });
          } catch(e) {}
          break;
        }

        case 'channel.subscription.gift': {
          const gifter = event.is_anonymous ? 'Anônimo' : (event.user_name || event.user_login || 'Alguém');
          const total = event.total || 1;
          const tier = event.tier === '3000' ? 'Tier 3' : event.tier === '2000' ? 'Tier 2' : 'Tier 1';
          const detail = total > 1 
            ? `presenteou ${total} Subs (${tier}) para a comunidade!` 
            : `presenteou um Sub (${tier}) para a comunidade!`;

          console.log(`[EventSub] 🎁 SUB DE PRESENTE: ${gifter} deu ${total} sub(s)!`);

          this.dispatchAlert({
            id: alertId || `gift_${gifter.toLowerCase()}_${Date.now()}`,
            type: 'sub',
            user: gifter,
            total: total,
            subCount: total,
            detail: detail,
            isGift: true
          });

          const formattedGift = `${gifter} (${total > 1 ? total + 'x Gift' : 'Gift'})`;

          if (typeof window.updateSub === 'function') {
            window.updateSub(formattedGift);
          }

          try {
            localStorage.setItem('dec4land_real_sub', formattedGift);
            this.postAlertMessage({
              action: 'update_hud_info',
              sub: formattedGift
            });
          } catch(e) {}
          break;
        }

        case 'channel.subscription.message': {
          const subName = event.user_name || event.user_login || 'Viewer';
          const months = event.cumulative_months || 1;
          const msg = event.message ? event.message.text : '';
          console.log(`[EventSub] 💎 RESUB REAL: ${subName} (${months} meses)`);

          this.dispatchAlert({
            id: alertId,
            type: 'sub',
            user: subName,
            months: months,
            detail: `renovou a inscrição (${months} meses)!`,
            message: msg
          });

          const formattedResub = `${subName} (${months}m)`;

          if (typeof window.updateSub === 'function') {
            window.updateSub(subName, months);
          }

          try {
            localStorage.setItem('dec4land_real_sub', formattedResub);
            this.postAlertMessage({
              action: 'update_hud_info',
              sub: formattedResub
            });
          } catch(e) {}
          break;
        }

        case 'channel.cheer': {
          const cheerName = event.is_anonymous ? 'Anônimo' : (event.user_name || 'Viewer');
          const bits = String(event.bits || '100');
          const msg = event.message || '';
          console.log(`[EventSub] ⚡ BITS REAIS: ${cheerName} (${bits} bits)`);

          this.dispatchAlert({
            id: alertId,
            type: 'bits',
            user: cheerName,
            amount: bits,
            message: msg
          });
          break;
        }

        case 'channel.raid': {
          const raiderName = event.from_broadcaster_user_name || 'Streamer';
          const viewers = String(event.viewers || '10');
          console.log(`[EventSub] 🚨 RAID REAL: ${raiderName} (${viewers} viewers)`);

          this.dispatchAlert({
            id: alertId,
            type: 'raid',
            user: raiderName,
            amount: viewers,
            detail: `chegou com ${viewers} espectadores!`
          });
          break;
        }

        default:
          console.log('[EventSub] Evento não mapeado:', type, event);
      }
    }

    // Atualiza credenciais e reconecta imediatamente
    saveCredentials(clientId, token) {
      if (clientId) localStorage.setItem('dec4land_eventsub_client_id', clientId.trim());
      if (token) localStorage.setItem('dec4land_eventsub_token', token.replace(/^oauth:/i, '').replace(/^Bearer /i, '').trim());

      this.postEventSubMessage({ action: 'credentials_updated' });

      this.connect();
    }
    // Valida o Token na API de OAuth da Twitch e inspeciona escopos concedidos
    async validateToken(token) {
      if (!token) return null;
      try {
        const cleanToken = token.replace(/^oauth:/i, '').replace(/^Bearer /i, '').trim();
        const res = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: {
            'Authorization': `OAuth ${cleanToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          this.senderId = data.user_id;
          const scopes = Array.isArray(data.scopes) ? data.scopes : [];
          this.tokenScopes = new Set(scopes);
          const hasChatWrite = this.tokenScopes.has('user:write:chat');

          console.log(`[EventSub] Token verificado com sucesso para @${data.login}! Escopo de chat (user:write:chat): ${hasChatWrite ? '✅ ATIVO' : '❌ NÃO ENCONTRADO'}`);

          window.dispatchEvent(new CustomEvent('dec4land_token_validated', {
            detail: {
              valid: true,
              userId: data.user_id,
              login: data.login,
              scopes: scopes,
              hasChatWrite: hasChatWrite,
              expiresIn: data.expires_in
            }
          }));
          return data;
        } else {
          console.warn('[EventSub] Token inválido ou expirado na Twitch (HTTP ' + res.status + ')');
          window.dispatchEvent(new CustomEvent('dec4land_token_validated', {
            detail: { valid: false, status: res.status }
          }));
        }
      } catch(e) {
        console.warn('[EventSub] Aviso ao consultar validação de token:', e);
      }
      return null;
    }

    // Envia uma mensagem de texto diretamente no chat da Twitch via API Helix
    async sendChatMessage(messageText) {
      const { clientId, token } = this.getCredentials();
      if (!token) {
        return { success: false, error: 'Token OAuth da Twitch não configurado.' };
      }

      if (!this.broadcasterId) {
        try {
          const cfg = Object.assign({}, window.DEC4LAND_CONFIG || {}, window.DEC4LAND_LOCAL_CONFIG || {});
          this.broadcasterId = await this.fetchBroadcasterId(clientId, token, cfg.twitchChannel || 'dec4land');
        } catch(e) {
          return { success: false, error: 'Não foi possível resolver o ID do canal: ' + e.message };
        }
      }

      if (!this.senderId) {
        await this.validateToken(token);
      }

      const url = 'https://api.twitch.tv/helix/chat/messages';
      const cleanToken = token.replace(/^oauth:/i, '').replace(/^Bearer /i, '').trim();
      const body = {
        broadcaster_id: this.broadcasterId,
        sender_id: this.senderId || this.broadcasterId,
        message: String(messageText || '').trim()
      };

      if (!body.message) {
        return { success: false, error: 'Mensagem vazia.' };
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          const firstMsg = json.data && json.data[0];
          if (firstMsg && firstMsg.is_sent === false) {
            const dropReason = firstMsg.drop_reason?.message || 'Mensagem descartada pela moderação ou automod da Twitch.';
            console.warn('[WelcomeBot] Aviso no chat:', dropReason);
            return { success: false, error: dropReason, data: json };
          }
          return { success: true, data: json };
        } else {
          let errMsg = json.message || `Erro HTTP ${res.status}`;
          if (res.status === 401 || res.status === 403) {
            errMsg += ' (Certifique-se de que o token possui o escopo user:write:chat)';
          }
          console.warn('[WelcomeBot] Falha no envio do chat:', errMsg);
          return { success: false, error: errMsg, status: res.status, data: json };
        }
      } catch(err) {
        console.error('[WelcomeBot] Erro de rede ao enviar mensagem:', err);
        return { success: false, error: err.message };
      }
    }

    // Dispara a mensagem personalizada de boas-vindas com trava de concorrência anti-duplicação OBS
    async sendWelcomeMessage(followerName, isTest = false) {
      if (!followerName) return { success: false, error: 'Nome de seguidor inválido' };

      const cfg = Object.assign({}, window.DEC4LAND_CONFIG || {}, window.DEC4LAND_LOCAL_CONFIG || {});
      const isEnabled = localStorage.getItem('dec4land_welcome_bot_enabled') !== null
        ? localStorage.getItem('dec4land_welcome_bot_enabled') === 'true'
        : (cfg.welcomeBotEnabled !== false);

      if (!isEnabled && !isTest) {
        console.log('[WelcomeBot] Bot de boas-vindas desativado nas preferências.');
        return { success: false, error: 'Bot desativado nas preferências.' };
      }

      const role = this.getRole();
      if (!isTest) {
        if (role === 'disabled') {
          console.log('[WelcomeBot] Bot de boas-vindas desativado nesta fonte.');
          return { success: false, error: 'Bot desativado nesta fonte.' };
        }
      }

      const lowerFollower = followerName.toLowerCase().trim();
      const dedupeKey = `dec4land_welcome_sent_${lowerFollower}`;
      const now = Date.now();
      const LOCK_WINDOW_MS = 600000; // 10 minutos de retenção anti-duplicação

      // Trava atômica multi-cenas (evita duplicação caso múltiplas cenas OBS ou abas estejam abertas)
      if (!isTest) {
        // 1. Verificação local em memória
        if (this.recentFollowerWelcomeSet.has(lowerFollower)) {
          console.log(`[WelcomeBot] Mensagem já disparada nesta sessão para @${followerName}.`);
          return { success: false, error: 'Mensagem já disparada nesta sessão.' };
        }

        // 2. Verificação no localStorage compartilhado
        const lastSent = parseInt(localStorage.getItem(dedupeKey) || '0', 10);
        if (now - lastSent < LOCK_WINDOW_MS) {
          console.log(`[WelcomeBot] Mensagem para @${followerName} já enviada recentemente (${Math.round((now - lastSent) / 1000)}s atrás).`);
          return { success: false, error: 'Mensagem já enviada recentemente.' };
        }

        // 3. Escalonamento inteligente de envio para evitar conflito entre instâncias:
        // - 'master' (alerts.html): prioridade instantânea (0ms)
        // - 'scene' (gameplay.html, conversa.html, react.html): aguarda 500ms
        // - 'dashboard' (index.html): aguarda 1000ms caso o OBS esteja rodando; se o OBS não enviar, o dashboard envia com sucesso!
        let delay = 0;
        if (role === 'scene') delay = 500;
        else if (role === 'dashboard') delay = 1000;

        if (delay > 0) {
          console.log(`[WelcomeBot] Fonte com papel "${role}": aguardando ${delay}ms para verificar se fonte prioritária já enviou...`);
          await new Promise(r => setTimeout(r, delay));

          // Reavalia após o delay se outra fonte já capturou e enviou
          if (this.recentFollowerWelcomeSet.has(lowerFollower)) {
            console.log(`[WelcomeBot] Mensagem para @${followerName} confirmada por outra fonte durante a espera.`);
            return { success: false, error: 'Mensagem já enviada por outra fonte.' };
          }
          const recheck = parseInt(localStorage.getItem(dedupeKey) || '0', 10);
          if (Date.now() - recheck < LOCK_WINDOW_MS) {
            console.log(`[WelcomeBot] Mensagem para @${followerName} confirmada no localStorage.`);
            return { success: false, error: 'Mensagem já enviada por outra cena.' };
          }
        }

        // 4. Grava trava local, localStorage e notifica todas as outras abas/cenas via BroadcastChannel
        this.recentFollowerWelcomeSet.add(lowerFollower);
        try {
          localStorage.setItem(dedupeKey, Date.now().toString());
          if (this.welcomeBc) {
            this.welcomeBc.postMessage({
              action: 'claim_welcome',
              user: lowerFollower,
              timestamp: Date.now()
            });
          }
        } catch(e) {}
        setTimeout(() => this.recentFollowerWelcomeSet.delete(lowerFollower), LOCK_WINDOW_MS);
      }

      // Monta template configurado
      let template = localStorage.getItem('dec4land_welcome_bot_template') || cfg.welcomeBotMessage || 'Seja muito bem-vindo(a) à tropa, @{user}! Valeu pelo follow! 🚀🔥';
      const streamerName = cfg.streamerName || cfg.twitchChannel || 'DEC4LAND';
      const finalMessage = template
        .replace(/\{user\}/gi, followerName)
        .replace(/\{follower\}/gi, followerName)
        .replace(/\{streamer\}/gi, streamerName)
        .replace(/\{canal\}/gi, streamerName)
        .replace(/\{channel\}/gi, streamerName);

      console.log(`[WelcomeBot] 🤖 Disparando boas-vindas no chat para @${followerName}: "${finalMessage}"`);
      const res = await this.sendChatMessage(finalMessage);

      if (res.success) {
        console.log(`[WelcomeBot] ✅ Boas-vindas enviadas com sucesso no chat para @${followerName}!`);
        window.dispatchEvent(new CustomEvent('dec4land_welcome_message_sent', {
          detail: { user: followerName, message: finalMessage }
        }));
      } else {
        // Se a chamada de API falhou, remove a trava para permitir reenvio
        this.recentFollowerWelcomeSet.delete(lowerFollower);
        try { localStorage.removeItem(dedupeKey); } catch(e) {}
        console.warn(`[WelcomeBot] ⚠️ Falha ao postar no chat para @${followerName}:`, res.error);
      }
      return res;
    }
  }

  // Instância singleton acessível globalmente
  const client = new TwitchEventSubClient();
  window.dec4landEventSub = client;
  window.sendTwitchChatMessage = (msg) => client.sendChatMessage(msg);
  window.testWelcomeChatMessage = (user = 'Marcel_Gamer') => client.sendWelcomeMessage(user, true);

  // Inicializa automaticamente após carregamento da página
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => client.connect());
  } else {
    setTimeout(() => client.connect(), 200);
  }

})(window);
