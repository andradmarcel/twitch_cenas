import subprocess
import os
import shutil
import concurrent.futures
import time
import tempfile
import threading
import http.server
import socketserver
import imageio_ffmpeg

def find_browser_executable():
    """Detecta dinamicamente o executável do Chrome, Edge, Brave ou Chromium no sistema."""
    # 1. Verifica no PATH do sistema operacional
    for name in ["chrome", "google-chrome", "chromium", "msedge", "brave"]:
        found = shutil.which(name)
        if found:
            return found

    # 2. Verifica locais padrão conhecidos no Windows
    candidates = [
        os.path.expandvars(r'%ProgramFiles%\Google\Chrome\Application\chrome.exe'),
        os.path.expandvars(r'%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe'),
        os.path.expandvars(r'%LocalAppData%\Google\Chrome\Application\chrome.exe'),
        os.path.expandvars(r'%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe'),
        os.path.expandvars(r'%ProgramFiles%\Microsoft\Edge\Application\msedge.exe'),
        os.path.expandvars(r'%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe'),
        os.path.expandvars(r'%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe')
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p

    raise FileNotFoundError(
        "Nenhum navegador baseado em Chromium (Chrome, Edge, Brave) foi localizado no sistema. "
        "Instale o Google Chrome ou adicione o executável ao PATH."
    )

CHROME_PATH = find_browser_executable()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRAMES_DIR = os.path.join(BASE_DIR, 'scratch', 'frames')
OUTPUT_VIDEO = os.path.join(BASE_DIR, 'stinger_dec4land.webm')
FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()

TOTAL_FRAMES = 70 # 70 frames @ 60 FPS = 1.167s
INTERVAL_MS = 1000.0 / 60.0 # 16.666 ms per frame
TEMP_BASE = os.path.join(tempfile.gettempdir(), 'chrome_stinger_workers')

class QuietHTTPHandler(http.server.SimpleHTTPRequestHandler):
    """Silencia os logs de requisição GET para não poluir o terminal durante o render."""
    def log_message(self, format, *args):
        pass

def start_ephemeral_server(directory):
    """Inicia um servidor HTTP embutido efêmero com porta dinâmica para captura DOM."""
    class BoundHandler(QuietHTTPHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=directory, **kwargs)

    server = socketserver.TCPServer(('127.0.0.1', 0), BoundHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port

def render_frame(frame_idx, server_port):
    ms = int(round(frame_idx * INTERVAL_MS))
    out_file = os.path.join(FRAMES_DIR, f'frame_{frame_idx:03d}.png')
    
    # Diretório temporário único por frame evita locks de SQLite no Chromium
    profile = os.path.join(TEMP_BASE, f'prof_{frame_idx:03d}')
    os.makedirs(profile, exist_ok=True)

    cmd = [
        CHROME_PATH,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        f'--user-data-dir={profile}',
        '--window-size=1920,1080',
        '--default-background-color=00000000',
        f'--screenshot={out_file}',
        f'http://127.0.0.1:{server_port}/stinger_dom_capture.html?ms={ms}'
    ]
    
    for attempt in range(3):
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
            break
        time.sleep(0.1)

    # Limpa perfil temporário
    shutil.rmtree(profile, ignore_errors=True)
    return frame_idx

def main():
    start_time = time.time()
    print(f"[Init] Navegador detectado: {CHROME_PATH}")
    print(f"[Init] Diretório temporário do sistema: {TEMP_BASE}")

    print("[0/3] Iniciando servidor HTTP embutido efêmero...")
    server, port = start_ephemeral_server(BASE_DIR)
    print(f"[0/3] Servidor ativo em http://127.0.0.1:{port}")

    try:
        print("[1/3] Preparando diretório de frames...")
        shutil.rmtree(FRAMES_DIR, ignore_errors=True)
        shutil.rmtree(TEMP_BASE, ignore_errors=True)
        os.makedirs(FRAMES_DIR, exist_ok=True)
        os.makedirs(TEMP_BASE, exist_ok=True)

        print(f"[2/3] Renderizando {TOTAL_FRAMES} quadros DOM em paralelo (60 FPS)...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(render_frame, i, port) for i in range(TOTAL_FRAMES)]
            for f in concurrent.futures.as_completed(futures):
                f.result()

        # Verifica e re-renderiza quadros faltantes
        rendered = [f for f in os.listdir(FRAMES_DIR) if f.endswith('.png')]
        missing = [i for i in range(TOTAL_FRAMES) if f'frame_{i:03d}.png' not in rendered]
        if missing:
            print(f"Reprocessando {len(missing)} quadros pendentes...")
            for i in missing:
                render_frame(i, port)

        final_count = len([f for f in os.listdir(FRAMES_DIR) if f.endswith('.png')])
        print(f"Concluído: {final_count}/{TOTAL_FRAMES} quadros capturados em {time.time() - start_time:.1f}s!")

        print("[3/3] Codificando vídeo master VP9 WebM com Alpha transparente + Áudio...")
        input_pattern = os.path.join(FRAMES_DIR, 'frame_%03d.png')
        audio_file = os.path.join(BASE_DIR, 'stinger_audio.wav')

        ffmpeg_cmd = [
            FFMPEG_EXE,
            '-y',
            '-framerate', '60',
            '-i', input_pattern,
            '-i', audio_file,
            '-c:v', 'libvpx-vp9',
            '-pix_fmt', 'yuva420p',
            '-auto-alt-ref', '0',
            '-b:v', '8M',
            '-crf', '24',
            '-row-mt', '1',
            '-quality', 'good',
            '-speed', '2',
            '-c:a', 'libopus',
            '-b:a', '192k',
            '-shortest',
            OUTPUT_VIDEO
        ]

        res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if res.returncode == 0 and os.path.exists(OUTPUT_VIDEO):
            size_mb = os.path.getsize(OUTPUT_VIDEO) / (1024 * 1024)
            print(f"[SUCESSO] Vídeo Stinger master gerado: {OUTPUT_VIDEO} ({size_mb:.2f} MB)")
        else:
            print("[ERRO] Falha na codificação com FFmpeg:")
            print(res.stderr)

    finally:
        server.shutdown()
        shutil.rmtree(TEMP_BASE, ignore_errors=True)

if __name__ == '__main__':
    main()
