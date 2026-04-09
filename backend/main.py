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
        "order": "viewCount",
        "key": API_KEY
    }
    search_response = requests.get(search_url, params=search_params).json()

    # Extract video IDs from results
    video_ids = [
        item["id"]["videoId"]
        for item in search_response.get("items", [])
    ]

    if not video_ids:
        return {"results": []}

    # Step 2: get stats for those videos
    stats_url = "https://www.googleapis.com/youtube/v3/videos"
    stats_params = {
        "part": "statistics,snippet",
        "id": ",".join(video_ids),
        "key": API_KEY
    }
    stats_response = requests.get(stats_url, params=stats_params).json()

    # Step 3: combine everything into clean results
    results = []
    for item in stats_response.get("items", []):
        stats = item.get("statistics", {})
        snippet = item.get("snippet", {})
        results.append({
            "video_id": item["id"],
            "title": snippet.get("title"),
            "channel": snippet.get("channelTitle"),
            "published_at": snippet.get("publishedAt"),
            "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url"),
            "views": int(stats.get("viewCount", 0)),
            "likes": int(stats.get("likeCount", 0)),
            "comments": int(stats.get("commentCount", 0)),
        })

    # Sort by views descending
    results.sort(key=lambda x: x["views"], reverse=True)
    return {"query": q, "results": results}