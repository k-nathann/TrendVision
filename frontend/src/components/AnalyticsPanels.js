import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { formatNum, POSTING_DAYS, POSTING_WINDOWS } from "../analytics";

const chartTick = { fill: "var(--text-muted, #667085)", fontSize: 11 };

function ScatterDot({ cx, cy, payload }) {
  if (!payload) return null;
  const dotClass = payload.isBestEngagement ? "dot-best"
    : payload.isSmallWin ? "dot-small"
      : payload.isTop ? "dot-top" : "dot-other";
  const openVideo = () => {
    if (payload.video_id) {
      window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(payload.video_id)}`, "_blank", "noopener,noreferrer");
    }
  };
  return (
    <circle
      className={`scatter-dot ${dotClass}`}
      cx={cx}
      cy={cy}
      r={Math.max(6, Math.min(14, Math.sqrt(payload.z) * 1.5))}
      fillOpacity={0.85}
      role="link"
      tabIndex={0}
      aria-label={`Watch ${payload.fullTitle} on YouTube (opens a new tab)`}
      onClick={openVideo}
      onKeyDown={event => { if (event.key === 'Enter') openVideo(); }}
    />
  );
}

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const video = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{video.fullTitle}</strong>
      <p className="muted">{video.channel}</p>
      <div className="tooltip-metrics">
        <span>{formatNum(video.views)} views</span>
        <span>{video.y}% engagement</span>
      </div>
      {video.isBestEngagement && <p>Highest engagement</p>}
      {video.isSmallWin && <p>Small channel win</p>}
      <p className="muted">Select the point to open this video.</p>
    </div>
  );
}

function ViewsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{payload[0].payload.fullTitle}</strong>
      <div className="tooltip-metrics">
        {payload.map((entry) => <span key={entry.dataKey}>{entry.name}: {entry.value}K</span>)}
      </div>
    </div>
  );
}

function TimingTable({ caption, label, rows, counts, views, top }) {
  return (
    <table className="compact-table">
      <caption>{caption}</caption>
      <thead><tr><th scope="col">{label}</th><th scope="col">Videos</th><th scope="col">Views</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row} className={row === top ? "is-highlighted" : undefined}>
            <th scope="row">{row}{row === top && <span className="sr-only">, highest total views</span>}</th>
            <td>{counts[row] || 0}</td>
            <td>{formatNum(views[row] || 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AnalyticsPanels({ results, analytics }) {
  const { scatterData, chartData, topKeywords, postingData } = analytics;
  return (
    <section id="analytics" className="analytics-section" aria-labelledby="analytics-heading">
      <div className="section-heading">
        <div><p className="eyebrow">Performance signals</p><h2 id="analytics-heading">Explore the data</h2></div>
        <p className="muted">Across {results.length} returned videos</p>
      </div>
      <div className="analytics-grid">
        <section className="panel analytics-panel" aria-labelledby="engagement-chart-heading">
          <div className="panel-heading">
            <h3 id="engagement-chart-heading">Views vs. engagement</h3>
            <p>Engagement is likes divided by views. Higher and further right means more of both.</p>
          </div>
          <ul className="chart-legend" aria-label="Video point categories">
            <li><span className="legend-dot dot-best" />Highest engagement</li>
            <li><span className="legend-dot dot-small" />Small channel win</li>
            <li><span className="legend-dot dot-top" />Most views</li>
            <li><span className="legend-dot dot-other" />Other videos</li>
          </ul>
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ScatterChart margin={{ top: 10, right: 16, bottom: 22, left: 0 }} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e4e7ec)" />
                <XAxis type="number" dataKey="x" name="Views" tick={chartTick} tickLine={false}
                  label={{ value: "Views (thousands)", position: "insideBottom", offset: -14, ...chartTick }} />
                <YAxis type="number" dataKey="y" name="Engagement" unit="%" tick={chartTick} tickLine={false} width={48} />
                <ZAxis type="number" dataKey="z" />
                <Tooltip content={<ScatterTooltip />} />
                <Scatter data={scatterData} shape={<ScatterDot />} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-note">Point size reflects comments, within a fixed size range. Select a point to open its video, or use the video links in the results table.</p>
        </section>
        <section className="panel analytics-panel" aria-labelledby="views-chart-heading">
          <div className="panel-heading">
            <h3 id="views-chart-heading">Views &amp; likes by video</h3>
            <p>Compare the returned videos, ordered by views.</p>
          </div>
          <ul className="chart-legend" aria-label="Bar chart series">
            <li><span className="legend-dot dot-views" />Views</li>
            <li><span className="legend-dot dot-likes" />Likes</li>
          </ul>
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={chartData} margin={{ top: 10, right: 16, bottom: 22, left: 0 }} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e4e7ec)" vertical={false} />
                <XAxis dataKey="rank" tick={chartTick} tickLine={false}
                  label={{ value: "Video rank by views", position: "insideBottom", offset: -14, ...chartTick }} />
                <YAxis tick={chartTick} tickLine={false} unit="K" width={48} />
                <Tooltip content={<ViewsTooltip />} cursor={{ fill: "var(--background, #f7f8fa)" }} />
                <Bar dataKey="views" fill="var(--accent, #2762c2)" name="Views" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="likes" fill="var(--text-muted, #667085)" name="Likes" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-note">Values are rounded to the nearest thousand. Individual counts are available in the results table.</p>
        </section>
      </div>
      <div className="analytics-grid">
        <section className="panel analytics-panel" aria-labelledby="keywords-heading">
          <div className="panel-heading">
            <h3 id="keywords-heading">Recurring title keywords</h3>
            <p>Word occurrences across these video titles. Common words are excluded.</p>
          </div>
          {topKeywords.length ? (
            <ol className="keyword-list">
              {topKeywords.map(({ word, count }) => (
                <li key={word}><span>{word}</span><span className="keyword-count">{count}<span className="sr-only"> occurrences</span></span></li>
              ))}
            </ol>
          ) : <p className="muted">No recurring keywords were available from these titles.</p>}
        </section>
        <section className="panel analytics-panel" aria-labelledby="posting-heading">
          <div className="panel-heading">
            <h3 id="posting-heading">Publishing patterns</h3>
            <p>Publishing windows with the highest combined views in this sample. All times are UTC.</p>
          </div>
          {postingData?.topDay && postingData?.topTime ? (
            <>
              <dl className="timing-summary">
                <div>
                  <dt>Leading day</dt>
                  <dd>{postingData.topDay[0]}<small>{formatNum(postingData.topDay[1])} views · {postingData.dayCounts[postingData.topDay[0]]} videos</small></dd>
                </div>
                <div>
                  <dt>Leading window</dt>
                  <dd>{postingData.topTime[0]}<small>{formatNum(postingData.topTime[1])} views · {postingData.hourCounts[postingData.topTime[0]]} videos</small></dd>
                </div>
              </dl>
              <p className="chart-note">Combined views reflect this sample and its publishing volume; they do not establish the best time for a new upload.</p>
              <details className="breakdown">
                <summary>View posting breakdown</summary>
                <div className="breakdown-grid">
                  <TimingTable caption="Day of week (UTC)" label="Day" rows={POSTING_DAYS} counts={postingData.dayCounts} views={postingData.dayViews} top={postingData.topDay[0]} />
                  <TimingTable caption="Time of day (UTC)" label="Window" rows={POSTING_WINDOWS} counts={postingData.hourCounts} views={postingData.hourViews} top={postingData.topTime[0]} />
                </div>
              </details>
            </>
          ) : <p className="muted">Publishing times are unavailable for these videos.</p>}
          {postingData?.invalidDateCount > 0 && <p className="chart-note">{postingData.invalidDateCount} videos with unavailable publishing dates are excluded from this breakdown.</p>}
        </section>
      </div>
    </section>
  );
}
