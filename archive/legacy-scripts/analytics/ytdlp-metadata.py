"""Checkout-local yt-dlp wrapper: retain the source music ID discarded by CLI output.
Uses the already-installed yt-dlp runtime; changes no installed packages.
"""
import re
import sys
from urllib.parse import quote
import yt_dlp
from yt_dlp.extractor.tiktok import TikTokBaseIE


def with_music(original):
    def parse(self, detail, *args, **kwargs):
        result = original(self, detail, *args, **kwargs)
        music = detail.get('music') or {}
        music_id = str(music.get('id') or music.get('mid') or '')
        if re.fullmatch(r'\d+', music_id):
            # TikTok routes sounds by this observed numeric ID; slug is descriptive.
            title = str(music.get('title') or 'original sound')
            slug = quote(re.sub(r'\s+', '-', title.strip()), safe='-')
            result['music_url'] = f'https://www.tiktok.com/music/{slug}-{music_id}'
            result['music_id'] = music_id
        return result
    return parse


for method in ('_parse_aweme_video_app', '_parse_aweme_video_web'):
    original = getattr(TikTokBaseIE, method, None)
    if original:
        setattr(TikTokBaseIE, method, with_music(original))

if __name__ == '__main__':
    yt_dlp.main(sys.argv[1:])
