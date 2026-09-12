// DEC4LAND Stream Suite - Configurações Gerais
// IMPORTANTE: Não insira seus tokens privados neste arquivo se for enviar para o GitHub.
// Para credenciais privadas, use o painel (index.html) ou crie um arquivo 'config.local.js' (ignorado pelo git).

const baseConfig = {
  // Nome exato do seu canal da Twitch (letras minúsculas)
  twitchChannel: "dec4land",

  // Nome exibido na barra da câmera
  streamerName: "DEC4LAND",

  // Redes sociais exibidas nas cenas
  socialTwitter: "@DEC4LANDOFICIAL",
  socialInstagram: "@ANDRADMARCEL",
  socialYoutube: "/DEC4LAND",

  // Twitch EventSub WebSocket (Alertas de Follow, Sub, Bits, Raid em tempo real)
  twitchClientId: "",       // Ex: "gp762nuuoqcoxypju8c569th9wz7q5"
  twitchOAuthToken: ""      // Deixe vazio no repositório. Preencha em config.local.js ou no index.html
};

window.DEC4LAND_CONFIG = Object.assign({}, baseConfig, window.DEC4LAND_CONFIG || {}, window.DEC4LAND_LOCAL_CONFIG || {});

// Carrega automaticamente o config.local.js se existir na pasta
(function() {
  if (typeof document !== 'undefined' && !window._dec4landLocalConfigLoaded) {
    window._dec4landLocalConfigLoaded = true;
    const s = document.createElement('script');
    s.src = 'config.local.js';
    s.onload = function() {
      if (window.DEC4LAND_LOCAL_CONFIG) {
        window.DEC4LAND_CONFIG = Object.assign({}, window.DEC4LAND_CONFIG, window.DEC4LAND_LOCAL_CONFIG);
      }
    };
    s.onerror = function() {
      // Arquivo opcional: sem erro se não existir
    };
    document.head.appendChild(s);
  }
})();

