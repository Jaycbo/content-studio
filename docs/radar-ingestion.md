# Free local Radar

The local Vinext dev server mounts a loopback-only `/api/radar` collector. It uses the installed `yt-dlp`, with no media downloads, browser cookies, config-file settings or paid services. The project-local Python wrapper retains actual source music IDs that ordinary yt-dlp output discards and constructs a direct TikTok sound page from the observed ID. The installed package is not modified.

`SCRAPER_PROVIDER=yt-dlp` is the default. `SCRAPER_PROVIDER=public` uses best-effort HTML metadata. `YTDLP_PATH` and `YTDLP_PYTHON` optionally select existing local runtimes. Apify is deliberately disabled: `SCRAPER_PROVIDER=apify` returns a setup message and makes no paid request, even if `APIFY_TOKEN` exists. A future adapter implements `ScraperProvider.collect(url)` and is selected in `createScraperProvider`; baseline analysis and brief generation need no rewrite. Tokens belong only in server environment configuration, never browser storage.

One scan allows at most 30 targets, reads at most 31 posts per profile, runs at most two collectors concurrently and times out each CLI invocation after 45 seconds. Only metadata enters the existing bounded workspace. The newest candidate is compared to up to 30 older same-creator posts within 90 days; at least five and a positive median are required. Outliers require ≥3× median. Missing exact music identity prevents a live draft; missing counts are never converted to zero.

Quick ingest extracts the video and that creator’s recent posts. Known niche handles keep their model-specific tier; other manually selected URLs use the agency tier. Eligible active creators receive three-angle drafts automatically. Caption-derived Bones are suggestions and explicitly distinguish unknown camera distance/cut timing from observed mechanics. No LLM or video-analysis service is configured.

The demo fallback is explicit, marked in cards and clipboard text, and not persisted to source catalogs or creator queues. Its video/audio URLs are demonstration placeholders. Production Workers use the authenticated public-metadata adapter; local CLI execution is development-only. No publication was performed.
