# 🎬 DEC4LAND Twitch Stream Suite - Cenas para OBS Studio

Pacote profissional de cenas e overlays para Twitch em resolução **Full HD (1920x1080)**, desenvolvido com base na identidade visual, cores e mascote da marca **DEC4LAND**.

---

## 🚀 Como Visualizar Agora Mesmo

Você pode abrir o arquivo `index.html` diretamente em qualquer navegador (Chrome, Edge, Firefox, Brave) para testar as cenas ao vivo:

👉 **[Abrir Central de Cenas (index.html)](./index.html)**

---

## 📦 As 3 Cenas Criadas

### 1. ⏳ Live Começando (`starting.html`)
- **Resolução**: 1920x1080 Full HD
- **Recursos**:
  - Logo estilizada **DEC4LAND** com efeito de contorno vermelho offset (fiel à imagem de referência).
  - Mascote cavalo bombado com óculos de sol, respiração e aura neon carmesim.
  - Cronômetro regressivo dinâmico (inicia em 5 minutos por padrão).
  - Barra de progresso neon sincronizada.
  - Rotação dinâmica de mensagens de status.
  - Redes sociais da imagem: `@DEC4LANDOFICIAL` (Twitter), `@ANDRADMARCEL` (Instagram), `/DEC4LAND` (YouTube).
  - Equalizador de áudio animado idêntico ao elemento do canto inferior da referência.
- **Parâmetros personalizáveis via URL**:
  - `starting.html?time=10` (define 10 minutos de contagem)
  - `starting.html?title=VAI+COMECAR` (altera o título)
- **Atalhos de Teclado no Navegador**:
  - `Espaço`: Pausar / Continuar o cronômetro
  - `R`: Reiniciar o cronômetro
  - `Seta Cima / Seta Baixo`: Adicionar / subtrair 1 minuto

---

### 2. 🎮 Gameplay Overlay (`gameplay.html`)
- **Resolução**: 1920x1080 Full HD
- **Fundo**: 100% Transparente (o jogo do OBS aparece perfeitamente por baixo)
- **Recursos**:
  - Moldura de Webcam 16:9 estilizada com cantoneiras cibernéticas, laser animado, badge DEC4LAND e indicador LIVE.
  - Mini selo do mascote e redes sociais compactas integradas à moldura.
  - Letreiros dinâmicos no rodapé da câmera com **Último Follow**, **Último Donate** e **Último Sub**, atualizados em tempo real via eventos da Twitch e alertas.
  - Camada de alertas visuais e sonoros sincronizada via Web Audio API e BroadcastChannel.
  - Área da gameplay 100% livre e transparente para captura de jogo limpa e desobstruída no OBS.
- **Como Conectar aos Eventos da Twitch**:
  - **Pelo Painel (`index.html`)**: Digite o nome do seu canal no topo da tela e clique em **Conectar**.
  - **No OBS Studio via URL**: Adicione o parâmetro `?channel=seu_canal` na URL da fonte do navegador:
    ```text
    http://localhost:8080/gameplay.html?channel=dec4land
    ```
    *(ou `file:///c:/Users/Marcel/Documents/twitch_cenas/gameplay.html?channel=dec4land`)*
- **Outros Parâmetros Personalizáveis via URL**:
  - `?pos=top-left` (ou `top-right`, `bottom-left`, `bottom-right` para mover a moldura)
  - `?name=DEC4LAND` (altera o nome na câmera)
  - `?social=@SEUCANAL` (altera o @ da rede social)
  - `?follow=nome` / `?donate=nome` / `?sub=nome` (define valores fixos iniciais)
  - `?mock=true` (ativa rotação demonstrativa de nomes de exemplo)

---

### 3. ☕ Já Volto / Be Right Back (`brb.html`)
- **Resolução**: 1920x1080 Full HD
- **Recursos**:
  - Título principal **JÁ VOLTO!** com tag animada `// PAUSA RÁPIDA` e efeito neon glow.
  - Cronômetro de intervalo dinâmico (inicia em 3 minutos por padrão) com barra de progresso neon com ponto de luz em corrida.
  - **Medidor Animado de Hidratação / Estamina**: barra estilo RPG cibernético com fluxo de energia pulsante e recarga gradual durante a pausa.
  - **Tocador BGM "Tocando Agora"**: mini player synthwave com equalizador sonoro de barras animadas reativas e letreiro marquee da música.
  - **Mascote Holográfico em Modo Standby**: mascote flutuando com aura carmesim pulsante, anéis 3D girando em eixos opostos e laser scanner holográfico contínuo.
  - Rotação de frases dinâmicas de pausa e postura no ticker inferior.
  - Redes sociais e equalizador de áudio no rodapé.
