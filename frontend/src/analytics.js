const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "is", "it", "this", "that", "was", "are", "be", "as", "i", "you",
  "he", "she", "we", "they", "my", "your", "his", "her", "our", "its", "have", "has",
  "had", "do", "did", "will", "would", "could", "should", "may", "might", "vs", "ft",
  "amp", "how", "what", "why", "when", "who", "not", "no", "so", "if", "up", "out", "about", "all",
]);

const UTC_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const POSTING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const POSTING_WINDOWS = [
  "Morning (6am–12pm)",
  "Afternoon (12pm–6pm)",
  "Evening (6pm–12am)",
  "Late Night (12am–6am)",
];

const numeric = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

export const formatNum = (value) => {
  const number = numeric(value);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return number;
};

const rawEngagementRate = (video) => (
  numeric(video?.views) > 0 ? (numeric(video?.likes) / numeric(video.views)) * 100 : 0
);

export const engagementRate = (video) => Number(rawEngagementRate(video).toFixed(2));

function getTopKeywords(results) {
  const counts = Object.create(null);
  results.forEach((video) => {
    String(video.title || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).forEach((word) => {
      if (word.length > 2 && !STOP_WORDS.has(word)) counts[word] = (counts[word] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));
}

function getPostingData(results) {
  if (!results.length) return null;
  const dayCounts = {};
  const hourCounts = {};
  const dayViews = {};
  const hourViews = {};
  let validDateCount = 0;

  results.forEach((video) => {
    if (!video.published_at) return;
    const date = new Date(video.published_at);
    if (Number.isNaN(date.getTime())) return;
    validDateCount += 1;
    const day = UTC_DAYS[date.getUTCDay()];
    const hour = date.getUTCHours();
    const bucket = hour < 6 ? "Late Night (12am–6am)"
      : hour < 12 ? "Morning (6am–12pm)"
        : hour < 18 ? "Afternoon (12pm–6pm)"
          : "Evening (6pm–12am)";
    dayCounts[day] = (dayCounts[day] || 0) + 1;
    dayViews[day] = (dayViews[day] || 0) + numeric(video.views);
    hourCounts[bucket] = (hourCounts[bucket] || 0) + 1;
    hourViews[bucket] = (hourViews[bucket] || 0) + numeric(video.views);
  });

  return {
    dayCounts,
    hourCounts,
    dayViews,
    hourViews,
    topDay: Object.entries(dayViews).sort((a, b) => b[1] - a[1])[0] || null,
    topTime: Object.entries(hourViews).sort((a, b) => b[1] - a[1])[0] || null,
    validDateCount,
    invalidDateCount: results.length - validDateCount,
  };
}

function inferFormat(title) {
  const text = String(title || "").toLowerCase();
  if (text.includes("reaction") || text.includes("reacts")) return "reaction";
  if (text.includes("highlight") || text.includes("goals")) return "highlights";
  if (text.includes("vs") || text.includes("versus")) return "comparison";
  if (text.includes("predict") || text.includes("preview")) return "predictions";
  if (text.includes("rank") || text.includes("best") || text.includes("top")) return "ranking";
  if (text.includes("explain") || text.includes("why") || text.includes("how")) return "explainer";
  if (text.includes("interview") || text.includes("press")) return "interview breakdown";
  return "analysis";
}

// Keep the existing frontend heuristics separate from model-generated insights.
export function deriveAnalytics(results = [], query = "") {
  const videos = Array.isArray(results) ? results.filter(Boolean) : [];
  const avgViews = videos.length
    ? Math.round(videos.reduce((total, video) => total + numeric(video.views), 0) / videos.length)
    : 0;
  const topVideo = videos[0] || null;
  const bestEngagement = videos.length ? Math.max(...videos.map(engagementRate)) : 0;
  const bestEngagementVideo = videos.length ? videos.reduce((best, video) => (
    rawEngagementRate(video) > rawEngagementRate(best) ? video : best
  ), videos[0]) : null;
  const topKeywords = getTopKeywords(videos);
  const postingData = getPostingData(videos);
  const smallChannelWinCount = videos.filter((video) => video.small_channel_win).length;
  const queryWords = String(query).toLowerCase().split(" ");
  const recommendation = bestEngagementVideo ? {
    format: inferFormat(bestEngagementVideo.title),
    topKeyword: topKeywords.find((keyword) => !queryWords.includes(keyword.word))?.word
      || topKeywords[0]?.word || query,
    bestDay: postingData?.topDay?.[0] || "",
    bestTime: postingData?.topTime?.[0] || "",
    opportunityLevel: smallChannelWinCount >= 2 ? "high" : smallChannelWinCount === 1 ? "medium" : "low",
    bestEngagementVideo,
  } : null;

  const chartData = videos.map((video, index) => ({
    name: `${String(video.title || "Untitled video").slice(0, 30)}...`,
    fullTitle: video.title || "Untitled video",
    rank: index + 1,
    views: Math.round(numeric(video.views) / 1000),
    likes: Math.round(numeric(video.likes) / 1000),
    engagement: engagementRate(video),
  }));

  const scatterData = videos.map((video, index) => ({
    x: Math.round(numeric(video.views) / 1000),
    y: engagementRate(video),
    z: Math.max(Math.round(numeric(video.comments) / 10), 10),
    title: `${String(video.title || "Untitled video").slice(0, 40)}...`,
    fullTitle: video.title || "Untitled video",
    channel: video.channel || "Unknown channel",
    views: numeric(video.views),
    video_id: video.video_id,
    isTop: index === 0,
    isSmallWin: Boolean(video.small_channel_win),
    isBestEngagement: video === bestEngagementVideo,
  }));

  return {
    avgViews, topVideo, bestEngagement, topKeywords, postingData,
    smallChannelWinCount, recommendation, bestEngagementVideo, scatterData, chartData,
  };
}
