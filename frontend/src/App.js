import { useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ScatterChart,
  Scatter, ZAxis, Cell
} from "recharts";

// Sunwashed soft palette
const S = {
  bg:       "#f7f3ee",   // warm off-white
  surface:  "#ffffff",   // clean white cards
  surface2: "#fdf8f3",   // slightly warm white
  border:   "#e8ddd0",   // soft warm tan
  rust:     "#c4704a",   // muted terracotta
  sage:     "#7a9e7e",   // dusty sage green
  sand:     "#d4a96a",   // warm sand/gold
  sky:      "#7bafc4",   // faded denim blue
  mauve:    "#a07898",   // dusty mauve
  text:     "#3d2f24",   // warm dark brown
  muted:    "#9c8878",   // warm muted brown
  dim:      "#c4b5a5",   // light warm tan
  cream:    "#f0e8de",   // soft cream
};

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setVisibleCount(10);
    try {
      const res = await axios.get(`http://localhost:8000/search?q=${query}&max_results=30`);
      setResults(res.data.results);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") search();
  };

  const chartData = results.map((v) => ({
    name: v.title.slice(0, 30) + "...",
    views: Math.round(v.views / 1000),
    likes: Math.round(v.likes / 1000),
    engagement: v.views > 0 ? parseFloat(((v.likes / v.views) * 100).toFixed(2)) : 0,
  }));

  const formatNum = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n;
  };

  const avgViews = results.length
    ? Math.round(results.reduce((a, b) => a + b.views, 0) / results.length)
    : 0;

  const topVideo = results[0] || null;

  const bestEngagement = results.length
    ? Math.max(...results.map(v => v.views > 0 ? parseFloat(((v.likes / v.views) * 100).toFixed(2)) : 0))
    : 0;

  const getEngagementBg = (rate) => {
    if (rate >= 5) return "#e8f4ec";
    if (rate >= 2) return "#f5ede3";
    return "#f5e3e3";
  };

  const getEngagementTextColor = (rate) => {
    if (rate >= 5) return S.sage;
    if (rate >= 2) return S.rust;
    return "#b05a5a";
  };

  const getTopKeywords = () => {
    if (!results.length) return [];
    const stopWords = new Set([
      "the","a","an","and","or","but","in","on","at","to","for",
      "of","with","by","from","is","it","this","that","was","are",
      "be","as","i","you","he","she","we","they","my","your","his",
      "her","our","its","have","has","had","do","did","will","would",
      "could","should","may","might","vs","ft","amp","how","what",
      "why","when","who","not","no","so","if","up","out","about","all"
    ]);

    const wordCount = {};
    results.forEach(v => {
      v.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .forEach(word => {
          if (word.length > 2 && !stopWords.has(word)) {
            wordCount[word] = (wordCount[word] || 0) + 1;
          }
        });
    });

    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word, count]) => ({ word, count }));
  };

  const topKeywords = getTopKeywords();

  const getBestTimeToPost = () => {
    if (!results.length) return null;

    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayViews = {};
    const hourViews = {};
    const dayCounts = {};
    const hourCounts = {};

    results.forEach(v => {
      const date = new Date(v.published_at);
      const day = days[date.getUTCDay()];
      const hour = date.getUTCHours();

      dayCounts[day] = (dayCounts[day] || 0) + 1;
      dayViews[day] = (dayViews[day] || 0) + v.views;

      const bucket = hour < 6 ? "Late Night (12am–6am)"
        : hour < 12 ? "Morning (6am–12pm)"
        : hour < 18 ? "Afternoon (12pm–6pm)"
        : "Evening (6pm–12am)";

      hourCounts[bucket] = (hourCounts[bucket] || 0) + 1;
      hourViews[bucket] = (hourViews[bucket] || 0) + v.views;
    });

    const topDay = Object.entries(dayViews).sort((a, b) => b[1] - a[1])[0];
    const topTime = Object.entries(hourViews).sort((a, b) => b[1] - a[1])[0];

    return { dayCounts, hourCounts, topDay, topTime };
  };

  const postingData = getBestTimeToPost();
  const smallChannelWinCount = results.filter(v => v.small_channel_win).length;

  const getVideoRecommendation = () => {
    if (!results.length || !postingData) return null;

    const bestEngagementVideo = results.reduce((best, v) => {
      const rate = v.views > 0 ? (v.likes / v.views) * 100 : 0;
      const bestRate = best.views > 0 ? (best.likes / best.views) * 100 : 0;
      return rate > bestRate ? v : best;
    }, results[0]);

    const titleLower = bestEngagementVideo?.title?.toLowerCase() || "";
    let format = "analysis";
    if (titleLower.includes("reaction") || titleLower.includes("reacts")) format = "reaction";
    else if (titleLower.includes("highlight") || titleLower.includes("goals")) format = "highlights";
    else if (titleLower.includes("vs") || titleLower.includes("versus")) format = "comparison";
    else if (titleLower.includes("predict") || titleLower.includes("preview")) format = "predictions";
    else if (titleLower.includes("rank") || titleLower.includes("best") || titleLower.includes("top")) format = "ranking";
    else if (titleLower.includes("explain") || titleLower.includes("why") || titleLower.includes("how")) format = "explainer";
    else if (titleLower.includes("interview") || titleLower.includes("press")) format = "interview breakdown";

    const queryWords = query.toLowerCase().split(" ");
    const topKeyword = topKeywords.find(k => !queryWords.includes(k.word))?.word || topKeywords[0]?.word || query;

    const bestDay = postingData.topDay[0];
    const bestTime = postingData.topTime[0];
    const opportunityLevel = smallChannelWinCount >= 2 ? "high" : smallChannelWinCount === 1 ? "medium" : "low";

    return { format, topKeyword, bestDay, bestTime, opportunityLevel, bestEngagementVideo };
  };

  const recommendation = getVideoRecommendation();

  const scatterData = results.map((v, i) => ({
    x: Math.round(v.views / 1000),
    y: v.views > 0 ? parseFloat(((v.likes / v.views) * 100).toFixed(2)) : 0,
    z: Math.max(Math.round(v.comments / 10), 10),
    title: v.title.slice(0, 40) + "...",
    channel: v.channel,
    views: v.views,
    video_id: v.video_id,
    isTop: i === 0,
    isSmallWin: v.small_channel_win,
    isBestEngagement: recommendation?.bestEngagementVideo?.video_id === v.video_id,
  }));

  const getDotColor = (entry) => {
    if (entry.isBestEngagement) return S.sand;
    if (entry.isSmallWin) return S.sage;
    if (entry.isTop) return S.mauve;
    return S.sky;
  };

  const CustomScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div style={{
          background: S.surface, border: `1px solid ${S.border}`,
          borderRadius: "10px", padding: "12px", maxWidth: "220px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
        }}>
          <div style={{ fontSize: "12px", color: S.text, fontWeight: "bold", marginBottom: "6px" }}>
            {d.title}
          </div>
          <div style={{ fontSize: "11px", color: S.muted, marginBottom: "4px" }}>{d.channel}</div>
          <div style={{ fontSize: "11px", color: S.sky }}>👁 {formatNum(d.views)} views</div>
          <div style={{ fontSize: "11px", color: S.sage }}>💚 {d.y}% engagement</div>
          <div style={{ fontSize: "11px", color: S.rust, marginTop: "6px", fontStyle: "italic" }}>
            Click to open video →
          </div>
          {d.isBestEngagement && (
            <div style={{ fontSize: "11px", color: S.sand, marginTop: "4px", fontWeight: "bold" }}>
             Recommended to study
            </div>
          )}
          {d.isSmallWin && (
            <div style={{ fontSize: "11px", color: S.sage, marginTop: "4px", fontWeight: "bold" }}>
              Small channel win
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const handleDotClick = (data) => {
    if (data && data.video_id) {
      window.open(`https://youtube.com/watch?v=${data.video_id}`, "_blank");
    }
  };

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: "100vh", background: S.bg, color: S.text }}>

      {/* Header */}
      <div style={{
        background: S.surface,
        padding: "24px 40px",
        borderBottom: `2px solid ${S.border}`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
      }}>
        <h1 style={{ margin: 0, fontSize: "28px", color: S.text, letterSpacing: "1px", fontWeight: "bold" }}>
           <span style={{ color: S.rust }}>Trend</span><span style={{ color: S.mauve }}>Vision</span>
        </h1>
        <p style={{ margin: "4px 0 0", color: S.muted, fontSize: "14px" }}>
          Dont know what to post? we’ve got you!
        </p>
      </div>

      {/* Search */}
      <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search a topic e.g. Premier League, Beauty & Lifestyle, Fashion..."
            style={{
              flex: 1, padding: "14px 18px", borderRadius: "10px",
              border: `2px solid ${S.border}`,
              background: S.surface,
              color: S.text, fontSize: "16px", outline: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              fontFamily: "inherit"
            }}
          />
          <button
            onClick={search}
            style={{
              padding: "14px 28px", borderRadius: "10px", border: "none",
              background: S.rust,
              color: "#fff", fontSize: "16px",
              fontWeight: "bold", cursor: "pointer",
              boxShadow: "0 4px 12px rgba(196,112,74,0.3)",
              fontFamily: "inherit"
            }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Quick topic buttons */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "40px" }}>
          {["Workout", "Tennis", "late night shows", "Man City", "Champions League"].map((topic) => (
            <button
              key={topic}
              onClick={() => setQuery(topic)}
              style={{
                padding: "8px 16px", borderRadius: "20px",
                border: `1px solid ${S.border}`,
                background: S.cream, color: S.muted,
                cursor: "pointer", fontSize: "13px",
                fontFamily: "inherit"
              }}
            >
              {topic}
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "40px" }}>
              {[
                { label: "Videos Analyzed", value: results.length, color: S.sky },
                { label: "Avg Views", value: formatNum(avgViews), color: S.sage },
                { label: "Top Video Views", value: formatNum(topVideo?.views || 0), color: S.rust },
                { label: "Best Engagement Rate", value: bestEngagement + "%", color: S.sand },
              ].map((card) => (
                <div key={card.label} style={{
                  background: S.surface,
                  borderRadius: "12px", padding: "20px",
                  borderLeft: `4px solid ${card.color}`,
                  textAlign: "center",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)"
                }}>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: "12px", color: S.muted, marginTop: "4px" }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Video Recommendation Box */}
            {recommendation && (
              <div style={{
                background: S.cream,
                border: `1px solid ${S.border}`,
                borderRadius: "16px", padding: "28px", marginBottom: "40px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "24px" }}>🎬</span>
                  <h2 style={{ margin: 0, fontSize: "18px", color: S.text }}>
                    Your Video Recommendation
                  </h2>
                  <span style={{
                    background: recommendation.opportunityLevel === "high" ? "#e8f4ec"
                      : recommendation.opportunityLevel === "medium" ? "#f5ede3"
                      : "#f5e8e8",
                    border: `1px solid ${recommendation.opportunityLevel === "high" ? S.sage
                      : recommendation.opportunityLevel === "medium" ? S.rust : "#b05a5a"}`,
                    color: recommendation.opportunityLevel === "high" ? S.sage
                      : recommendation.opportunityLevel === "medium" ? S.rust : "#b05a5a",
                    fontSize: "11px", padding: "3px 10px", borderRadius: "12px", fontWeight: "bold"
                  }}>
                    {recommendation.opportunityLevel === "high" ? "🟢 High opportunity"
                      : recommendation.opportunityLevel === "medium" ? "🟡 Medium opportunity"
                      : "🔴 Competitive space"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                  {[
                    { label: "Format", value: recommendation.format.charAt(0).toUpperCase() + recommendation.format.slice(1), sub: "Highest engagement style", color: S.mauve },
                    { label: "Post on", value: recommendation.bestDay, sub: recommendation.bestTime, color: S.sky },
                    { label: "Key word to use", value: recommendation.topKeyword.charAt(0).toUpperCase() + recommendation.topKeyword.slice(1), sub: "Top performing keyword", color: S.sand },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: S.surface,
                      border: `1px solid ${S.border}`,
                      borderRadius: "10px", padding: "16px", textAlign: "center"
                    }}>
                      <div style={{ fontSize: "11px", color: S.muted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>{item.label}</div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: "11px", color: S.dim, marginTop: "4px" }}>{item.sub}</div>
                    </div>
                  ))}
                </div>

                {recommendation.bestEngagementVideo && (
                  <div style={{
                    marginTop: "16px",
                    background: S.surface,
                    border: `1px solid ${S.border}`,
                    borderRadius: "10px", padding: "14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontSize: "11px", color: S.muted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>
                        Study this video — highest engagement in results
                      </div>
                      <div style={{ fontSize: "13px", color: S.text }}>{recommendation.bestEngagementVideo.title}</div>
                      <div style={{ fontSize: "12px", color: S.muted, marginTop: "2px" }}>
                        {recommendation.bestEngagementVideo.channel} · {formatNum(recommendation.bestEngagementVideo.views)} views
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`https://youtube.com/watch?v=${recommendation.bestEngagementVideo.video_id}`, "_blank")}
                      style={{
                        background: S.rust,
                        border: "none", color: "#fff",
                        padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                        fontSize: "12px", fontWeight: "bold", whiteSpace: "nowrap", marginLeft: "16px",
                        fontFamily: "inherit"
                      }}
                    >
                      Watch it →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Small channel win banner */}
            {smallChannelWinCount > 0 && (
              <div style={{
                background: "#eef5f0",
                border: `1px solid ${S.sage}`,
                borderRadius: "12px", padding: "16px 20px", marginBottom: "40px",
                display: "flex", alignItems: "center", gap: "12px",
              }}>
                <span style={{ fontSize: "24px" }}>🚀</span>
                <div>
                  <div style={{ fontWeight: "bold", color: S.sage, fontSize: "15px" }}>
                    Small channel opportunity detected!
                  </div>
                  <div style={{ color: S.muted, fontSize: "13px", marginTop: "2px" }}>
                    {smallChannelWinCount} video{smallChannelWinCount > 1 ? "s" : ""} from channels under 100K subscribers
                    are getting strong views on this topic — the algorithm is pushing this content beyond existing audiences.
                    New creators can compete here.
                  </div>
                </div>
              </div>
            )}

            {/* Scatter Plot */}
            <div style={{ background: S.surface, borderRadius: "12px", padding: "24px", marginBottom: "40px", border: `1px solid ${S.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <h2 style={{ margin: "0 0 6px", fontSize: "16px", color: S.text }}>
                Views vs Engagement Rate
              </h2>
              <p style={{ margin: "0 0 12px", fontSize: "13px", color: S.muted }}>
                Top-right = high views AND high engagement (these are thebest to model). Top-left = Audience is engaging but less reach. Click any dot to open the video.
              </p>

              <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                {[
                  { color: S.sand, label: "⭐ Recommended to study" },
                  { color: S.sage, label: "🚀 Small channel win" },
                  { color: S.mauve, label: "👑 Most views" },
                  { color: S.sky, label: "Other videos" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: item.color }} />
                    <span style={{ fontSize: "11px", color: S.muted }}>{item.label}</span>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                  <XAxis
                    type="number" dataKey="x" name="Views"
                    tick={{ fill: S.muted, fontSize: 11 }}
                    label={{ value: "Views (thousands)", position: "insideBottom", offset: -10, fill: S.dim, fontSize: 11 }}
                  />
                  <YAxis
                    type="number" dataKey="y" name="Engagement"
                    tick={{ fill: S.muted, fontSize: 11 }}
                    label={{ value: "Engagement %", angle: -90, position: "insideLeft", fill: S.dim, fontSize: 11 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[60, 300]} />
                  <Tooltip content={<CustomScatterTooltip />} />
                  <Scatter data={scatterData} onClick={(data) => handleDotClick(data)} style={{ cursor: "pointer" }}>
                    {scatterData.map((entry, index) => (
                      <Cell key={index} fill={getDotColor(entry)} fillOpacity={0.85} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div style={{ background: S.surface, borderRadius: "12px", padding: "24px", marginBottom: "40px", border: `1px solid ${S.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "16px", color: S.text }}>
                 Views & Likes by Video (x1000)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                  <XAxis dataKey="name" tick={{ fill: S.muted, fontSize: 10 }} />
                  <YAxis tick={{ fill: S.muted, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "8px" }}
                    formatter={(val) => [`${val}K`]}
                  />
                  <Bar dataKey="views" fill={S.sky} radius={[4, 4, 0, 0]} name="Views" />
                  <Bar dataKey="likes" fill={S.rust} radius={[4, 4, 0, 0]} name="Likes" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Title Keywords */}
            {topKeywords.length > 0 && (
              <div style={{ background: S.surface, borderRadius: "12px", padding: "24px", marginBottom: "40px", border: `1px solid ${S.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <h2 style={{ margin: "0 0 8px", fontSize: "16px", color: S.text }}>
                  These Keywords are dominating Titles Right Now
                </h2>
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: S.muted }}>
                  Use these words in your video title to match what's already trending
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {topKeywords.map(({ word, count }) => (
                    <div key={word} style={{
                      background: count >= 3 ? "#f0e8de" : count >= 2 ? "#f7f3ee" : S.surface,
                      border: `1px solid ${count >= 3 ? S.rust : S.border}`,
                      borderRadius: "20px", padding: "6px 14px",
                      display: "flex", alignItems: "center", gap: "8px"
                    }}>
                      <span style={{ color: S.text, fontSize: "14px", fontWeight: count >= 3 ? "bold" : "normal" }}>
                        {word}
                      </span>
                      <span style={{
                        background: count >= 3 ? S.rust : S.dim,
                        color: "#fff", fontSize: "11px",
                        borderRadius: "10px", padding: "1px 7px", fontWeight: "bold"
                      }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best Time to Post */}
            {postingData && (
              <div style={{ background: S.surface, borderRadius: "12px", padding: "24px", marginBottom: "40px", border: `1px solid ${S.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <h2 style={{ margin: "0 0 8px", fontSize: "16px", color: S.text }}>
                 Best Time to Post
                </h2>
                <p style={{ margin: "0 0 20px", fontSize: "13px", color: S.muted }}>
                  Based on which posting windows produced the highest total views
                </p>

                <div style={{
                  background: S.cream,
                  border: `1px solid ${S.border}`,
                  borderRadius: "10px", padding: "16px", marginBottom: "20px",
                  display: "flex", gap: "24px",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "28px", fontWeight: "bold", color: S.rust }}>
                      {postingData.topDay[0]}
                    </div>
                    <div style={{ fontSize: "12px", color: S.muted, marginTop: "4px" }}>Best day by views</div>
                  </div>
                  <div style={{ width: "1px", background: S.border }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: S.rust }}>
                      {postingData.topTime[0]}
                    </div>
                    <div style={{ fontSize: "12px", color: S.muted, marginTop: "4px" }}>Best time window by views (UTC)</div>
                  </div>
                </div>

                <p style={{ margin: "0 0 10px", fontSize: "13px", color: S.muted }}>Posts by day of week:</p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
                  {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(day => {
                    const count = postingData.dayCounts[day] || 0;
                    const isTop = day === postingData.topDay[0];
                    return (
                      <div key={day} style={{
                        background: isTop ? "#fdf0ea" : S.surface,
                        border: `1px solid ${isTop ? S.rust : S.border}`,
                        borderRadius: "8px", padding: "10px 14px",
                        textAlign: "center", minWidth: "80px"
                      }}>
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: isTop ? S.rust : S.muted }}>
                          {count}
                        </div>
                        <div style={{ fontSize: "11px", color: S.dim, marginTop: "2px" }}>
                          {day.slice(0, 3)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p style={{ margin: "0 0 10px", fontSize: "13px", color: S.muted }}>Posts by time of day (UTC):</p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {["Morning (6am–12pm)","Afternoon (12pm–6pm)","Evening (6pm–12am)","Late Night (12am–6am)"].map(bucket => {
                    const count = postingData.hourCounts[bucket] || 0;
                    const isTop = bucket === postingData.topTime[0];
                    return (
                      <div key={bucket} style={{
                        background: isTop ? "#fdf0ea" : S.surface,
                        border: `1px solid ${isTop ? S.rust : S.border}`,
                        borderRadius: "8px", padding: "10px 14px",
                        textAlign: "center", flex: 1, minWidth: "120px"
                      }}>
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: isTop ? S.rust : S.muted }}>
                          {count}
                        </div>
                        <div style={{ fontSize: "11px", color: S.dim, marginTop: "2px" }}>{bucket}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Video Results */}
            <h2 style={{ fontSize: "16px", color: S.text, marginBottom: "16px" }}>
               Top Videos for "{query}"
              <span style={{ fontSize: "13px", color: S.muted, fontWeight: "normal", marginLeft: "8px" }}>
                — showing {Math.min(visibleCount, results.length)} of {results.length}
              </span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {visibleResults.map((v, i) => {
                const engagementRate = v.views > 0
                  ? parseFloat(((v.likes / v.views) * 100).toFixed(2))
                  : 0;

                return (
                  <div key={v.video_id} style={{
                    background: S.surface,
                    borderRadius: "12px", padding: "16px",
                    display: "flex", gap: "16px", alignItems: "center",
                    border: `1px solid ${S.border}`,
                    borderLeft: i === 0 ? `4px solid ${S.sand}` : v.small_channel_win ? `4px solid ${S.sage}` : `1px solid ${S.border}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                  }}>
                    <div style={{ fontSize: "18px", fontWeight: "bold", color: S.dim, minWidth: "28px" }}>
                      {i + 1}
                    </div>
                    <img
                      src={v.thumbnail}
                      alt=""
                      style={{ width: "120px", height: "68px", borderRadius: "6px", objectFit: "cover" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <div
                          onClick={() => window.open(`https://youtube.com/watch?v=${v.video_id}`, "_blank")}
                          style={{ color: S.text, fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}
                        >
                          {v.title}
                        </div>
                        {v.small_channel_win && (
                          <span style={{
                            background: "#eef5f0",
                            border: `1px solid ${S.sage}`,
                            color: S.sage, fontSize: "11px", padding: "2px 8px",
                            borderRadius: "12px", fontWeight: "bold", whiteSpace: "nowrap"
                          }}>
                             Small channel win
                          </span>
                        )}
                      </div>
                      <div style={{ color: S.muted, fontSize: "12px", marginTop: "4px" }}>
                        {v.channel}
                        {v.subscribers > 0 && (
                          <span style={{ color: S.dim, marginLeft: "8px" }}>
                            · {formatNum(v.subscribers)} subscribers
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px", alignItems: "center" }}>
                        <span style={{ color: S.sky, fontSize: "13px" }}>👁 {formatNum(v.views)}</span>
                        <span style={{ color: S.sage, fontSize: "13px" }}>👍 {formatNum(v.likes)}</span>
                        <span style={{ color: S.mauve, fontSize: "13px" }}>💬 {formatNum(v.comments)}</span>
                        <span style={{
                          background: getEngagementBg(engagementRate),
                          color: getEngagementTextColor(engagementRate),
                          fontSize: "11px", padding: "2px 8px",
                          borderRadius: "12px", fontWeight: "bold",
                          border: `1px solid ${getEngagementTextColor(engagementRate)}`,
                        }}>
                          {engagementRate}% engagement
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* View More Button */}
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: "24px", marginBottom: "40px" }}>
                <button
                  onClick={() => setVisibleCount(prev => Math.min(prev + 10, results.length))}
                  style={{
                    padding: "12px 32px", borderRadius: "10px",
                    border: `1px solid ${S.border}`,
                    background: S.surface, color: S.rust,
                    fontSize: "14px", fontWeight: "bold",
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                  }}
                >
                  View more ({results.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {searched && !loading && results.length === 0 && (
          <div style={{ textAlign: "center", color: S.muted, marginTop: "60px" }}>
            <p style={{ fontSize: "48px" }}>🔍</p>
            <p>No results found. Try a different search term.</p>
          </div>
        )}

        {/* Initial state */}
        {!searched && (
          <div style={{ marginTop: "60px" }}>
            <div style={{
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderRadius: "16px", padding: "40px",
              textAlign: "center", maxWidth: "680px", margin: "0 auto",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)"
            }}>
              <p style={{ fontSize: "48px", margin: "0 0 16px" }}></p>
              <h2 style={{ fontSize: "22px", color: S.text, margin: "0 0 16px", fontWeight: "bold" }}>
                Designed for new YouTube creators
              </h2>
              <p style={{ fontSize: "15px", color: S.muted, lineHeight: "1.7", margin: "0 0 28px" }}>
                TrendVision helps you figure out{" "}
                <strong style={{ color: S.rust }}>what to post before you post it</strong>.
                You search any topic and instantly see which videos are gaining traction right now,
                what engagement rate the audience has, whether small channels are breaking through,
                the best day and time to publish, and which keywords are dominating titles, this is all
                backed by live YouTube data from the last 30 days.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                {[
                  { icon: "", text: "Graph showing views vs Engagement", color: S.sky },
                  { icon: "", text: "Best Keywords for your post", color: S.mauve },
                  { icon: "", text: "Best time to post?", color: S.rust },
                ].map(item => (
                  <div key={item.text} style={{
                    background: S.cream,
                    border: `1px solid ${S.border}`,
                    borderRadius: "10px", padding: "12px 16px",
                    display: "flex", alignItems: "center", gap: "8px"
                  }}>
                    <span style={{ fontSize: "16px" }}>{item.icon}</span>
                    <span style={{ fontSize: "12px", color: item.color }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}