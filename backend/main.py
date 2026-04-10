from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import requests
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("YOUTUBE_API_KEY")

@app.get("/health")
def health():
    return {"status": "ok", "api_key_loaded": bool(API_KEY)}

@app.get("/search")
def search(q: str, max_results: int = 10):
    # Step 1: search for videos
    search_url = "https://www.googleapis.com/youtube/v3/search"
    search_params = {
        "part": "snippet",
        "q": q,
        "type": "video",
        "maxResults": max_results,
        "order": "relevance",
        "publishedAfter": (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "key": API_KEY
    }
    search_response = requests.get(search_url, params=search_params).json()

    video_ids = [
        item["id"]["videoId"]
        for item in search_response.get("items", [])
    ]

    if not video_ids:
        return {"results": []}

    # Step 2: get video stats
    stats_url = "https://www.googleapis.com/youtube/v3/videos"
    stats_params = {
        "part": "statistics,snippet",
        "id": ",".join(video_ids),
        "key": API_KEY
    }
    stats_response = requests.get(stats_url, params=stats_params).json()

    # Step 3: collect channel IDs from results
    channel_ids = list(set([
        item.get("snippet", {}).get("channelId")
        for item in stats_response.get("items", [])
        if item.get("snippet", {}).get("channelId")
    ]))

    # Step 4: get subscriber counts for all channels in one call
    channel_stats = {}
    if channel_ids:
        channels_url = "https://www.googleapis.com/youtube/v3/channels"
        channels_params = {
            "part": "statistics",
            "id": ",".join(channel_ids),
            "key": API_KEY
        }
        channels_response = requests.get(channels_url, params=channels_params).json()
        for ch in channels_response.get("items", []):
            channel_id = ch["id"]
            subs = ch.get("statistics", {}).get("subscriberCount")
            channel_stats[channel_id] = int(subs) if subs else 0

    # Step 5: combine everything
    results = []
    for item in stats_response.get("items", []):
        stats = item.get("statistics", {})
        snippet = item.get("snippet", {})
        channel_id = snippet.get("channelId")
        subscribers = channel_stats.get(channel_id, 0)
        views = int(stats.get("viewCount", 0))

        # Small channel win = under 100K subs but over 50K views
        small_channel_win = subscribers > 0 and subscribers < 100000 and views > 50000

        results.append({
            "video_id": item["id"],
            "title": snippet.get("title"),
            "channel": snippet.get("channelTitle"),
            "channel_id": channel_id,
            "published_at": snippet.get("publishedAt"),
            "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url"),
            "views": views,
            "likes": int(stats.get("likeCount", 0)),
            "comments": int(stats.get("commentCount", 0)),
            "subscribers": subscribers,
            "small_channel_win": small_channel_win,
        })

    results.sort(key=lambda x: x["views"], reverse=True)
    return {"query": q, "results": results}