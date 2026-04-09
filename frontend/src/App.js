import { useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await axios.get(`http://localhost:8000/search?q=${query}&max_results=10`);
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

  const getEngagementColor = (rate) => {
    if (rate >= 5) return "#166534";
    if (rate >= 2) return "#854d0e";
    return "#7f1d1d";
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>

      {/* Header */}
      <div style={{ background: "#1e3a8a", padding: "24px 40px", borderBottom: "3px solid #3b82f6" }}>
        <h1 style={{ margin: 0, fontSize: "28px", color: "#fff" }}>📺 TrendVision</h1>
        <p style={{ margin: "4px 0 0", color: "#93c5fd", fontSize: "14px" }}>
          YouTube Analytics Dashboard — Find what's trending before you post
        </p>
      </div>

      {/* Search */}
      <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "40px" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search a topic e.g. Premier League, Arsenal, Salah..."
            style={{
              flex: 1, padding: "14px 18px", borderRadius: "8px",
              border: "2px solid #3b82f6", background: "#1e293b",
              color: "#f1f5f9", fontSize: "16px", outline: "none"
            }}
          />
          <button
            onClick={search}
            style={{
              padding: "14px 28px", borderRadius: "8px", border: "none",
              background: "#3b82f6", color: "#fff", fontSize: "16px",
              fontWeight: "bold", cursor: "pointer"
            }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Quick topic buttons */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "40px" }}>
          {["Premier League", "Arsenal", "Mohamed Salah", "Man City", "Champions League"].map((topic) => (
            <button
              key={topic}
              onClick={() => setQuery(topic)}
              style={{
                padding: "8px 16px", borderRadius: "20px", border: "1px solid #3b82f6",
                background: "transparent", color: "#93c5fd", cursor: "pointer", fontSize: "13px"
              }}
            >
              {topic}
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <>
            {/* Summary Cards — now 4 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "40px" }}>
              {[
                { label: "Videos Analyzed", value: results.length },
                { label: "Avg Views", value: formatNum(avgViews) },
                { label: "Top Video Views", value: formatNum(topVideo?.views || 0) },
                { label: "Best Engagement Rate", value: bestEngagement + "%" },
              ].map((card) => (
                <div key={card.label} style={{
                  background: "#1e293b", borderRadius: "12px", padding: "20px",
                  borderLeft: "4px solid #3b82f6", textAlign: "center"
                }}>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: "#3b82f6" }}>{card.value}</div>
                  <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Bar Chart */}
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "24px", marginBottom: "40px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "16px", color: "#93c5fd" }}>
                📊 Views & Likes by Video (in thousands)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: "8px" }}
                    formatter={(val) => [`${val}K`]}
                  />
                  <Bar dataKey="views" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Views" />
                  <Bar dataKey="likes" fill="#22c55e" radius={[4, 4, 0, 0]} name="Likes" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Video Results */}
            <h2 style={{ fontSize: "16px", color: "#93c5fd", marginBottom: "16px" }}>
              🎥 Top Videos for "{query}"
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {results.map((v, i) => {
                const engagementRate = v.views > 0
                  ? parseFloat(((v.likes / v.views) * 100).toFixed(2))
                  : 0;

                return (
                  <div key={v.video_id} style={{
                    background: "#1e293b", borderRadius: "12px", padding: "16px",
                    display: "flex", gap: "16px", alignItems: "center",
                    borderLeft: i === 0 ? "4px solid #f59e0b" : "4px solid #1e293b"
                  }}>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#475569", minWidth: "28px" }}>
                      {i + 1}
                    </div>
                    <img
                      src={v.thumbnail}
                      alt=""
                      style={{ width: "120px", height: "68px", borderRadius: "6px", objectFit: "cover" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        onClick={() => window.open(`https://youtube.com/watch?v=${v.video_id}`, "_blank")}
                        style={{ color: "#f1f5f9", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}
                      >
                        {v.title}
                      </div>
                      <div style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}>{v.channel}</div>
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px", alignItems: "center" }}>
                        <span style={{ color: "#3b82f6", fontSize: "13px" }}>👁 {formatNum(v.views)}</span>
                        <span style={{ color: "#22c55e", fontSize: "13px" }}>👍 {formatNum(v.likes)}</span>
                        <span style={{ color: "#a78bfa", fontSize: "13px" }}>💬 {formatNum(v.comments)}</span>
                        <span style={{
                          background: getEngagementColor(engagementRate),
                          color: "#fff", fontSize: "11px", padding: "2px 8px",
                          borderRadius: "12px", fontWeight: "bold"
                        }}>
                          {engagementRate}% engagement
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Empty state */}
        {searched && !loading && results.length === 0 && (
          <div style={{ textAlign: "center", color: "#475569", marginTop: "60px" }}>
            <p style={{ fontSize: "48px" }}>🔍</p>
            <p>No results found. Try a different search term.</p>
          </div>
        )}

        {/* Initial state */}
        {!searched && (
          <div style={{ textAlign: "center", color: "#475569", marginTop: "60px" }}>
            <p style={{ fontSize: "48px" }}>📺</p>
            <p style={{ fontSize: "16px" }}>Search a topic to see what's trending on YouTube</p>
            <p style={{ fontSize: "13px" }}>Try "Premier League" or click a topic above</p>
          </div>
        )}
      </div>
    </div>
  );
}