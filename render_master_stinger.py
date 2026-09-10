import subprocess
import os
import shutil
import concurrent.futures
import time
import imageio_ffmpeg

CHROME_PATH = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
FRAMES_DIR = os.path.abspath('scratch/frames')
OUTPUT_VIDEO = os.path.abspath('stinger_dec4land.webm')
FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()

TOTAL_FRAMES = 70 # 70 frames @ 60 FPS = 1.167s
INTERVAL_MS = 1000.0 / 60.0 # 16.666 ms per frame
TEMP_BASE = os.path.join(r'C:\Users\Marcel\AppData\Local\Temp', 'chrome_stinger_workers')

def render_frame(frame_idx):
    ms = int(round(frame_idx * INTERVAL_MS))
    out_file = os.path.join(FRAMES_DIR, f'frame_{frame_idx:03d}.png')
    
    # Unique directory per frame ensures no concurrent SQLite lock in Chrome
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
        f'http://localhost:8080/stinger_dom_capture.html?ms={ms}'
    ]
    
    for attempt in range(3):
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
            break
        time.sleep(0.1)

    # Clean profile to save disk
    shutil.rmtree(profile, ignore_errors=True)
    return frame_idx

def main():
    start_time = time.time()
    print("[1/3] Preparing frame directory...")
    shutil.rmtree(FRAMES_DIR, ignore_errors=True)
    shutil.rmtree(TEMP_BASE, ignore_errors=True)
    os.makedirs(FRAMES_DIR, exist_ok=True)
    os.makedirs(TEMP_BASE, exist_ok=True)

    print(f"[2/3] Rendering all {TOTAL_FRAMES} DOM frames in parallel (60 FPS)...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(render_frame, i) for i in range(TOTAL_FRAMES)]
        for f in concurrent.futures.as_completed(futures):
            f.result()

    # Verify all frames
    rendered = [f for f in os.listdir(FRAMES_DIR) if f.endswith('.png')]
    missing = [i for i in range(TOTAL_FRAMES) if f'frame_{i:03d}.png' not in rendered]
    if missing:
        print(f"Retrying missing frames: {missing}...")
        for i in missing:
            render_frame(i)

    final_count = len([f for f in os.listdir(FRAMES_DIR) if f.endswith('.png')])
    print(f"Done: {final_count}/{TOTAL_FRAMES} frames captured in {time.time() - start_time:.1f}s!")

    print("[3/3] Encoding master VP9 WebM with transparent Alpha + Audio via FFmpeg...")
    input_pattern = os.path.join(FRAMES_DIR, 'frame_%03d.png')
    audio_file = os.path.abspath('stinger_audio.wav')

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
        print(f"[SUCCESS] Master video created: {OUTPUT_VIDEO} ({size_mb:.2f} MB)")
    else:
        print("[ERROR] FFmpeg failed:")
        print(res.stderr)

    shutil.rmtree(TEMP_BASE, ignore_errors=True)

if __name__ == '__main__':
    main()
