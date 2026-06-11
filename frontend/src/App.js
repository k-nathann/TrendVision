import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ScatterChart,
  Scatter, ZAxis,
} from "recharts";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const S = {
  bg:       "#1E222B",   // Deep Anthracite
  surface:  "#2B2F36",   // Slate UI
  surface2: "#242830",   // Deeper surface
  border:   "#363C4A",   // Subtle border
  rust:     "#00FFC2",   // Neon Mint — primary actions & CTAs
  sage:     "#00D4A0",   // Teal — small channel wins, positive
  sand:     "#FFB84D",   // Gold — recommendations
  sky:      "#3B7BFF",   // Electric Blue — standard metrics
  mauve:    "#A78BFA",   // Soft Purple — secondary highlights
  red:      "#FF6B6B",   // Warning / competitive
  text:     "#E6E8EE",   // Primary text
  muted:    "#88A3D6",   // Haze Blue — secondary text
  dim:      "#4A5568",   // Tertiary / placeholder
};

// ─── Animation Variants ───────────────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

const btnTransition = { type: "spring", stiffness: 400, damping: 20 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatNum = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n;
};

const getDotColor = (entry) => {
  if (entry.isBestEngagement) return S.sand;
  if (entry.isSmallWin)       return S.sage;
  if (entry.isTop)            return S.mauve;
  return S.sky;
};

