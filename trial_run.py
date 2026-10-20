import os, sys, glob, re, json, subprocess, statistics

# 1. Setup Outlier Vault Directory
vault_dir = "./OutlierVault"
os.makedirs(vault_dir, exist_ok=True)

# 2. Identify and Archive Outlier MP4
metrics_file = "sophie_metrics_full.txt"
if not os.path.exists(metrics_file):
    print("[!] sophie_metrics_full.txt not found. Run analysis first.")
    sys.exit(1)

outlier_id = "7694476941193121038" # Sophie Rain FNAF Outlier
outlier_url = f"https://www.tiktok.com/@sophieraiin/video/{outlier_id}"

print(f"[*] Archiving outlier video: {outlier_id}...")
target_mp4 = os.path.join(vault_dir, f"sophieraiin_{outlier_id}.mp4")

# Download highest-quality single video directly into Vault
cmd_dl = ["yt-dlp", "-o", target_mp4, outlier_url]
subprocess.run(cmd_dl, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

if os.path.exists(target_mp4):
    print(f"[✓] Outlier video archived successfully: {target_mp4} ({os.path.getsize(target_mp4) / (1024*1024):.1f} MB)")
else:
    print("[!] Video download failed or link unavailable.")
    sys.exit(1)

# 3. Dense Keyframe Extraction (1 frame every 2 seconds)
frames_dir = os.path.join(vault_dir, f"frames_{outlier_id}")
os.makedirs(frames_dir, exist_ok=True)

print(f"[*] Sampling dense keyframes (fps=0.5)...")
cmd_ffmpeg = [
    "ffmpeg", "-y", "-i", target_mp4,
    "-vf", "fps=0.5",
    os.path.join(frames_dir, "frame_%03d.jpg")
]
subprocess.run(cmd_ffmpeg, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

extracted_frames = glob.glob(os.path.join(frames_dir, "*.jpg"))
print(f"[✓] Extracted {len(extracted_frames)} keyframes for visual AI analysis.")

# 4. Save Structured Vault Log
vault_entry = {
    "creator": "sophieraiin",
    "post_id": outlier_id,
    "upload_date": "2026-10-09",
    "views": 3500000,
    "multiplier": 3.2,
    "z_score": 3.88,
    "caption": "the best costume 🤩 #fnaf #fivenightsatfreddys #cosplay #halloween",
    "url": outlier_url,
    "archived_video_path": target_mp4,
    "keyframe_count": len(extracted_frames)
}

with open(os.path.join(vault_dir, "vault_catalog.json"), "w") as f:
    json.dump([vault_entry], f, indent=2)

print("\n=== TRIAL RUN COMPLETE ===")
print(f"Archived MP4: {target_mp4}")
print(f"Keyframe Folder: {frames_dir}")
print(f"Catalog Log: {os.path.join(vault_dir, 'vault_catalog.json')}")
