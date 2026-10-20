import statistics
import re

views = []
posts = []

with open("sophie_metrics_full.txt") as f:
    for line in f:
        m = re.search(r"(\d{8}) \| Views: (\d+) \| Likes: (\d+) \| (.*) \| (https://.*)", line)
        if m:
            date, v, l, title, url = m.groups()
            v_cnt, l_cnt = int(v), int(l)
            views.append(v_cnt)
            posts.append({
                "date": date,
                "views": v_cnt,
                "likes": l_cnt,
                "title": title,
                "url": url
            })

if not views:
    print("No valid lines found in sophie_metrics_full.txt yet.")
else:
    med_views = statistics.median(views)
    devs = [abs(x - med_views) for x in views]
    mad = statistics.median(devs) if statistics.median(devs) != 0 else 1.0

    print("=== SOPHIE RAIN BASELINE METRICS ===")
    print(f"Total Posts Analyzed: {len(posts)}")
    print(f"Median Views: {med_views:,.0f}")
    print(f"Median Absolute Deviation (MAD): {mad:,.0f}\n")
    print("=== DUAL-GATE VIRAL OUTLIERS (>=3.0x Multiplier + Z-Score >= 3.0) ===")

    outliers = 0
    for p in posts:
        mult = p["views"] / med_views if med_views > 0 else 0
        mod_z = 0.6745 * (p["views"] - med_views) / mad

        if mult >= 3.0 and mod_z >= 3.0:
            outliers += 1
            print("🔥 OUTLIER FOUND!")
            print(f"   Date: {p['date']} | Views: {p['views']:,} ({mult:.1f}x Median) | Z-Score: {mod_z:.2f}")
            print(f"   Caption: {p['title']}")
            print(f"   Link: {p['url']}\n")

    if outliers == 0:
        print("No extreme outliers (>=3.0x median & Z-Score >=3.0) found in this batch of posts.")
