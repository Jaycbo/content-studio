import os, glob, subprocess

vault_dir = "./OutlierVault"
outlier_id = "7694476941193121038"
target_mp4 = os.path.join(vault_dir, f"sophieraiin_{outlier_id}.mp4")

# 1. High-Density Frame Extraction (1 Frame Per Second)
dense_frames_dir = os.path.join(vault_dir, f"dense_frames_{outlier_id}")
os.makedirs(dense_frames_dir, exist_ok=True)

print(f"[*] Extracting dense keyframes (1 frame/sec)...")
cmd_ffmpeg = [
    "ffmpeg", "-y", "-i", target_mp4,
    "-vf", "fps=1",
    os.path.join(dense_frames_dir, "frame_%03d.jpg")
]
subprocess.run(cmd_ffmpeg, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

extracted_frames = sorted(glob.glob(os.path.join(dense_frames_dir, "*.jpg")))
print(f"[✓] Extracted {len(extracted_frames)} high-density keyframes!")

# 2. Extract OCR On-Screen Text if Tesseract / EasyOCR is installed
try:
    import pytesseract
    from PIL import Image

    print("\n[*] Scanning keyframes for on-screen text overlays...")
    for frame_path in extracted_frames[:10]:
        frame_name = os.path.basename(frame_path)
        text = pytesseract.image_to_string(Image.open(frame_path)).strip()
        if text:
            print(f"   [{frame_name}] On-Screen Text: '{text}'")
except ImportError:
    print("\n[!] Tesseract/pytesseract not installed locally. Video sampled into 1-second frames.")
    print(f"    You can view all {len(extracted_frames)} frames in: {dense_frames_dir}")

