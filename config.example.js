// DEC4LAND Stream Suite - Exemplo de Configuração Local Privada
// Copie este arquivo para "config.local.js" e preencha com suas credenciais.
// O arquivo "config.local.js" está no .gitignore e NUNCA será enviado ao GitHub.

window.DEC4LAND_LOCAL_CONFIG = {
  // Nome exato do seu canal da Twitch (letras minúsculas)
  twitchChannel: "dec4land",

  // Nome exibido na barra da câmera
  streamerName: "DEC4LAND",

  // Redes sociais exibidas nas cenas
  socialTwitter: "@DEC4LANDOFICIAL",
  socialInstagram: "@ANDRADMARCEL",
  socialYoutube: "/DEC4LAND",

  // Twitch EventSub WebSocket (Alertas de Follow, Sub, Bits, Raid em tempo real)
  // Obtenha seu token em: https://twitchtokengenerator.com/
  // Escopos: moderator:read:followers, channel:read:subscriptions, bits:read
  twitchClientId: "gp762nuuoqcoxypju8c569th9wz7q5",
  twitchOAuthToken: "", // Cole seu token aqui

  // Letreiros Iniciais das Molduras (Último Follow, Donate, Sub)
  latestFollower: "Marcel_Gamer",
  latestDonate: "-",
  latestSub: "Marcel (Tier 1)"
};
