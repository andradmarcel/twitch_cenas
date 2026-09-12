// DEC4LAND Stream Suite - Reusable Twitch IRC Chat Client
// Lightweight, resilient, and optimized for OBS Studio CEF
(function(window) {
  'use strict';

  class TwitchIrcClient {
    constructor(options = {}) {
      this.channel = (options.channel || 'dec4land').toLowerCase().replace(/^@|^#/, '').trim();
      this.onMessage = options.onMessage || null;
      this.onNotice = options.onNotice || null;
      this.onStatusChange = options.onStatusChange || null;

      this.ws = null;
      this.reconnectTimer = null;
      this.reconnectInterval = options.reconnectInterval || 5000;
      this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
      this.isConnected = false;
    }

    setStatus(status, message = '') {
      this.status = status;
      this.isConnected = (status === 'connected');
      if (typeof this.onStatusChange === 'function') {
        try {
          this.onStatusChange(status, message);
        } catch(e) {
          console.error('[TwitchIRC] Status callback error:', e);
        }
      }
    }

    connect() {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      this.setStatus('connecting', 'CONECTANDO...');

      try {
        this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      } catch (err) {
        this.setStatus('error', 'FALHA DE REDE');
        this.scheduleReconnect();
        return;
      }

      this.ws.onopen = () => {
        const randomNick = 'justinfan' + Math.floor(Math.random() * 80000 + 10000);
        this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        this.ws.send('PASS SCHMOOPIIE');
        this.ws.send(`NICK ${randomNick}`);
        this.ws.send(`JOIN #${this.channel}`);

        this.setStatus('connected', `AO VIVO (#${this.channel})`);
        console.log(`[TwitchIRC] Conectado ao chat do canal #${this.channel}`);
      };

      this.ws.onmessage = (e) => {
        const lines = e.data.split('\r\n');
        lines.forEach(line => {
          if (!line) return;
          this.parseIrcLine(line);
        });
      };

      this.ws.onerror = () => {
        this.setStatus('error', 'ERRO NO CHAT');
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected', 'DESCONECTADO');
        this.scheduleReconnect();
      };
    }

    scheduleReconnect() {
      if (this.reconnectTimer) return;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        console.log('[TwitchIRC] Tentando reconectar...');
        this.connect();
      }, this.reconnectInterval);
    }

    disconnect() {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.setStatus('disconnected', 'DESCONECTADO');
    }

    parseIrcLine(line) {
      if (line.startsWith('PING')) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('PONG :tmi.twitch.tv');
        }
        return;
      }

      let tags = {};
      let rest = line;

      if (line.startsWith('@')) {
        const spaceIdx = line.indexOf(' ');
        if (spaceIdx !== -1) {
          tags = TwitchIrcClient.parseTags(line.substring(1, spaceIdx));
          rest = line.substring(spaceIdx + 1);
        }
      }

      // PRIVMSG (Live Chat Message)
      if (rest.includes(' PRIVMSG ')) {
        const colonIdx = rest.indexOf(' :');
        const messageText = colonIdx !== -1 ? rest.substring(colonIdx + 2) : '';

        let username = tags['display-name'];
        if (!username) {
          const match = rest.match(/^:([^!@\s]+)/);
          username = match ? match[1] : 'Viewer';
        }
        const displayName = tags['display-name'] || username;
        const color = tags['color'] || '';
        const rawBadges = (tags['badges'] || '').split(',').filter(Boolean);
        const badgesMap = {};
        rawBadges.forEach(b => {
          const [bName] = b.split('/');
          badgesMap[bName] = true;
        });

        const emotesTag = tags['emotes'] || '';
        const emotesHtml = TwitchIrcClient.formatEmotes(messageText, emotesTag);

        // Highlight tags
        let highlight = '';
        if (rawBadges.some(b => b.startsWith('broadcaster'))) highlight = 'broadcaster';
        else if (tags['bits']) highlight = 'bits';
        else if (rawBadges.some(b => b.startsWith('subscriber'))) highlight = 'sub';
        else if (rawBadges.some(b => b.startsWith('vip'))) highlight = 'vip';

        if (typeof this.onMessage === 'function') {
          try {
            this.onMessage({
              username,
              displayName,
              message: messageText,
              color,
              badges: rawBadges,
              badgesMap,
              emotes: emotesTag,
              emotesHtml,
              highlight,
              bits: tags['bits'] || null,
              tags
            });
          } catch(err) {
            console.error('[TwitchIRC] Error in onMessage callback:', err);
          }
        }
      }

      // USERNOTICE (Subs, Resubs, Raids, Subgifts)
      else if (rest.includes(' USERNOTICE ')) {
        const colonIdx = rest.indexOf(' :');
        const messageText = colonIdx !== -1 ? rest.substring(colonIdx + 2) : '';
        const msgId = tags['msg-id'] || '';
        const user = tags['display-name'] || tags['login'] || 'Viewer';
        const months = tags['msg-param-cumulative-months'] || '1';
        const viewers = tags['msg-param-viewerCount'] || '10';
        const recipient = tags['msg-param-recipient-display-name'] || 'um espectador';

        if (typeof this.onNotice === 'function') {
          try {
            this.onNotice({
              msgId,
              user,
              months,
              viewers,
              recipient,
              message: messageText,
              tags
            });
          } catch(err) {
            console.error('[TwitchIRC] Error in onNotice callback:', err);
          }
        }
      }
    }

    // Static Utilities
    static parseTags(rawTags) {
      const tags = {};
      if (!rawTags) return tags;
      rawTags.split(';').forEach(tag => {
        const eq = tag.indexOf('=');
        if (eq !== -1) tags[tag.substring(0, eq)] = tag.substring(eq + 1);
      });
      return tags;
    }

    static escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    static formatEmotes(text, emotesTag) {
      if (!emotesTag) return TwitchIrcClient.escapeHtml(text);

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
  }

  // Export to window
  window.TwitchIrcClient = TwitchIrcClient;

})(window);
