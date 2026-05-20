from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic
import requests
import json
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

@app.get("/health")
def health():
    return {"status": "ok", "api_key_loaded": bool(YOUTUBE_API_KEY)}

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
        "key": YOUTUBE_API_KEY
    }
    search_response = requests.get(search_url, params=search_params).json()

    video_ids = [
        item["id"]["videoId"]
        for item in search_response.get("items", [])
    ]

    if not video_ids:
        return {"results": []}

    # Step 2: get video stats + full snippet (includes description)
    stats_url = "https://www.googleapis.com/youtube/v3/videos"
    stats_params = {
        "part": "statistics,snippet",
        "id": ",".join(video_ids),
        "key": YOUTUBE_API_KEY
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
            "key": YOUTUBE_API_KEY
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
            "description": snippet.get("description", ""),
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


class VideoItem(BaseModel):
    title: str
    description: str = ""

class AnalyzeRequest(BaseModel):
    query: str
    videos: list[VideoItem]

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    video_list = "\n".join([
        f"{i+1}. \"{v.title}\"\n   {v.description[:250] if v.description else 'No description available'}"
        for i, v in enumerate(req.videos[:10])
    ])

    prompt = f"""You are a YouTube content strategist. A creator wants to make a video about "{req.query}".

Here are the top performing videos on this topic right now:

{video_list}

Analyze these videos and respond ONLY with valid JSON in this exact format, no extra text:
{{
  "saturated": "One sentence describing what angle or topic most of these videos share",
  "gap": "One sentence describing a specific subtopic or angle that none of these videos cover",
  "suggested_title": "A concrete, clickable YouTube title that fills that gap"
}}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )

    text = message.content[0].text.strip()
    return json.loads(text)