// ─── Custom Scatter Dot (animated radius on hover) ────────────────────────────
function CustomDot({ cx, cy, payload }) {
  const baseR = Math.max(6, Math.min(14, Math.sqrt(payload.z) * 1.5));
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={baseR}
      whileHover={{ r: baseR + 4 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      fill={getDotColor(payload)}
      fillOpacity={0.88}
      style={{ cursor: "pointer" }}
      onClick={() => {
        if (payload?.video_id)
          window.open(`https://youtube.com/watch?v=${payload.video_id}`, "_blank");
      }}
    />
  );
}

// ─── Glassmorphism Scatter Tooltip ────────────────────────────────────────────
const GlassTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{
        background: "rgba(43,47,54,0.85)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        padding: "14px",
        maxWidth: "220px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ fontSize: "12px", color: S.text, fontWeight: "bold", marginBottom: "6px" }}>{d.title}</div>
      <div style={{ fontSize: "11px", color: S.muted, marginBottom: "4px" }}>{d.channel}</div>
      <div style={{ fontSize: "11px", color: S.sky }}>👁 {formatNum(d.views)} views</div>
      <div style={{ fontSize: "11px", color: S.sage }}>💚 {d.y}% engagement</div>
      <div style={{ fontSize: "11px", color: S.rust, marginTop: "6px", fontStyle: "italic" }}>Click to open →</div>
      {d.isBestEngagement && (
        <div style={{ fontSize: "11px", color: S.sand, marginTop: "4px", fontWeight: "bold" }}>⭐ Recommended to study</div>
      )}
      {d.isSmallWin && (
        <div style={{ fontSize: "11px", color: S.sage, marginTop: "4px", fontWeight: "bold" }}>🚀 Small channel win</div>
      )}
    </motion.div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [analyzing, setAnalyzing]     = useState(false);
  const [analyzeError, setAnalyzeError] = useState(false);
  const [ideas, setIdeas]             = useState(null);
  const [ideating, setIdeating]       = useState(false);
  const [ideateError, setIdeateError] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [copiedId, setCopiedId]       = useState(null);
  const [chatOpen, setChatOpen]       = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const loadingMessages = [
    "Synthesising market data...",
    "Analysing competitor weaknesses...",
    "Engineering your concepts...",
  ];

  useEffect(() => {
    document.body.style.background = S.bg;
    document.body.style.margin = "0";
  }, []);

  useEffect(() => {
    if (!ideating) { setLoadingMsgIdx(0); return; }
    const t = setInterval(() => setLoadingMsgIdx(p => (p + 1) % 3), 2200);
    return () => clearInterval(t);
  }, [ideating]);

  const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

  // ── Data fetching ──────────────────────────────────────────────────────────
  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setVisibleCount(10);
    setGapAnalysis(null);
    setAnalyzeError(false);
    setIdeas(null);
    setIdeateError(false);
    try {
      const res = await axios.get(`${BASE_URL}/search?q=${query}&max_results=30`);
      const videos = res.data.results;
      setResults(videos);

      if (videos.length > 0) {
        setAnalyzing(true);
        try {
          const analyzeRes = await axios.post(`${BASE_URL}/analyze`, {
            query,
            videos: videos.slice(0, 10).map(v => ({
              video_id:    v.video_id,
              title:       v.title,
              description: v.description || "",
              views:       v.views,
              likes:       v.likes,
              subscribers: v.subscribers,
            })),
          });
          setGapAnalysis(analyzeRes.data);
        } catch (err) {
          console.error("Gap analysis failed:", err);
          setAnalyzeError(true);
        }
        setAnalyzing(false);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleKey = (e) => { if (e.key === "Enter") search(); };

  const generateIdeas = async () => {
    setIdeating(true);
    setIdeateError(false);
    setIdeas(null);
    try {
      const res = await axios.post(`${BASE_URL}/ideate`, {
        query,
        top_keywords:          topKeywords.slice(0, 8).map(k => k.word),
        small_channel_win_count: smallChannelWinCount,
        avg_views:             avgViews,
        top_videos:            results.slice(0, 8).map(v => ({
          title:       v.title,
          views:       v.views,
          likes:       v.likes,
          subscribers: v.subscribers,
        })),
      });
      setIdeas(res.data);
    } catch (err) {
      console.error("Ideation failed:", err);
      setIdeateError(true);
    }
    setIdeating(false);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: q }]);
    setChatLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/chat`, {
        question: q,
        query,
        stats: {
          total_videos:      results.length,
          avg_views:         avgViews,
          top_views:         topVideo?.views || 0,
          best_engagement:   bestEngagement,
          small_channel_wins: smallChannelWinCount,
          top_keywords:      topKeywords.map(k => k.word),
          best_day:          postingData?.topDay?.[0] || "",
          best_time:         postingData?.topTime?.[0] || "",
          top_videos:        results.slice(0, 5).map(v => ({ title: v.title, views: v.views, channel: v.channel })),
        },
      });
      setChatMessages(prev => [...prev, { role: "bot", text: res.data.answer }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "bot", text: "Something went wrong. Try again." }]);
    }
    setChatLoading(false);
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const chartData = results.map((v) => ({
    name:       v.title.slice(0, 30) + "...",
    views:      Math.round(v.views / 1000),
    likes:      Math.round(v.likes / 1000),
    engagement: v.views > 0 ? parseFloat(((v.likes / v.views) * 100).toFixed(2)) : 0,
  }));

  const avgViews = results.length
    ? Math.round(results.reduce((a, b) => a + b.views, 0) / results.length)
    : 0;

  const topVideo = results[0] || null;

  const bestEngagement = results.length
    ? Math.max(...results.map(v =>
        v.views > 0 ? parseFloat(((v.likes / v.views) * 100).toFixed(2)) : 0
      ))
    : 0;

  const getEngagementBg = (rate) => {
    if (rate >= 5) return "rgba(0,212,160,0.12)";
    if (rate >= 2) return "rgba(255,184,77,0.12)";
    return "rgba(255,107,107,0.12)";
  };

  const getEngagementColor = (rate) => {
    if (rate >= 5) return S.sage;
    if (rate >= 2) return S.sand;
    return S.red;
  };

  const getTopKeywords = () => {
    if (!results.length) return [];
    const stop = new Set([
      "the","a","an","and","or","but","in","on","at","to","for","of","with",
      "by","from","is","it","this","that","was","are","be","as","i","you",
      "he","she","we","they","my","your","his","her","our","its","have","has",
      "had","do","did","will","would","could","should","may","might","vs","ft",
      "amp","how","what","why","when","who","not","no","so","if","up","out","about","all",
    ]);
    const count = {};
    results.forEach(v =>
      v.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).forEach(w => {
        if (w.length > 2 && !stop.has(w)) count[w] = (count[w] || 0) + 1;
      })
    );
    return Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word, cnt]) => ({ word, count: cnt }));
  };

  const topKeywords = getTopKeywords();

  const getBestTimeToPost = () => {
    if (!results.length) return null;
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayViews = {}, hourViews = {}, dayCounts = {}, hourCounts = {};
    results.forEach(v => {
      const date = new Date(v.published_at);
      const day  = days[date.getUTCDay()];
      const hour = date.getUTCHours();
      dayCounts[day]  = (dayCounts[day]  || 0) + 1;
      dayViews[day]   = (dayViews[day]   || 0) + v.views;
      const bucket = hour < 6  ? "Late Night (12am–6am)"
                   : hour < 12 ? "Morning (6am–12pm)"
                   : hour < 18 ? "Afternoon (12pm–6pm)"
                   :             "Evening (6pm–12am)";
      hourCounts[bucket] = (hourCounts[bucket] || 0) + 1;
      hourViews[bucket]  = (hourViews[bucket]  || 0) + v.views;
    });
    return {
      dayCounts, hourCounts, dayViews, hourViews,
      topDay:  Object.entries(dayViews).sort((a, b) => b[1] - a[1])[0],
      topTime: Object.entries(hourViews).sort((a, b) => b[1] - a[1])[0],
    };
  };

  const postingData         = getBestTimeToPost();
  const smallChannelWinCount = results.filter(v => v.small_channel_win).length;

  const getVideoRecommendation = () => {
    if (!results.length || !postingData) return null;
    const best = results.reduce((acc, v) => {
      const r    = v.views > 0 ? (v.likes / v.views) * 100 : 0;
      const accR = acc.views > 0 ? (acc.likes / acc.views) * 100 : 0;
      return r > accR ? v : acc;
    }, results[0]);
    const t = best?.title?.toLowerCase() || "";
    let format = "analysis";
    if      (t.includes("reaction") || t.includes("reacts"))            format = "reaction";
    else if (t.includes("highlight") || t.includes("goals"))            format = "highlights";
    else if (t.includes("vs") || t.includes("versus"))                  format = "comparison";
    else if (t.includes("predict") || t.includes("preview"))            format = "predictions";
    else if (t.includes("rank") || t.includes("best") || t.includes("top")) format = "ranking";
    else if (t.includes("explain") || t.includes("why") || t.includes("how")) format = "explainer";
    else if (t.includes("interview") || t.includes("press"))            format = "interview breakdown";
    const qWords     = query.toLowerCase().split(" ");
    const topKeyword = topKeywords.find(k => !qWords.includes(k.word))?.word || topKeywords[0]?.word || query;
    return {
      format, topKeyword,
      bestDay:  postingData.topDay[0],
      bestTime: postingData.topTime[0],
      opportunityLevel: smallChannelWinCount >= 2 ? "high" : smallChannelWinCount === 1 ? "medium" : "low",
      bestEngagementVideo: best,
    };
  };

  const recommendation = getVideoRecommendation();

  const scatterData = results.map((v, i) => ({
    x:               Math.round(v.views / 1000),
    y:               v.views > 0 ? parseFloat(((v.likes / v.views) * 100).toFixed(2)) : 0,
    z:               Math.max(Math.round(v.comments / 10), 10),
    title:           v.title.slice(0, 40) + "...",
    channel:         v.channel,
    views:           v.views,
    video_id:        v.video_id,
    isTop:           i === 0,
    isSmallWin:      v.small_channel_win,
    isBestEngagement: recommendation?.bestEngagementVideo?.video_id === v.video_id,
  }));

  const visibleResults = results.slice(0, visibleCount);
  const hasMore        = visibleCount < results.length;

  // Shared styles
  const card = {
    background: S.surface, borderRadius: "12px",
    border: `1px solid ${S.border}`, padding: "24px",
    marginBottom: "40px",
  };

  return (
    <div style={{ fontFamily: "'Inter','Georgia',sans-serif", minHeight: "100vh", background: S.bg, color: S.text }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: S.surface,
        padding: "20px 40px",
        borderBottom: `1px solid ${S.border}`,
      }}>
        <h1 style={{ margin: 0, fontSize: "26px", letterSpacing: "1px", fontWeight: "bold" }}>
          <span style={{ color: S.rust }}>Trend</span>
          <span style={{ color: S.mauve }}>Vision</span>
        </h1>
        <p style={{ margin: "4px 0 0", color: S.muted, fontSize: "14px" }}>
          Don't know what to post? we've got you!
        </p>
      </div>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div style={{ padding: "40px", maxWidth: "920px", margin: "0 auto" }}>

        {/* Search bar */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search a topic e.g. Premier League, Beauty & Lifestyle, Fashion..."
            style={{
              flex: 1, padding: "14px 18px", borderRadius: "10px",
              border: `1px solid ${S.border}`,
              background: S.surface2, color: S.text,
              fontSize: "15px", outline: "none", fontFamily: "inherit",
            }}
          />
          <motion.button
            onClick={search}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={btnTransition}
            style={{
              padding: "14px 28px", borderRadius: "10px", border: "none",
              background: S.rust, color: "#0D1117",
              fontSize: "15px", fontWeight: "bold", cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 0 20px rgba(0,255,194,0.2)",
            }}
          >
            {loading ? "Searching..." : "Search"}
          </motion.button>
        </div>

        {/* Quick topic pills */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "40px" }}>
          {["Workout","Tennis","late night shows","Man City","Champions League"].map((topic) => (
            <motion.button
              key={topic}
              onClick={() => setQuery(topic)}
              whileHover={{ scale: 1.05, borderColor: S.rust }}
              whileTap={{ scale: 0.96 }}
              transition={btnTransition}
              style={{
                padding: "8px 16px", borderRadius: "20px",
                border: `1px solid ${S.border}`,
                background: "transparent", color: S.muted,
                cursor: "pointer", fontSize: "13px", fontFamily: "inherit",
              }}
            >
              {topic}
            </motion.button>
          ))}
        </div>

        {results.length > 0 && (
          <>
            {/* ── Summary Cards — staggered entrance ──────────────────────── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "40px" }}
            >
              {(() => {
                const bestEngV = results.reduce((best, v) => {
                  const r  = v.views > 0 ? (v.likes / v.views) * 100 : 0;
                  const br = best.views > 0 ? (best.likes / best.views) * 100 : 0;
                  return r > br ? v : best;
                }, results[0]);
                return [
                  { label: "Videos Analyzed",     value: results.length,                  color: S.sky,  sub: null },
                  { label: "Avg Views",            value: formatNum(avgViews),             color: S.sage, sub: null },
                  { label: "Top Video Views",      value: formatNum(topVideo?.views || 0), color: S.rust, sub: null },
                  { label: "Best Engagement Rate", value: bestEngagement + "%",            color: S.sand,
                    sub: bestEngV ? `${formatNum(bestEngV.likes)} likes ÷ ${formatNum(bestEngV.views)} views × 100` : null },
                ].map((c) => (
                  <motion.div
                    key={c.label}
                    variants={fadeSlideUp}
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      background: S.surface, borderRadius: "12px", padding: "20px",
                      border: `1px solid ${S.border}`,
                      borderLeft: `3px solid ${c.color}`,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "28px", fontWeight: "bold", color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: "12px", color: S.muted, marginTop: "4px" }}>{c.label}</div>
                    {c.sub && <div style={{ fontSize: "10px", color: S.dim, marginTop: "5px" }}>{c.sub}</div>}
                  </motion.div>
                ));
              })()}
            </motion.div>

            {/* ── Small channel win banner ─────────────────────────────────── */}
            {smallChannelWinCount > 0 && (
              <div style={{
                background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.25)",
                borderRadius: "12px", padding: "16px 20px", marginBottom: "40px",
                display: "flex", alignItems: "center", gap: "12px",
              }}>
                <span style={{ fontSize: "22px" }}>🚀</span>
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

            {/* ── Scatter Plot ─────────────────────────────────────────────── */}
            <div style={{ ...card }}>
              <h2 style={{ margin: "0 0 6px", fontSize: "15px", color: S.text }}>Views vs Engagement Rate</h2>
              <p style={{ margin: "0 0 12px", fontSize: "13px", color: S.muted }}>
                Top-right = high views AND high engagement. Click any dot to open the video.
              </p>
              <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                {[
                  { color: S.sand,  label: "⭐ Recommended to study" },
                  { color: S.sage,  label: "🚀 Small channel win" },
                  { color: S.mauve, label: "👑 Most views" },
                  { color: S.sky,   label: "Other videos" },
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
                  <ZAxis type="number" dataKey="z" />
                  <Tooltip content={<GlassTooltip />} />
                  <Scatter data={scatterData} shape={<CustomDot />} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* ── Bar Chart ────────────────────────────────────────────────── */}
            <div style={{ ...card }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "15px", color: S.text }}>
                Views & Likes by Video (×1000)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                  <XAxis dataKey="name" tick={{ fill: S.muted, fontSize: 10 }} />
                  <YAxis tick={{ fill: S.muted, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(43,47,54,0.92)",
                      border: `1px solid ${S.border}`,
                      borderRadius: "8px", color: S.text,
                    }}
                    formatter={(val) => [`${val}K`]}
                  />
                  <Bar dataKey="views" fill={S.sky}  radius={[4,4,0,0]} name="Views" />
                  <Bar dataKey="likes" fill={S.rust} radius={[4,4,0,0]} name="Likes" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Keywords ─────────────────────────────────────────────────── */}
            {topKeywords.length > 0 && (
              <div style={{ ...card }}>
                <h2 style={{ margin: "0 0 8px", fontSize: "15px", color: S.text }}>
                  Keywords Dominating Titles Right Now
                </h2>
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: S.muted }}>
                  Use these in your title to match what's already trending
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {topKeywords.map(({ word, count }) => (
                    <div key={word} style={{
                      background: count >= 3 ? "rgba(0,255,194,0.08)" : S.surface2,
                      border: `1px solid ${count >= 3 ? "rgba(0,255,194,0.3)" : S.border}`,
                      borderRadius: "20px", padding: "6px 14px",
                      display: "flex", alignItems: "center", gap: "8px",
                    }}>
                      <span style={{ color: S.text, fontSize: "14px", fontWeight: count >= 3 ? "bold" : "normal" }}>
                        {word}
                      </span>
                      <span style={{
                        background: count >= 3 ? S.rust : S.dim,
                        color: count >= 3 ? "#0D1117" : S.text,
                        fontSize: "11px", borderRadius: "10px",
                        padding: "1px 7px", fontWeight: "bold",
                      }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Best Time to Post ────────────────────────────────────────── */}
            {postingData && (
              <div style={{ ...card }}>
                <h2 style={{ margin: "0 0 8px", fontSize: "15px", color: S.text }}>Best Time to Post</h2>
                <p style={{ margin: "0 0 20px", fontSize: "13px", color: S.muted }}>
                  Based on which posting windows produced the highest total views
                </p>
                <div style={{
                  background: S.surface2, border: `1px solid ${S.border}`,
                  borderRadius: "10px", padding: "16px", marginBottom: "20px",
                  display: "flex", gap: "24px",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "26px", fontWeight: "bold", color: S.rust }}>{postingData.topDay[0]}</div>
                    <div style={{ fontSize: "12px", color: S.muted, marginTop: "4px" }}>Best day by views</div>
                    <div style={{ fontSize: "10px", color: S.dim, marginTop: "3px" }}>
                      {formatNum(postingData.topDay[1])} total views across {postingData.dayCounts[postingData.topDay[0]]} video{postingData.dayCounts[postingData.topDay[0]] !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ width: "1px", background: S.border }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "18px", fontWeight: "bold", color: S.rust }}>{postingData.topTime[0]}</div>
                    <div style={{ fontSize: "12px", color: S.muted, marginTop: "4px" }}>Best time window (UTC)</div>
                    <div style={{ fontSize: "10px", color: S.dim, marginTop: "3px" }}>
                      {formatNum(postingData.topTime[1])} total views across {postingData.hourCounts[postingData.topTime[0]]} video{postingData.hourCounts[postingData.topTime[0]] !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <p style={{ margin: "0 0 10px", fontSize: "13px", color: S.muted }}>Posts by day of week:</p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
                  {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(day => {
                    const count = postingData.dayCounts[day] || 0;
                    const views = postingData.dayViews[day] || 0;
                    const isTop = day === postingData.topDay[0];
                    return (
                      <div key={day} style={{
                        background: isTop ? "rgba(0,255,194,0.08)" : S.surface2,
                        border: `1px solid ${isTop ? "rgba(0,255,194,0.3)" : S.border}`,
                        borderRadius: "8px", padding: "10px 14px",
                        textAlign: "center", minWidth: "80px",
                      }}>
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: isTop ? S.rust : S.muted }}>{count} vid{count !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize: "11px", color: S.dim, marginTop: "2px" }}>{day.slice(0, 3)}</div>
                        {views > 0 && <div style={{ fontSize: "10px", color: S.dim, marginTop: "2px" }}>{formatNum(views)} views</div>}
                      </div>
                    );
                  })}
                </div>

                <p style={{ margin: "0 0 10px", fontSize: "13px", color: S.muted }}>Posts by time of day (UTC):</p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {["Morning (6am–12pm)","Afternoon (12pm–6pm)","Evening (6pm–12am)","Late Night (12am–6am)"].map(bucket => {
                    const count = postingData.hourCounts[bucket] || 0;
                    const views = postingData.hourViews[bucket] || 0;
                    const isTop = bucket === postingData.topTime[0];
                    return (
                      <div key={bucket} style={{
                        background: isTop ? "rgba(0,255,194,0.08)" : S.surface2,
                        border: `1px solid ${isTop ? "rgba(0,255,194,0.3)" : S.border}`,
                        borderRadius: "8px", padding: "10px 14px",
                        textAlign: "center", flex: 1, minWidth: "120px",
                      }}>
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: isTop ? S.rust : S.muted }}>{count} vid{count !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize: "11px", color: S.dim, marginTop: "2px" }}>{bucket}</div>
                        {views > 0 && <div style={{ fontSize: "10px", color: S.dim, marginTop: "2px" }}>{formatNum(views)} views</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Content Gap Analysis ─────────────────────────────────────── */}
            {(analyzing || gapAnalysis || analyzeError) && (
              <div style={{ ...card }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "22px" }}>🔍</span>
                  <h2 style={{ margin: 0, fontSize: "17px", color: S.text }}>Content Gap Analysis</h2>
                  <span style={{
                    background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)",
                    color: S.mauve, fontSize: "11px", padding: "3px 10px",
                    borderRadius: "12px", fontWeight: "bold",
                  }}>
                    AI-powered
                  </span>
                </div>

                {analyzing && (
                  <div style={{ color: S.muted, fontSize: "14px", fontStyle: "italic" }}>
                    Analysing top videos for content gaps...
                  </div>
                )}
                {analyzeError && (
                  <div style={{ color: S.red, fontSize: "13px" }}>
                    Could not load analysis — make sure the backend is running at localhost:8000.
                  </div>
                )}

                {gapAnalysis && (
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                  >
                    <motion.div variants={fadeSlideUp} style={{
                      background: S.surface2, border: `1px solid ${S.border}`,
                      borderRadius: "10px", padding: "16px",
                    }}>
                      <div style={{ fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                        What's already saturated
                      </div>
                      <div style={{ fontSize: "14px", color: S.text }}>{gapAnalysis.saturated}</div>
                    </motion.div>

                    <motion.div variants={fadeSlideUp} style={{
                      background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.25)",
                      borderRadius: "10px", padding: "16px",
                    }}>
                      <div style={{ fontSize: "11px", color: S.sage, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                        The gap nobody is filling
                      </div>
                      <div style={{ fontSize: "14px", color: S.text }}>{gapAnalysis.gap}</div>
                    </motion.div>

                    <motion.div variants={fadeSlideUp} style={{
                      background: "rgba(0,255,194,0.06)", border: "1px solid rgba(0,255,194,0.25)",
                      borderRadius: "10px", padding: "16px",
                    }}>
                      <div style={{ fontSize: "11px", color: S.rust, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                        Your video title
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: S.text }}>
                        "{gapAnalysis.suggested_title}"
                      </div>
                    </motion.div>

                    {gapAnalysis.reasoning && (
                      <motion.div variants={fadeSlideUp} style={{
                        background: S.surface2, border: `1px solid ${S.border}`,
                        borderRadius: "10px", padding: "16px",
                      }}>
                        <div style={{ fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                          Why this is a strong opportunity
                        </div>
                        <div style={{ fontSize: "14px", color: S.text, lineHeight: "1.7" }}>
                          {gapAnalysis.reasoning}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {/* ── Video Recommendation ─────────────────────────────────────── */}
            {recommendation && (
              <div style={{ ...card }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "22px" }}>🎬</span>
                  <h2 style={{ margin: 0, fontSize: "17px", color: S.text }}>Your Video Recommendation</h2>
                  <span style={{
                    background: recommendation.opportunityLevel === "high"   ? "rgba(0,212,160,0.12)"
                              : recommendation.opportunityLevel === "medium" ? "rgba(255,184,77,0.12)"
                              :                                                 "rgba(255,107,107,0.12)",
                    border: `1px solid ${
                              recommendation.opportunityLevel === "high"   ? S.sage
                            : recommendation.opportunityLevel === "medium" ? S.sand : S.red}`,
                    color: recommendation.opportunityLevel === "high"   ? S.sage
                         : recommendation.opportunityLevel === "medium" ? S.sand : S.red,
                    fontSize: "11px", padding: "3px 10px", borderRadius: "12px", fontWeight: "bold",
                  }}>
                    {recommendation.opportunityLevel === "high"   ? "🟢 High opportunity"
                   : recommendation.opportunityLevel === "medium" ? "🟡 Medium opportunity"
                   :                                                 "🔴 Competitive space"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                  {[
                    { label: "Format",         value: recommendation.format.charAt(0).toUpperCase() + recommendation.format.slice(1), sub: "Highest engagement style", color: S.mauve },
                    { label: "Post on",        value: recommendation.bestDay,    sub: recommendation.bestTime,       color: S.sky  },
                    { label: "Key word to use",value: recommendation.topKeyword.charAt(0).toUpperCase() + recommendation.topKeyword.slice(1), sub: "Top performing keyword", color: S.sand  },
                  ].map(item => (
                    <motion.div
                      key={item.label}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        background: S.surface2, border: `1px solid ${S.border}`,
                        borderRadius: "10px", padding: "16px", textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: S.muted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>{item.label}</div>
                      <div style={{ fontSize: "15px", fontWeight: "bold", color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: "11px", color: S.dim, marginTop: "4px" }}>{item.sub}</div>
                    </motion.div>
                  ))}
                </div>

                {recommendation.bestEngagementVideo && (
                  <div style={{
                    marginTop: "16px", background: S.surface2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "10px", padding: "14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
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
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      transition={btnTransition}
                      onClick={() => window.open(`https://youtube.com/watch?v=${recommendation.bestEngagementVideo.video_id}`, "_blank")}
                      style={{
                        background: S.rust, border: "none", color: "#0D1117",
                        padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                        fontSize: "12px", fontWeight: "bold", whiteSpace: "nowrap", marginLeft: "16px",
                        fontFamily: "inherit",
                      }}
                    >
                      Watch it →
                    </motion.button>
                  </div>
                )}
              </div>
            )}

            {/* ── AI Ideation Hub ─────────────────────────────────────────── */}
            <div style={{ ...card }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "22px" }}>✨</span>
                <h2 style={{ margin: 0, fontSize: "17px", color: S.text }}>AI Ideation Hub</h2>
                <span style={{
                  background: "rgba(0,255,194,0.1)", border: "1px solid rgba(0,255,194,0.3)",
                  color: S.rust, fontSize: "11px", padding: "3px 10px",
                  borderRadius: "12px", fontWeight: "bold",
                }}>Blueprint Generator</span>
              </div>
              <p style={{ margin: "0 0 20px", fontSize: "13px", color: S.muted }}>
                Ready to crush this niche? Let the agent build your full content blueprint.
              </p>

              {!ideating && !ideas && (
                <motion.button
                  onClick={generateIdeas}
                  whileHover={{ scale: 1.02, boxShadow: "0 0 32px rgba(0,255,194,0.25)" }}
                  whileTap={{ scale: 0.97 }}
                  transition={btnTransition}
                  style={{
                    width: "100%", padding: "16px", borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(0,255,194,0.1), rgba(59,123,255,0.1))",
                    border: "1px solid rgba(0,255,194,0.3)",
                    color: S.rust, fontSize: "15px", fontWeight: "bold",
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>🪄</span>
                  Generate 3 High-Potential Concepts
                </motion.button>
              )}

              {ideating && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{
                    padding: "14px", borderRadius: "10px",
                    border: "1px solid rgba(0,255,194,0.2)",
                    background: "rgba(0,255,194,0.05)",
                    color: S.rust, fontSize: "14px", fontWeight: "bold", textAlign: "center",
                  }}>
                    <motion.span
                      key={loadingMsgIdx}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      ⚙️ {loadingMessages[loadingMsgIdx]}
                    </motion.span>
                  </div>
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.25 }}
                      style={{
                        background: S.surface2, border: `1px solid ${S.border}`,
                        borderRadius: "16px", padding: "24px",
                        display: "flex", flexDirection: "column", gap: "12px",
                      }}
                    >
                      <div style={{ height: "14px", background: S.border, borderRadius: "8px", width: "38%" }} />
                      <div style={{ height: "11px", background: S.border, borderRadius: "8px", width: "95%" }} />
                      <div style={{ height: "11px", background: S.border, borderRadius: "8px", width: "80%" }} />
                      <div style={{ height: "11px", background: S.border, borderRadius: "8px", width: "62%" }} />
                      <div style={{ height: "38px", background: S.border, borderRadius: "8px", width: "100%", marginTop: "8px" }} />
                    </motion.div>
                  ))}
                </div>
              )}

              {ideateError && (
                <div style={{ color: S.red, fontSize: "13px", marginTop: "12px" }}>
                  Could not generate ideas — make sure the backend is running at localhost:8000.
                </div>
              )}

              {ideas && (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  style={{ display: "flex", flexDirection: "column", gap: "16px" }}
                >
                  {ideas.map((idea, i) => (
                    <motion.div
                      key={i}
                      variants={fadeSlideUp}
                      style={{
                        background: S.surface2,
                        border: "1px solid rgba(0,255,194,0.22)",
                        boxShadow: "0 0 28px rgba(0,255,194,0.05)",
                        borderRadius: "16px", padding: "24px",
                      }}
                    >
                      <div style={{ marginBottom: "16px" }}>
                        <span style={{
                          background: "rgba(0,255,194,0.1)", border: "1px solid rgba(0,255,194,0.3)",
                          color: S.rust, fontSize: "11px", padding: "4px 12px",
                          borderRadius: "12px", fontWeight: "bold",
                        }}>
                          Concept #{i + 1}: {idea.badge}
                        </span>
                      </div>

                      <div style={{
                        background: S.surface, border: `1px solid ${S.border}`,
                        borderRadius: "10px", padding: "14px", marginBottom: "16px",
                      }}>
                        <div style={{ fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                          Why this will work
                        </div>
                        <div style={{ fontSize: "13px", color: S.text, lineHeight: "1.65" }}>{idea.angle}</div>
                      </div>

                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
                          3 Optimised Titles
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {idea.titles.map((title, j) => (
                            <div key={j} style={{
                              background: S.surface, border: `1px solid ${S.border}`,
                              borderRadius: "8px", padding: "10px 14px",
                              display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
                            }}>
                              <span style={{ fontSize: "13px", color: S.text, flex: 1 }}>{title}</span>
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => copyToClipboard(title, `title-${i}-${j}`)}
                                style={{
                                  background: copiedId === `title-${i}-${j}` ? "rgba(0,212,160,0.15)" : "transparent",
                                  border: `1px solid ${copiedId === `title-${i}-${j}` ? S.sage : S.border}`,
                                  color: copiedId === `title-${i}-${j}` ? S.sage : S.dim,
                                  borderRadius: "6px", padding: "4px 10px",
                                  cursor: "pointer", fontSize: "11px", fontWeight: "bold",
                                  fontFamily: "inherit", whiteSpace: "nowrap",
                                }}
                              >
                                {copiedId === `title-${i}-${j}` ? "✓ Copied" : "⎘ Copy"}
                              </motion.button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ background: "#0D1117", border: `1px solid ${S.border}`, borderRadius: "10px", padding: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF5F57" }} />
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FEBC2E" }} />
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#28C840" }} />
                            <span style={{ fontSize: "11px", color: S.dim, marginLeft: "6px", fontFamily: "monospace" }}>thumbnail_prompt.txt</span>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => copyToClipboard(idea.thumbnail_prompt, `thumb-${i}`)}
                            style={{
                              background: copiedId === `thumb-${i}` ? "rgba(0,212,160,0.15)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${copiedId === `thumb-${i}` ? S.sage : S.border}`,
                              color: copiedId === `thumb-${i}` ? S.sage : S.muted,
                              borderRadius: "6px", padding: "4px 12px",
                              cursor: "pointer", fontSize: "11px", fontWeight: "bold", fontFamily: "inherit",
                            }}
                          >
                            {copiedId === `thumb-${i}` ? "✓ Copied!" : "Copy Prompt"}
                          </motion.button>
                        </div>
                        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#88A3D6", lineHeight: "1.7" }}>
                          {idea.thumbnail_prompt}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  <motion.button
                    onClick={generateIdeas}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={btnTransition}
                    style={{
                      padding: "12px", borderRadius: "10px",
                      border: `1px solid ${S.border}`,
                      background: "transparent", color: S.muted,
                      fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    ↻ Regenerate concepts
                  </motion.button>
                </motion.div>
              )}
            </div>

            {/* ── Video Results ────────────────────────────────────────────── */}
            <h2 style={{ fontSize: "15px", color: S.text, marginBottom: "16px" }}>
              Top Videos for "{query}"
              <span style={{ fontSize: "13px", color: S.muted, fontWeight: "normal", marginLeft: "8px" }}>
                — showing {Math.min(visibleCount, results.length)} of {results.length}
              </span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {visibleResults.map((v, i) => {
                const engagementRate = v.views > 0 ? parseFloat(((v.likes / v.views) * 100).toFixed(2)) : 0;
                return (
                  <motion.div
                    key={v.video_id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.01, y: -1 }}
                    style={{
                      background: S.surface,
                      borderRadius: "12px", padding: "16px",
                      display: "flex", gap: "16px", alignItems: "center",
                      border: `1px solid ${S.border}`,
                      borderLeft: i === 0 ? `3px solid ${S.sand}` : v.small_channel_win ? `3px solid ${S.sage}` : `1px solid ${S.border}`,
                    }}
                  >
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: S.dim, minWidth: "28px" }}>{i + 1}</div>
                    <img
                      src={v.thumbnail} alt=""
                      style={{ width: "120px", height: "68px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }}
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
                            background: "rgba(0,212,160,0.1)", border: "1px solid rgba(0,212,160,0.3)",
                            color: S.sage, fontSize: "11px", padding: "2px 8px",
                            borderRadius: "12px", fontWeight: "bold", whiteSpace: "nowrap",
                          }}>
                            🚀 Small channel win
                          </span>
                        )}
                      </div>
                      <div style={{ color: S.muted, fontSize: "12px", marginTop: "4px" }}>
                        {v.channel}
                        {v.subscribers > 0 && (
                          <span style={{ color: S.dim, marginLeft: "8px" }}>· {formatNum(v.subscribers)} subscribers</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px", alignItems: "center" }}>
                        <span style={{ color: S.sky,   fontSize: "13px" }}>👁 {formatNum(v.views)}</span>
                        <span style={{ color: S.sage,  fontSize: "13px" }}>👍 {formatNum(v.likes)}</span>
                        <span style={{ color: S.mauve, fontSize: "13px" }}>💬 {formatNum(v.comments)}</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{
                            background: getEngagementBg(engagementRate),
                            color: getEngagementColor(engagementRate),
                            fontSize: "11px", padding: "2px 8px",
                            borderRadius: "12px", fontWeight: "bold",
                            border: `1px solid ${getEngagementColor(engagementRate)}44`,
                          }}>
                            {engagementRate}% engagement
                          </span>
                          <span style={{ fontSize: "10px", color: S.dim, textAlign: "center" }}>
                            {formatNum(v.likes)} likes ÷ {formatNum(v.views)} views × 100
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* View more */}
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: "24px", marginBottom: "40px" }}>
                <motion.button
                  onClick={() => setVisibleCount(prev => Math.min(prev + 10, results.length))}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={btnTransition}
                  style={{
                    padding: "12px 32px", borderRadius: "10px",
                    border: `1px solid ${S.border}`,
                    background: S.surface, color: S.rust,
                    fontSize: "14px", fontWeight: "bold",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  View more ({results.length - visibleCount} remaining)
                </motion.button>
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

        {/* Initial / landing state */}
        {!searched && (
          <div style={{ marginTop: "60px" }}>
            <div style={{
              background: S.surface, border: `1px solid ${S.border}`,
              borderRadius: "16px", padding: "40px",
              textAlign: "center", maxWidth: "680px", margin: "0 auto",
            }}>
              <p style={{ fontSize: "48px", margin: "0 0 16px" }}>📊</p>
              <h2 style={{ fontSize: "20px", color: S.text, margin: "0 0 16px", fontWeight: "bold" }}>
                Designed for new YouTube creators
              </h2>
              <p style={{ fontSize: "15px", color: S.muted, lineHeight: "1.7", margin: "0 0 28px" }}>
                TrendVision helps you figure out{" "}
                <strong style={{ color: S.rust }}>what to post before you post it</strong>.
                Search any topic and instantly see which videos are gaining traction, what engagement
                looks like, whether small channels are breaking through, the best time to publish,
                and which keywords dominate titles — all backed by live YouTube data from the last 30 days.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                {[
                  { text: "Views vs Engagement chart", color: S.sky   },
                  { text: "Best keywords for your post", color: S.mauve },
                  { text: "Best time to post",          color: S.rust  },
                ].map(item => (
                  <div key={item.text} style={{
                    background: S.surface2, border: `1px solid ${S.border}`,
                    borderRadius: "10px", padding: "12px 16px",
                  }}>
                    <span style={{ fontSize: "12px", color: item.color }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Big KOK Chatbot ─────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 1000 }}>
          {chatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: "340px", height: "460px",
                background: S.surface,
                border: `1px solid ${S.border}`,
                borderRadius: "16px",
                boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                display: "flex", flexDirection: "column",
                marginBottom: "12px", overflow: "hidden",
              }}
            >
              {/* Header */}
              <div style={{
                padding: "14px 16px",
                borderBottom: `1px solid ${S.border}`,
                display: "flex", alignItems: "center", gap: "10px",
                background: S.surface2,
              }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #00FFC2, #3B7BFF)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", fontWeight: "bold", color: "#0D1117",
                }}>K</div>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "14px", color: S.text }}>Big KOK</div>
                  <div style={{ fontSize: "11px", color: S.sage }}>● Live — ask me about these stats</div>
                </div>
              </div>

              {/* Messages */}
              <div style={{
                flex: 1, overflowY: "auto", padding: "14px",
                display: "flex", flexDirection: "column", gap: "10px",
              }}>
                {chatMessages.length === 0 && (
                  <div style={{ color: S.muted, fontSize: "13px", textAlign: "center", marginTop: "20px" }}>
                    Ask me anything about the <strong style={{ color: S.rust }}>"{query}"</strong> data — best posting time, top keywords, which video to study, and more.
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: msg.role === "user"
                      ? "rgba(0,255,194,0.12)"
                      : S.surface2,
                    border: `1px solid ${msg.role === "user" ? "rgba(0,255,194,0.25)" : S.border}`,
                    borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    padding: "10px 13px",
                    fontSize: "13px",
                    color: S.text,
                    lineHeight: "1.6",
                  }}>
                    {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{
                    alignSelf: "flex-start",
                    background: S.surface2, border: `1px solid ${S.border}`,
                    borderRadius: "12px 12px 12px 4px", padding: "10px 13px",
                  }}>
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ color: S.muted, fontSize: "13px" }}
                    >
                      Thinking...
                    </motion.span>
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{
                padding: "12px",
                borderTop: `1px solid ${S.border}`,
                display: "flex", gap: "8px",
              }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder="Ask about the stats..."
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: "8px",
                    border: `1px solid ${S.border}`,
                    background: S.surface2, color: S.text,
                    fontSize: "13px", outline: "none", fontFamily: "inherit",
                  }}
                />
                <motion.button
                  onClick={sendChat}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    padding: "9px 14px", borderRadius: "8px", border: "none",
                    background: S.rust, color: "#0D1117",
                    fontSize: "13px", fontWeight: "bold", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Toggle button */}
          <motion.button
            onClick={() => setChatOpen(o => !o)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            style={{
              width: "56px", height: "56px", borderRadius: "50%", border: "none",
              background: "linear-gradient(135deg, #00FFC2, #3B7BFF)",
              color: "#0D1117", fontSize: "22px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(0,255,194,0.4)",
              fontWeight: "bold",
            }}
          >
            {chatOpen ? "✕" : "💬"}
          </motion.button>
        </div>
      )}
    </div>
  );
}
