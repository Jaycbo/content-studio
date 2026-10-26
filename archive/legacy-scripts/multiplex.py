import os, sys, random, subprocess, json

HOOKS = [
    "Be honest, is this outfit a red flag?",
    "He told me to change before we went out",
    "Would you notice me if I walked past you?",
    "My mom said this dress is too much for dinner",
    "Did I pass the 3-second test?",
    "Tell me the truth, does this color work on me?",
    "Rate the fit 1 to 10, be honest",
    "POV: You caught me checking myself out",
    "If you saw me in public would you say hi?",
    "First impression in 3 words or less"
]

def multiplex_video(input_file, output_dir="output_multiplex", target_clips=3):
    if not os.path.exists(input_file):
        print(f"Error: Could not find '{input_file}'")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Probe source duration
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", input_file]
    probe = subprocess.run(cmd, capture_output=True, text=True)
    try:
        total_sec = float(json.loads(probe.stdout)["format"]["duration"])
    except Exception as e:
        print(f"Error reading video metadata: {e}")
        sys.exit(1)
        
    print(f"🎬 Multiplexing '{input_file}' ({total_sec:.1f}s) into {target_clips} unique micro-clips...")
    
    clip_len = 5.5  # Optimal micro-loop duration
    step = max(1.5, (total_sec - clip_len) / target_clips) if total_sec > clip_len else 1.0
    
    manifest = []
    
    for i in range(target_clips):
        start_time = i * step
        if start_time + clip_len > total_sec and i > 0:
            break
            
        hook = random.choice(HOOKS)
        clip_filename = f"clip_{i+1:02d}.mp4"
        out_name = os.path.join(output_dir, clip_filename)
        
        # Algorithmic Deduplication Variables (breaks pHash & frame-fingerprinting)
        crop_px = random.choice([4, 6, 8, 10])
        speed = round(random.uniform(0.985, 1.015), 3)
        pts = round(1.0 / speed, 4)
        bright = round(random.uniform(-0.015, 0.015), 3)
        sat = round(random.uniform(0.98, 1.03), 3)
        crf = random.randint(20, 23)
        
        # Pure geometric & color perturbation filter chain (No libfreetype dependency)
        vf = (
            f"crop=iw-{crop_px}:ih-{crop_px}:{crop_px//2}:{crop_px//2},"
            f"eq=brightness={bright}:saturation={sat},"
            f"setpts={pts}*PTS"
        )
        
        # Audio pitch/speed compensation
        af = f"asetrate=44100*{speed},aresample=44100"
        
        ff_cmd = [
            "ffmpeg", "-y", "-ss", str(round(start_time, 2)), "-t", str(clip_len),
            "-i", input_file,
            "-vf", vf, "-af", af,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", str(crf),
            "-c:a", "aac", "-b:a", "128k",
            "-map_metadata", "-1",
            out_name
        ]
        
        res = subprocess.run(ff_cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"  ✓ Rendered {clip_filename} | Start: {start_time:.1f}s | Speed: {speed}x | Assigned Hook: \"{hook}\"")
            manifest.append({
                "clip": clip_filename,
                "hook": hook,
                "pinned_comment": "Checking DMs on the 📸 app today (link in bio)",
                "speed": speed
            })
        else:
            print(f"  ✗ Failed rendering {clip_filename}: {res.stderr.splitlines()[-1] if res.stderr else 'unknown error'}")

    # Write companion dispatch manifest
    manifest_path = os.path.join(output_dir, "dispatch_manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n✨ Generation finished. Clips and dispatch manifest saved to '{output_dir}/'.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/multiplex.py <path_to_video.mp4> [output_dir] [target_clips]")
    else:
        out_dir = sys.argv[2] if len(sys.argv) > 2 else "output_multiplex"
        clips = int(sys.argv[3]) if len(sys.argv) > 3 else 3
        multiplex_video(sys.argv[1], out_dir, clips)
