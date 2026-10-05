// DEC4LAND Stream Suite - StreamElements & LivePix Real-Time Integration
// Conexão nativa com Astro WebSocket Gateway (wss://astro.streamelements.com/) + REST Polling Fallback
// Captura Pix e Doações em tempo real, toca o alerta neon e atualiza o card ÚLTIMO DONATE em todas as cenas!

(function(window) {
  class StreamElementsClient {
    constructor() {
      this.ws = null;
      this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error' | 'unconfigured'
      this.statusMessage = '';
      this.statusListeners = new Set();
      this.reconnectAttempts = 0;
      this.reconnectTimer = null;
      this.pingTimer = null;
      this.pollTimer = null;
      this.processedTipIds = new Set();
      this.broadcastChannel = null;

      this.initBroadcast();

      // Aguarda carregamento de scripts para iniciar conexão
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.init());
      } else {
        setTimeout(() => this.init(), 100);
      }

      window.addEventListener('dec4land_config_updated', () => {
        if (this.status !== 'connected') {
          this.connect();
        }
      });
    }

    initBroadcast() {
      try {
        if ('BroadcastChannel' in window) {
          this.broadcastChannel = new BroadcastChannel('dec4land_stream_alerts');
        }
      } catch (e) {
        console.warn('[StreamElements] BroadcastChannel não suportado:', e);
      }
    }

    getCredentials() {
      const cfg = Object.assign({}, window.DEC4LAND_CONFIG || {}, window.DEC4LAND_LOCAL_CONFIG || {});
      const urlParams = new URLSearchParams(window.location.search);

      const accountId = (
        urlParams.get('se_account') ||
        localStorage.getItem('dec4land_se_account_id') ||
        cfg.streamelementsAccountId ||
        ''
      ).trim();

      const token = (
        urlParams.get('se_token') ||
        localStorage.getItem('dec4land_se_token') ||
        cfg.streamelementsToken ||
        ''
      ).trim();

      return { accountId, token };
    }

    saveCredentials(accountId, token) {
      if (accountId) localStorage.setItem('dec4land_se_account_id', accountId.trim());
      if (token) localStorage.setItem('dec4land_se_token', token.trim());
      this.connect();
    }

    onStatusChange(callback) {
      if (typeof callback === 'function') {
        this.statusListeners.add(callback);
        callback(this.status, this.statusMessage);
      }
    }

    updateStatus(newStatus, msg = '') {
      this.status = newStatus;
      this.statusMessage = msg;
      console.log(`[StreamElements] Status: ${newStatus.toUpperCase()} - ${msg}`);

      this.statusListeners.forEach(cb => {
        try { cb(newStatus, msg); } catch(e) {}
      });

      try {
        window.dispatchEvent(new CustomEvent('dec4land_streamelements_status', {
          detail: { status: newStatus, message: msg }
        }));
      } catch(e) {}
    }

    formatCurrency(amount, currency = 'BRL') {
      const num = parseFloat(amount) || 0;
      if (currency === 'BRL') {
        return `R$ ${num.toFixed(2).replace('.', ',')}`;
      } else if (currency === 'USD') {
        return `$ ${num.toFixed(2)}`;
      } else if (currency === 'EUR') {
        return `€ ${num.toFixed(2).replace('.', ',')}`;
      }
      return `${currency} ${num.toFixed(2)}`;
    }

    init() {
      const { accountId, token } = this.getCredentials();
      if (!accountId || !token) {
        this.updateStatus('unconfigured', 'Account ID ou JWT Token não informados.');
        return;
      }
      this.connect();
    }

    connect() {
      const { accountId, token } = this.getCredentials();
      if (!accountId || !token) {
        this.updateStatus('unconfigured', 'Configure suas credenciais no painel.');
        return;
      }

      this.disconnect();
      this.updateStatus('connecting', 'Conectando ao gateway Astro StreamElements...');

      try {
        this.ws = new WebSocket('wss://astro.streamelements.com/');

        this.ws.onopen = () => {
          console.log('[StreamElements] Conexão WebSocket aberta. Aguardando welcome...');
        };

        this.ws.onmessage = (event) => {
          this.handleSocketMessage(event.data, accountId, token);
        };

        this.ws.onerror = (err) => {
          console.warn('[StreamElements] Erro no WebSocket:', err);
        };

        this.ws.onclose = (event) => {
          console.log('[StreamElements] Conexão encerrada pelo servidor. Código:', event.code);
          this.cleanupTimers();
          if (this.status !== 'unconfigured') {
            this.updateStatus('disconnected', 'Conexão perdida. Tentando reconectar...');
            this.scheduleReconnect();
          }
        };

      } catch (err) {
        console.error('[StreamElements] Falha ao iniciar WebSocket:', err);
        this.updateStatus('error', 'Falha ao conectar: ' + err.message);
        this.scheduleReconnect();
      }

      // Inicia polling de fallback e sincronização inicial via API REST
      this.startPolling(accountId, token);
    }

    handleSocketMessage(rawMessage, accountId, token) {
      try {
        const msg = JSON.parse(rawMessage);
        if (!msg) return;

        // 1. Mensagem de Boas-Vindas -> Inscrever no tópico channel.activities
        if (msg.type === 'welcome') {
          console.log('[StreamElements] Welcome recebido. Inscrevendo em channel.activities...');
          const subscribePayload = {
            type: 'subscribe',
            nonce: 'dec4land_' + Date.now(),
            data: {
              topic: 'channel.activities',
              room: accountId,
              token: token,
              token_type: 'jwt'
            }
          };
          this.ws.send(JSON.stringify(subscribePayload));
          this.startHeartbeat();
          return;
        }

        // 2. Resposta de Inscrição confirmada
        if (msg.type === 'response') {
          if (msg.data && msg.data.message && msg.data.message.includes('successfully subscribed')) {
            this.reconnectAttempts = 0;
            this.updateStatus('connected', 'Conectado! Pronto para receber Pix e doações em tempo real.');
          }
          return;
        }

        // 3. Evento de Atividade (Doação / Tip / Pix)
        if (msg.type === 'event' || msg.topic === 'channel.activities') {
          const payload = msg.data || msg.payload;
          if (payload) {
            this.handleActivityEvent(payload);
          }
        }
      } catch (err) {
        console.warn('[StreamElements] Erro ao processar mensagem do WebSocket:', err);
      }
    }

    handleActivityEvent(activity) {
      if (!activity) return;

      const actType = (activity.type || '').toLowerCase();
      // Filtra por eventos de doação (tip / donation)
      if (actType === 'tip' || actType === 'donation') {
        const data = activity.data || {};
        const tipId = activity._id || activity.id || `${data.username}_${data.amount}_${activity.createdAt || Date.now()}`;

        if (this.processedTipIds.has(tipId)) {
          return; // Já processado
        }
        this.processedTipIds.add(tipId);

        const username = data.username || data.user || 'Apoiador Pix';
        const rawAmount = data.amount || 0;
        const currency = data.currency || 'BRL';
        const formattedAmount = this.formatCurrency(rawAmount, currency);
        const message = data.message || '';

        console.log(`[StreamElements] ★ NOVO PIX / DONATE RECEBIDO! ${username} - ${formattedAmount}`);
        this.dispatchDonation({
          id: tipId,
          user: username,
          amount: formattedAmount,
          rawAmount: rawAmount,
          currency: currency,
          message: message,
          createdAt: activity.createdAt || new Date().toISOString()
        });
      }
    }

    dispatchDonation(donData) {
      const hudText = `${donData.user} (${donData.amount})`;

      // 1. Salva no localStorage para persistência cross-tab e OBS restart
      try {
        localStorage.setItem('dec4land_real_donate', hudText);
      } catch(e) {}

      // 2. Atualiza via BroadcastChannel para sincronizar todas as cenas abertas no OBS
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            action: 'update_hud_info',
            donate: hudText
          });
          this.broadcastChannel.postMessage({
            action: 'trigger_alert',
            payload: {
              id: donData.id,
              type: 'donation',
              user: donData.user,
              amount: donData.amount,
              message: donData.message,
              detail: `doou <b>${donData.amount}</b> pelo Pix!`
            }
          });
        } catch(e) {}
      }

      // 3. Se a cena atual tiver window.updateDonate (ex: gameplay.html, conversa.html, react.html), chama diretamente
      if (typeof window.updateDonate === 'function') {
        window.updateDonate(donData.user, donData.amount);
      }
    }

    startHeartbeat() {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          } catch(e) {}
        }
      }, 30000);
    }

    startPolling(accountId, token) {
      if (this.pollTimer) clearInterval(this.pollTimer);

      const checkTips = async (isInitial = false) => {
        try {
          const res = await fetch(`https://api.streamelements.com/kappa/v2/tips/${accountId}?limit=5`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              this.updateStatus('error', 'Token JWT inválido ou expirado.');
            }
            return;
          }

          const json = await res.json();
          const docs = json.docs || [];
          if (docs.length === 0) return;

          // Se for a carga inicial, registra TODOS os docs históricos para nunca disparar alerta antigo
          if (isInitial) {
            docs.forEach(d => {
              if (d && d._id) this.processedTipIds.add(d._id);
            });
            this.sessionStartTime = Date.now();

            const first = docs[0];
            const don = first.donation || {};
            const user = don.user?.username || 'Apoiador';
            const formatted = this.formatCurrency(don.amount, don.currency);

            // Se o letreiro atual estiver vazio ou com o traço '-', sincroniza silenciosamente com o último doador real
            const currentVal = localStorage.getItem('dec4land_real_donate') || '';
            if (!currentVal || currentVal === '-' || currentVal.includes('Marcel')) {
              const text = `${user} (${formatted})`;
              localStorage.setItem('dec4land_real_donate', text);
              if (this.broadcastChannel) {
                this.broadcastChannel.postMessage({ action: 'update_hud_info', donate: text });
              }
              if (typeof window.updateDonate === 'function') {
                window.updateDonate(user, formatted);
              }
            }
            return;
          }

          // Verificação de novas doações recebidas em tempo real
          for (let i = docs.length - 1; i >= 0; i--) {
            const item = docs[i];
            const tipId = item._id;
            const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;

            // Ignora se já foi processado ou se for uma doação histórica de antes da sessão iniciar
            if (this.processedTipIds.has(tipId)) continue;
            this.processedTipIds.add(tipId);

            if (this.sessionStartTime && itemTime && itemTime < (this.sessionStartTime - 30000)) {
              continue; // Doação anterior à abertura da live
            }

            const don = item.donation || {};
            const user = don.user?.username || 'Apoiador Pix';
            const formatted = this.formatCurrency(don.amount, don.currency);

            this.dispatchDonation({
              id: tipId,
              user: user,
              amount: formatted,
              rawAmount: don.amount,
              currency: don.currency || 'BRL',
              message: don.message || '',
              createdAt: item.createdAt
            });
          }
        } catch (err) {
          // Erro de rede pontual no polling: não trava o WebSocket
        }
      };

      // Executa a primeira checagem imediatamente
      checkTips(true);

      // Polling de segurança a cada 20 segundos
      this.pollTimer = setInterval(() => checkTips(false), 20000);
    }

    scheduleReconnect() {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      const delay = Math.min(30000, 2000 * Math.pow(1.5, this.reconnectAttempts));
      this.reconnectAttempts++;
      console.log(`[StreamElements] Reconexão agendada para daqui a ${Math.round(delay/1000)}s...`);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    }

    cleanupTimers() {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.pollTimer) clearInterval(this.pollTimer);
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    }

    disconnect() {
      this.cleanupTimers();
      if (this.ws) {
        try {
          this.ws.onopen = null;
          this.ws.onmessage = null;
          this.ws.onerror = null;
          this.ws.onclose = null;
          this.ws.close();
        } catch(e) {}
        this.ws = null;
      }
    }

    simulateTestTip(user = 'Lucas_Apoiador', amount = '25,00', message = 'Manda um salve pra galera da live!') {
      const tipData = {
        id: 'test_tip_' + Date.now(),
        user: user,
        amount: String(amount).includes('R$') ? amount : `R$ ${amount}`,
        message: message
      };
      this.dispatchDonation(tipData);
    }
  }

  // Instancia singleton global
  window.dec4landStreamElements = new StreamElementsClient();
})(window);
