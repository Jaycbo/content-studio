# Save to Luxeva — Chrome test build 0.1.0

1. Unzip this folder. In Chrome, open chrome://extensions, enable Developer mode, choose Load unpacked, and select the folder containing manifest.json.
2. Pin Save to Luxeva to the toolbar. Open https://content-studio-pilot.blueslug16.chatgpt.site in the SAME Chrome profile and sign in with the account that owns the studio.
3. If your model profiles are in the Codex in-app browser, use Export all models there, then Restore all models in Chrome. Reference records are online; model profiles/plans are still browser-local.
4. Open a TikTok video on your laptop. Click Save to Luxeva. Check the URL/caption, then Open save screen. Select models if desired and press Save reference in the studio.
5. Open Reference library. Use Manage to assign more models, create/open an idea, or mark the reference used.

The extension does not sync TikTok bookmarks. It captures only a post you explicitly select. It does not save until you confirm in the studio. On an ambiguous feed, open the individual post first. You can always paste a full TikTok URL as a fallback. Shortened share links must be opened in the browser first.

Only activeTab and scripting permissions are requested. No background collection, browsing history permission, cookies, credentials, video downloads, or third-party analytics. The chosen link and optional public caption/audio link are transferred in a URL fragment to the studio, removed from its address bar after loading, and held temporarily in that tab until saved. Close the tab to discard an unfinished capture.

The shared library saves: canonical link/video ID, creator handle, caption (up to 1,000 characters), reason, note (500 characters), optional sound link, saved/expiry timestamps, saver ID, and model ID/name/status assignments. No thumbnails, videos, metrics snapshots, or transcripts are stored. Previews load directly from TikTok on demand. TikTok may remove or restrict originals.

Unassigned references expire after 60 days; cleanup runs when the library is opened, not on a background schedule. Assigned references are retained, with Used separate from the default Inbox. Removing the last assignment starts a fresh 60-day window. Reference deletion is permanent and only allowed after unassigning. Model ideas already created retain their original reference URL.

The site remains owner-private. This build does not grant other team members access. If Chrome is managed by an organization, developer extensions may be disabled. To uninstall, remove Save to Luxeva on Chrome's Extensions page. Saved studio references are unaffected.
