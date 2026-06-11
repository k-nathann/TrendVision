from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi
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

    stats_url = "https://www.googleapis.com/youtube/v3/videos"
    stats_params = {
        "part": "statistics,snippet",
        "id": ",".join(video_ids),
        "key": YOUTUBE_API_KEY
    }
    stats_response = requests.get(stats_url, params=stats_params).json()

    channel_ids = list(set([
        item.get("snippet", {}).get("channelId")
        for item in stats_response.get("items", [])
        if item.get("snippet", {}).get("channelId")
    ]))

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

    results = []
    for item in stats_response.get("items", []):
        stats = item.get("statistics", {})
        snippet = item.get("snippet", {})
        channel_id = snippet.get("channelId")
        subscribers = channel_stats.get(channel_id, 0)
        views = int(stats.get("viewCount", 0))
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


def _fetch_transcript(video_id: str) -> tuple[str, str]:
    try:
        entries = YouTubeTranscriptApi.get_transcript(video_id)
        text = " ".join(e["text"] for e in entries)
        # ~3000 chars ≈ 750 tokens — enough signal without blowing up cost
        return video_id, text[:3000]
    except Exception:
        return video_id, ""


class VideoItem(BaseModel):
    video_id: str
    title: str
    description: str = ""
    views: int = 0
    likes: int = 0
    subscribers: int = 0


class IdeateVideoItem(BaseModel):
    title: str
    views: int = 0
    likes: int = 0
    subscribers: int = 0


class IdeateRequest(BaseModel):
    query: str
    top_keywords: list[str]
    small_channel_win_count: int
    avg_views: int
    top_videos: list[IdeateVideoItem]


class AnalyzeRequest(BaseModel):
    query: str
    videos: list[VideoItem]


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Fetch transcripts for all videos in parallel
    transcripts: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_fetch_transcript, v.video_id): v.video_id for v in req.videos}
        for future in as_completed(futures):
            video_id, text = future.result()
            transcripts[video_id] = text

    # Build enriched video context for Claude
    video_list = ""
    for i, v in enumerate(req.videos):
        engagement = round((v.likes / v.views) * 100, 2) if v.views > 0 else 0
        transcript = transcripts.get(v.video_id, "")
        transcript_section = f"   Transcript excerpt: {transcript}" if transcript else "   Transcript: not available"

        video_list += (
            f"{i + 1}. \"{v.title}\"\n"
            f"   Views: {v.views:,} | Engagement: {engagement}% | Subscribers: {v.subscribers:,}\n"
            f"   Description: {v.description[:300] if v.description else 'none'}\n"
            f"{transcript_section}\n\n"
        )

    prompt = f"""You are a YouTube content strategist. A creator wants to make a video about "{req.query}".

Here are the top performing videos on this topic from the last 30 days, including transcript excerpts:

{video_list}
Analyze the actual content of these videos — what they cover, how deeply, and from what angle — then respond ONLY with valid JSON in this exact format, no extra text:
{{
  "saturated": "One sentence describing what angle or topic most of these videos share",
  "gap": "One sentence describing a specific subtopic or angle that none of these videos cover",
  "suggested_title": "A concrete, clickable YouTube title that fills that gap",
  "reasoning": "2-3 sentences explaining why this gap is a strong opportunity right now — reference what the transcripts reveal about what existing videos leave unanswered, and why a new creator can win here"
}}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}]
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


@app.post("/ideate")
def ideate(req: IdeateRequest):
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    video_list = "\n".join([
        f"- \"{v.title}\" | {v.views:,} views | "
        f"{round((v.likes / v.views) * 100, 2) if v.views > 0 else 0}% engagement | "
        f"{v.subscribers:,} subs"
        for v in req.top_videos
    ])

    prompt = f"""You are an expert YouTube Growth Strategist and Thumbnail Designer.

Analyse this real-time YouTube market data for the topic "{req.query}":

TOP KEYWORDS IN TITLES RIGHT NOW: {", ".join(req.top_keywords[:8])}
SMALL CHANNEL WINS (under 100K subs getting strong views): {req.small_channel_win_count} videos
AVERAGE VIEWS ACROSS TOP VIDEOS: {req.avg_views:,}

TOP COMPETING VIDEOS RIGHT NOW:
{video_list}

Generate exactly 3 highly specific, data-backed video concepts that exploit gaps or trends in this data. Each concept must be distinct — use different angles (e.g. beginner vs advanced, emotional vs analytical, contrarian vs mainstream).

Respond ONLY with a valid JSON array of exactly 3 objects. No extra text. Use this format:
[
  {{
    "badge": "Short archetype name (e.g. The Contrarian Angle, The Beginner Gap, The Deep Dive, The Troubleshooting Guide)",
    "angle": "2-3 sentences explaining exactly why this video will work, referencing specific numbers or patterns from the data above.",
    "titles": [
      "Title using curiosity hook",
      "Title using fear of missing out or urgency",
      "Title using extreme clarity or how-to format"
    ],
    "thumbnail_prompt": "Hyper-detailed image generation prompt: [Subject/Action] + [Expression/Emotion] + [Background environment] + [Color palette & lighting style, e.g. neon tones, high contrast, cinematic] --ar 16:9"
  }}
]"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


class ChatStats(BaseModel):
    total_videos: int = 0
    avg_views: int = 0
    top_views: int = 0
    best_engagement: float = 0
    small_channel_wins: int = 0
    top_keywords: list[str] = []
    best_day: str = ""
    best_time: str = ""
    top_videos: list[dict] = []


class ChatRequest(BaseModel):
    question: str
    query: str
    stats: ChatStats


@app.post("/chat")
def chat(req: ChatRequest):
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    s = req.stats
    top_vids = "\n".join([
        f"  - \"{v.get('title', '')}\" | {v.get('views', 0):,} views | {v.get('channel', '')}"
        for v in s.top_videos[:5]
    ])

    context = f"""You are Big KOK, a sharp YouTube analytics strategist built into TrendVision. You have real-time data for the topic "{req.query}":

- Videos analyzed: {s.total_videos}
- Average views: {s.avg_views:,}
- Top video views: {s.top_views:,}
- Best engagement rate: {s.best_engagement}%
- Small channel wins (under 100K subs, strong views): {s.small_channel_wins}
- Top keywords in titles: {', '.join(s.top_keywords) if s.top_keywords else 'none'}
- Best posting day: {s.best_day or 'unknown'}
- Best posting time: {s.best_time or 'unknown'}
- Top videos:
{top_vids}

Answer the user's question directly and concisely. Be data-driven and specific. Keep answers under 120 words."""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": f"{context}\n\nQuestion: {req.question}"}]
    )

    return {"answer": message.content[0].text.strip()}