- **Parâmetros personalizáveis via URL**:
  - `brb.html?time=5` (define 5 minutos de intervalo)
  - `brb.html?title=PAUSA+RAPIDA` (muda a mensagem de título)
- **Atalhos de Teclado no Navegador / OBS**:
  - `Espaço`: Pausar / Continuar a contagem
  - `R`: Reiniciar o cronômetro
  - `M`: Alternar modo (Regressivo vs Tempo AFK decorrido)
  - `Seta Cima / Seta Baixo`: Adicionar / subtrair 1 minuto

---

### 4. 🚨 Alertas Personalizados da Twitch (`alerts.html` e embutido em `gameplay.html`)
- **Resolução**: 1920x1080 Full HD (Transparente)
- **Tipos de Alerta com Identidade Visual Própria**:
  - **★ Novo Seguidor**: Borda ciano/azul neon elétrico com efeito laser.
  - **💎 Novo Sub / Resub**: Borda dourada/rubi com celebração triunfante e badge do Tier/meses.
  - **💵 Doação / Pix**: Borda verde esmeralda neon com destaque para o valor do Pix e mensagem do viewer.
  - **⚡ Cheer de Bits**: Borda magenta/roxa neon com arpeggio futurista e quantidade de bits.
  - **🚨 Raid / Host**: Alerta vermelho sirene estilo hazard com contagem de espectadores.
- **Sintetizador de Áudio Nativo (Web Audio API)**:
  - Não depende de arquivos MP3 externos (funciona 100% offline e sem erro de carregamento no OBS).
  - Cada tipo de alerta possui um timbre exclusivo (fanfarra de vitória para subs, som de moedas/cash para doações, laser arpeggio para bits).
- **Fila de Exibição Inteligente**:
  - Se chegarem 3 alertas ao mesmo tempo, eles tocam um após o outro ordenadamente sem sobreposição.
- **Como Testar em Tempo Real**:
  - Abra o [`index.html`](./index.html) e use os botões da seção **TESTADOR DE ALERTAS EM TEMPO REAL**. Qualquer janela do OBS ou navegador aberta receberá e tocará o alerta instantaneamente!

---

### 4. 🏁 Encerramento de Live (`ending.html`)
- **Resolução**: 1920x1080 Full HD
- **Recursos**:
  - Título principal **MUITO OBRIGADO! // LIVE FINALIZADA**.
  - Mascote em grande destaque com iluminação ambiente.
  - Cartões destacados de redes sociais (Twitter, Instagram e YouTube) com rotação sutil de brilho neon.
  - Mensagem calorosa de despedida para os viewers.
  - Equalizador e HUD cibernético.
- **Parâmetros personalizáveis via URL**:
  - `ending.html?title=VALEU+DEMAIS`

---

## 🛠️ Passo a Passo para Configurar no OBS Studio

### Configuração Recomendada (Browser Source / Navegador):

1. Abra o **OBS Studio**.
2. No quadro **Cenas**, crie ou selecione uma cena (ex: `Live Começando`).
3. No quadro **Fontes**, clique no botão **`+`** e selecione **Navegador (Browser)**.
4. Nomeie a fonte (ex: `Overlay Começando`) e clique em **OK**.
5. Na janela de propriedades:
   - Marque a caixa **Arquivo local** e clique em **Localizar**.
   - Selecione o arquivo `starting.html` da pasta `twitch_cenas`.
   - Defina **Largura: `1920`**
   - Defina **Altura: `1080`**
   - Marque: **"Desativar fonte quando não visível"** e **"Atualizar o navegador quando a cena se tornar ativa"**.
6. Clique em **OK**.

### Para a Cena de Gameplay:
1. Adicione a fonte do **Navegador** apontando para `gameplay.html` (1920x1080).
2. Adicione sua **Captura de Jogo** (ou Captura de Janela/Tela).
3. Adicione seu **Dispositivo de Captura de Vídeo** (sua Webcam).
4. No painel **Fontes**, ordene as camadas de cima para baixo:
   - 🔝 **Overlay Gameplay** (Navegador) - *no topo*
   - 📷 **Webcam** - *ajustada dentro da moldura da câmera no canto superior direito*
   - 🎮 **Captura de Jogo** - *no fundo*
