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
  twitchClientId: "gp762nuuoqcoxypju8c569th9wz7q5",
  twitchOAuthToken: "", // Mantenha vazio aqui. Seu token real fica seguro no config.local.js

  // StreamElements & LivePix (Alertas de Pix/Doação e Atualização do ÚLTIMO DONATE)
  streamelementsAccountId: "",
  streamelementsToken: "",

  // Letreiros Iniciais das Molduras (Último Follow, Donate, Sub)
  latestFollower: "laktas1",
  latestDonate: "-",
  latestSub: "amahzy (Gift)",

  // Bot de Boas-Vindas no Chat da Twitch
  welcomeBotEnabled: true,
  welcomeBotMessage: "Seja muito bem-vindo(a) à tropa, @{user}! Valeu pelo follow! 🚀🔥",

  // Volume dos alertas visuais e sonoros (0.0 mudo até 1.0 volume máximo)
  alertVolume: 0.8
};

window.DEC4LAND_CONFIG = Object.assign({}, baseConfig, window.DEC4LAND_CONFIG || {}, window.DEC4LAND_LOCAL_CONFIG || {});

// Carrega automaticamente o config.local.js se existir na pasta e ainda não estiver carregado/presente no DOM
(function() {
  if (typeof document !== 'undefined') {
    if (window.DEC4LAND_LOCAL_CONFIG || window._dec4landLocalConfigLoaded || document.querySelector('script[src*="config.local.js"]')) {
      window._dec4landLocalConfigLoaded = true;
      return;
    }
    window._dec4landLocalConfigLoaded = true;
    const s = document.createElement('script');
    s.src = 'config.local.js';
    s.onload = function() {
      if (window.DEC4LAND_LOCAL_CONFIG) {
        window.DEC4LAND_CONFIG = Object.assign({}, window.DEC4LAND_CONFIG, window.DEC4LAND_LOCAL_CONFIG);
        window.dispatchEvent(new CustomEvent('dec4land_config_updated'));
      }
    };
    s.onerror = function() {
      // Arquivo opcional: sem erro se não existir
    };
    document.head.appendChild(s);
  }
})();

