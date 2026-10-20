import yt_dlp

def download_profile_videos(url, max_videos=30):
    ydl_opts = {
        # Organize downloads into a folder named after the creator
        'outtmpl': '%(uploader)s/%(upload_date)s_%(id)s.%(ext)s',
        
        # Limit the download to the most recent 30 videos
        'playlistend': max_videos,
        
        # Pull cookies from Chrome to bypass Instagram/TikTok login barriers
        # Change 'chrome' to 'safari', 'firefox', or 'edge' if you use a different browser
        'cookiesfrombrowser': ('chrome',), 
        
        # Add a 2-second delay between requests to prevent IP/account blocks
        'sleep_requests': 2, 
        
        # Skip private/deleted videos without stopping the entire run
        'ignoreerrors': True, 
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        print(f"Starting download for up to {max_videos} videos from: {url}")
        ydl.download([url])

if __name__ == "__main__":
    target_url = input("Enter the TikTok or Instagram Profile URL: ")
    download_profile_videos(target_url, max_videos=30)

