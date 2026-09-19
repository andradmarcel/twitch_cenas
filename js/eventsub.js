// DEC4LAND Stream Suite - Twitch EventSub WebSocket Client
// Conecta diretamente à API oficial da Twitch (wss://eventsub.wss.twitch.tv/ws)
// Captura Follows, Subs, Bits e Raids em tempo real sem intermediários!

(function(window) {
  class TwitchEventSubClient {
    constructor() {
      this.ws = null;
      this.sessionId = null;
      this.broadcasterId = '227485020'; // ID oficial do canal dec4land
      this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error' | 'unconfigured'
      this.statusMessage = '';
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = Infinity;
      this.reconnectTimer = null;
      this.keepaliveTimer = null;
      this.statusListeners = new Set();
      this.activeSubscriptions = new Set();
      this.lastKnownFollower = localStorage.getItem('dec4land_real_follower') || window.DEC4LAND_CONFIG?.latestFollower || window.DEC4LAND_LOCAL_CONFIG?.latestFollower || 'drxxxfps';

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
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('dec4land_eventsub_channel');
          bc.postMessage({ action: 'status_update', status: newStatus, message });
        }
      } catch(e) {}
    }

    onStatusChange(callback) {
      if (typeof callback === 'function') {
        this.statusListeners.add(callback);
        // Emite status atual imediatamente
        callback(this.status, this.statusMessage);
      }
    }

    initBroadcastSync() {
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('dec4land_eventsub_channel');
          bc.onmessage = (e) => {
            if (e.data && e.data.action === 'credentials_updated') {
              console.log('[EventSub] Credenciais atualizadas externamente. Reconectando...');
              this.connect();
            }
          };
        }
      } catch(e) {}
    }

    async connect(reconnectUrl = null) {
      this.manualDisconnect = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      const { clientId, token, channel } = this.getCredentials();

      if (!clientId || !token) {
        this.setStatus('unconfigured', 'Credenciais EventSub (Client ID ou Token) não configuradas.');
        console.log('[EventSub] Alertas de Follow aguardando Client ID e Token OAuth.');
        if (!this._configRetryTimer) {
          this._configRetryTimer = setTimeout(() => {
            this._configRetryTimer = null;
            this.connect();
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
      if (this.reconnectTimer) return;

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
        // Sincroniza novos seguidores com a API oficial da Twitch
        await this.syncFollowerWatchdog(clientId, token);

        // A cada 12s (a cada 3 voltas), atualiza o último sub diretamente da Twitch
        if (loopCount % 3 === 0) {
          await this.fetchLatestSub(clientId, token);
        }
      }, 4000);
    }

    async syncFollowerWatchdog(clientId, token) {
      try {
        const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.broadcasterId}&first=1`;
        const res = await fetch(url, {
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            const followerName = json.data[0].user_name || json.data[0].user_login;
            if (followerName) {
              // Se é diferente do seguidor anterior que já tínhamos visto, dispara alerta e atualiza
              if (this.lastKnownFollower && this.lastKnownFollower.toLowerCase() !== followerName.toLowerCase()) {
                console.log(`[EventSub] ★ NOVO SEGUIDOR IDENTIFICADO VIA API: ${followerName} (anterior: ${this.lastKnownFollower})`);
                if (window.triggerTwitchAlert) {
                  window.triggerTwitchAlert({
                    id: `follow_${followerName.toLowerCase()}`,
                    type: 'follower',
                    user: followerName,
                    detail: 'começou a seguir o canal!'
                  });
                }
              }

              this.lastKnownFollower = followerName;

              const currentSaved = localStorage.getItem('dec4land_real_follower') || window.DEC4LAND_CONFIG?.latestFollower || '';
              if (!currentSaved || currentSaved.toLowerCase() !== followerName.toLowerCase()) {
                if (typeof window.updateFollower === 'function') {
                  window.updateFollower(followerName);
                }
                try {
                  localStorage.setItem('dec4land_real_follower', followerName);
                  if ('BroadcastChannel' in window) {
                    const bc = new BroadcastChannel('dec4land_stream_alerts');
                    bc.postMessage({ action: 'update_hud_info', follower: followerName });
                  }
                } catch(e) {}
              }
            }
          }
        }
      } catch(err) {}
    }

    // Extrai a data ISO real codificada no cursor de paginação da Twitch
    parseCursorTimestamp(cursor) {
      if (!cursor) return 0;
      try {
        const raw = atob(cursor);
        const obj = JSON.parse(raw);
        const cur = obj.b ? obj.b.Cursor : (obj.a ? obj.a.Cursor : '');
        if (!cur) return 0;
        const inner = atob(cur);
        const m = inner.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
        return m ? new Date(m[1]).getTime() : 0;
      } catch(e) {
        return 0;
      }
    }

    // Consulta o sub mais recente existente no canal na Twitch Helix API (ordenado cronologicamente)
    async fetchLatestSub(clientId, token) {
      if (!this.broadcasterId || !token || !clientId) return null;
      try {
        let allSubs = [];
        let cursor = '';
        const channelLower = (this.channel || 'dec4land').toLowerCase();

        // Itera buscando os inscritos e suas datas de início reais gravadas nos cursores da Twitch
        for (let i = 0; i < 15; i++) {
          const url = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${this.broadcasterId}&first=1${cursor ? '&after=' + encodeURIComponent(cursor) : ''}`;
          const res = await fetch(url, {
            headers: {
              'Client-Id': clientId,
              'Authorization': `Bearer ${token}`
            }
          });
          if (!res.ok) break;
          const json = await res.json();
          if (!json.data || json.data.length === 0) break;

          const sub = json.data[0];
          const cursorStr = json.pagination?.cursor || '';
          sub._timestamp = this.parseCursorTimestamp(cursorStr);
          allSubs.push(sub);

          cursor = cursorStr;
          if (!cursor) break;
        }

        // Filtra a própria conta do streamer (que possui sub vitalício Tier 3 no canal)
        const validSubs = allSubs.filter(s => {
          const uId = String(s.user_id || '');
          const uName = (s.user_name || s.user_login || '').toLowerCase();
          return uId !== String(this.broadcasterId) && uName !== channelLower && uName !== 'dec4land';
        });

        // Ordena cronologicamente do mais recente para o mais antigo
        validSubs.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));

        if (validSubs.length > 0) {
          const sub = validSubs[0];
          // Se for presente, credita quem deu o presente (gifter)
          const subName = sub.is_gift && sub.gifter_name 
            ? `${sub.gifter_name} (Gift)` 
            : (sub.user_name || sub.user_login);

          if (subName) {
            console.log(`[EventSub] 💎 Último sub real (cronológico) carregado da Twitch: ${subName}`);
            if (typeof window.updateSub === 'function') {
              window.updateSub(subName);
            }
            try {
              localStorage.setItem('dec4land_real_sub', subName);
              if ('BroadcastChannel' in window) {
                const bc = new BroadcastChannel('dec4land_stream_alerts');
                bc.postMessage({
                  action: 'update_hud_info',
                  sub: subName
                });
              }
            } catch(e) {}
            return subName;
          }
        }
      } catch(err) {
        console.warn('[EventSub] Erro ao consultar último sub cronológico via Helix:', err);
      }

      // Fallback: se a API falhar, usa config ou localStorage válido (nunca Marcel_Gamer)
      const currentSavedSub = localStorage.getItem('dec4land_real_sub');
      const fallback = (currentSavedSub && !currentSavedSub.toLowerCase().includes('marcel_gamer')) 
        ? currentSavedSub 
        : (window.DEC4LAND_CONFIG?.latestSub || '');

      if (fallback && fallback !== '-' && !fallback.toLowerCase().includes('marcel_gamer')) {
        if (typeof window.updateSub === 'function') {
          window.updateSub(fallback);
        }
        return fallback;
      }
      return null;
    }

    // Consulta o seguidor mais recente existente no canal na Twitch Helix API
    async fetchLatestFollower(clientId, token) {
      if (!this.broadcasterId || !token || !clientId) return null;
      try {
        const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.broadcasterId}&first=1`;
        const res = await fetch(url, {
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            const followerName = json.data[0].user_name || json.data[0].user_login;
            if (followerName) {
              console.log(`[EventSub] ★ Último seguidor carregado da Twitch: ${followerName}`);
              if (!this.lastKnownFollower) {
                this.lastKnownFollower = followerName;
              }
              if (typeof window.updateFollower === 'function') {
                window.updateFollower(followerName);
              }
              try {
                localStorage.setItem('dec4land_real_follower', followerName);
                if ('BroadcastChannel' in window) {
                  const bc = new BroadcastChannel('dec4land_stream_alerts');
                  bc.postMessage({
                    action: 'update_hud_info',
                    follower: followerName
                  });
                }
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

    // Roteia eventos recebidos da Twitch diretamente para os alertas e letreiros
    handleNotification(type, event, metadata = {}) {
      if (!event) return;
      const alertId = metadata.message_id || (`eventsub_${type}_${Date.now()}`);

      switch (type) {
        case 'channel.follow': {
          const followerName = event.user_name || event.user_login || 'Novo Seguidor';
          console.log(`[EventSub] ★ NOVO SEGUIDOR REAL: ${followerName}`);

          this.lastKnownFollower = followerName;

          // Dispara alerta visual e sonoro DEC4LAND
          if (window.triggerTwitchAlert) {
            window.triggerTwitchAlert({
              id: alertId,
              type: 'follower',
              user: followerName,
              detail: 'começou a seguir o canal!'
            });
          }

          // Atualiza letreiro de último seguidor nas cenas
          if (typeof window.updateFollower === 'function') {
            window.updateFollower(followerName);
          }

          // Persiste e sincroniza em todas as cenas abertas no OBS
          try {
            localStorage.setItem('dec4land_real_follower', followerName);
            if ('BroadcastChannel' in window) {
              const bc = new BroadcastChannel('dec4land_stream_alerts');
              bc.postMessage({
                action: 'update_hud_info',
                follower: followerName
              });
            }
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

          if (window.triggerTwitchAlert) {
            window.triggerTwitchAlert({
              id: alertId,
              type: 'sub',
              user: subName,
              detail: `assinou o canal (${tier})!`
            });
          }

          if (typeof window.updateSub === 'function') {
            window.updateSub(subName);
          }

          try {
            localStorage.setItem('dec4land_real_sub', subName);
            if ('BroadcastChannel' in window) {
              const bc = new BroadcastChannel('dec4land_stream_alerts');
              bc.postMessage({
                action: 'update_hud_info',
                sub: subName
              });
            }
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

          if (window.triggerTwitchAlert) {
            window.triggerTwitchAlert({
              id: alertId || `gift_${gifter.toLowerCase()}_${Date.now()}`,
              type: 'sub',
              user: gifter,
              detail: detail,
              isGift: true
            });
          }

          if (typeof window.updateSub === 'function') {
            window.updateSub(`${gifter} (${total > 1 ? total + 'x Gift' : 'Gift'})`);
          }

          try {
            localStorage.setItem('dec4land_real_sub', `${gifter} (Gift)`);
            if ('BroadcastChannel' in window) {
              const bc = new BroadcastChannel('dec4land_stream_alerts');
              bc.postMessage({
                action: 'update_hud_info',
                sub: `${gifter} (Gift)`
              });
            }
          } catch(e) {}
          break;
        }

        case 'channel.subscription.message': {
          const subName = event.user_name || event.user_login || 'Viewer';
          const months = event.cumulative_months || 1;
          const msg = event.message ? event.message.text : '';
          console.log(`[EventSub] 💎 RESUB REAL: ${subName} (${months} meses)`);

          if (window.triggerTwitchAlert) {
            window.triggerTwitchAlert({
              id: alertId,
              type: 'sub',
              user: subName,
              detail: `renovou a inscrição (${months} meses)!`,
              message: msg
            });
          }

          if (typeof window.updateSub === 'function') {
            window.updateSub(subName);
          }
          break;
        }

        case 'channel.cheer': {
          const cheerName = event.is_anonymous ? 'Anônimo' : (event.user_name || 'Viewer');
          const bits = String(event.bits || '100');
          const msg = event.message || '';
          console.log(`[EventSub] ⚡ BITS REAIS: ${cheerName} (${bits} bits)`);

          if (window.triggerTwitchAlert) {
            window.triggerTwitchAlert({
              id: alertId,
              type: 'bits',
              user: cheerName,
              amount: bits,
              message: msg
            });
          }
          break;
        }

        case 'channel.raid': {
          const raiderName = event.from_broadcaster_user_name || 'Streamer';
          const viewers = String(event.viewers || '10');
          console.log(`[EventSub] 🚨 RAID REAL: ${raiderName} (${viewers} viewers)`);

          if (window.triggerTwitchAlert) {
            window.triggerTwitchAlert({
              id: alertId,
              type: 'raid',
              user: raiderName,
              amount: viewers,
              detail: `chegou com ${viewers} espectadores!`
            });
          }
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

      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('dec4land_eventsub_channel');
          bc.postMessage({ action: 'credentials_updated' });
        }
      } catch(e) {}

      this.connect();
    }
  }

  // Instância singleton acessível globalmente
  const client = new TwitchEventSubClient();
  window.dec4landEventSub = client;

  // Inicializa automaticamente após carregamento da página
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => client.connect());
  } else {
    setTimeout(() => client.connect(), 200);
  }

})(window);
