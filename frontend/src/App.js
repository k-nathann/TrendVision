import { memo, useMemo, useRef, useState } from 'react';
import useTopicSearch from './useTopicSearch';
import { deriveAnalytics, engagementRate, formatNum } from './analytics';
import Icon from './components/Icon';
import SearchLoadingState from './components/SearchLoadingState';
import AnalyticsPanels from './components/AnalyticsPanels';
import InsightsPanel from './components/InsightsPanel';
import DataChat from './components/DataChat';
import './App.css';

const MemoAnalyticsPanels = memo(AnalyticsPanels);
const videoUrl = video => `https://www.youtube.com/watch?v=${encodeURIComponent(video.video_id)}`;
const exactNumber = number => Number.isFinite(number) ? number.toLocaleString() : 'Unavailable';

function Header({ hasResults }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <a className="brand" href="#workspace" aria-label="TrendVision topic research"><span className="brand-mark"><Icon name="chart" size={22} /></span>TrendVision</a>
        <div className="workspace-label">Creator workspace</div>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#workspace" aria-current="page"><Icon name="search" />Topic research</a>
          {hasResults && <>
            <a className="nav-link" href="#opportunities"><Icon name="target" />Opportunities</a>
            <a className="nav-link" href="#analytics"><Icon name="chart" />Analytics</a>
            <a className="nav-link" href="#insights"><Icon name="video" />Content insights</a>
            <a className="nav-link" href="#discussion"><Icon name="message" />Discussion</a>
          </>}
          <a className="nav-link methodology-link" href="#methodology"><Icon name="target" />How it works</a>
        </nav>
        <div className="sidebar-note"><span className="eyebrow">The research window</span><strong>Last 30 days</strong><p>A recent snapshot of the videos around your topic.</p></div>
        <div className="sidebar-footer"><span className="workspace-avatar">TV</span><div>TrendVision<span>Content research</span></div></div>
      </aside>
      <header className="topbar"><div><span className="breadcrumb-parent">Workspace <span className="breadcrumb-divider">/</span></span> Topic research</div><span className="source-label"><Icon name="video" size={16} />YouTube analytics</span></header>
    </>
  );
}

function Methodology() {
  return <details className="methodology" id="methodology"><summary>About the data & methodology</summary><div className="methodology-content">
    <p><strong>Search scope.</strong> Up to 30 relevant YouTube videos published in the last 30 days, ordered by views. This is a search sample, not all videos on YouTube.</p>
    <p><strong>Engagement.</strong> Likes divided by views × 100. Comments are shown separately. A video with no views has a 0% engagement rate.</p>
    <p><strong>Small-channel wins.</strong> Videos with more than 50K views from channels with a reported subscriber count below 100K. The existing opportunity indicator is high for two or more wins, medium for one, and low for none. It is a simple signal, not a predicted success score.</p>
    <p><strong>Recommendations.</strong> The suggested format comes from the highest-engagement video’s title; the keyword comes from title frequency. Posting windows use total views by publication day and time in UTC. They describe this sample and don’t establish the best time for every channel.</p>
    <p><strong>Content insights.</strong> Generated interpretations use the top 10 videos’ metadata and available transcript excerpts. Transcript coverage isn’t reported by the service. Review suggestions against the source videos.</p>
  </div></details>;
}

function OpportunityOverview({ analytics }) {
  const { recommendation, smallChannelWinCount, bestEngagementVideo } = analytics;
  if (!recommendation) return null;
  const level = recommendation.opportunityLevel;
  return <section className="opportunity-overview" id="opportunities" aria-labelledby="opportunity-heading">
    <div className="opportunity-signal"><div className="eyebrow">Opportunity signal</div><div className={`signal-value signal-${level}`}>{level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'}<span className="signal-bars" aria-hidden="true">{[0, 1, 2].map(index => <i key={index} className={index < (level === 'high' ? 3 : level === 'medium' ? 2 : 1) ? 'filled' : ''} />)}</span></div><p>{smallChannelWinCount} small-channel {smallChannelWinCount === 1 ? 'win' : 'wins'} in this sample</p></div>
    <div className="opportunity-detail"><h2 id="opportunity-heading">{smallChannelWinCount ? 'Smaller channels are reaching an audience' : 'Look closely at the competition'}</h2><p>{smallChannelWinCount ? `${smallChannelWinCount} ${smallChannelWinCount === 1 ? 'video has' : 'videos have'} more than 50K views on channels with fewer than 100K subscribers.` : 'No videos in this sample meet the small-channel win threshold. Explore the engagement data and content gaps for more context.'}</p><a className="text-link" href="#methodology">How this signal is calculated <Icon name="arrow" size={14} /></a></div>
    <div className="study-video"><span className="eyebrow">Highest engagement · {engagementRate(bestEngagementVideo).toFixed(2)}%</span><a href={videoUrl(bestEngagementVideo)} target="_blank" rel="noreferrer">{bestEngagementVideo.title}<Icon name="external" size={14} /></a><p>{bestEngagementVideo.channel} · {formatNum(bestEngagementVideo.views)} views</p></div>
  </section>;
}

function VideoResults({ results, bestVideoId }) {
  const [visibleCount, setVisibleCount] = useState(10);
  const [sortBy, setSortBy] = useState('views');
  const sortedResults = useMemo(() => [...results].sort((a, b) => sortBy === 'engagement'
    ? engagementRate(b) - engagementRate(a) : (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0)), [results, sortBy]);
  return <section className="panel video-panel" aria-labelledby="video-heading">
    <div className="panel-heading video-panel-heading"><div><h2 id="video-heading">Videos to study <span className="count-badge">{results.length}</span></h2><p>Compare performance across the videos in your search.</p></div><div className="sort-control"><label htmlFor="video-sort">Sort by</label><select id="video-sort" value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="views">Most views</option><option value="engagement">Engagement</option><option value="likes">Most likes</option><option value="comments">Most comments</option></select></div></div>
    <table className="video-table"><caption className="sr-only">Video performance. Engagement is likes divided by views times 100.</caption><thead><tr><th scope="col">Video / channel</th><th scope="col">Views</th><th scope="col">Likes</th><th scope="col">Comments</th><th scope="col">Engagement</th></tr></thead><tbody>
      {sortedResults.slice(0, visibleCount).map((video, index) => <tr key={video.video_id}>
        <td className="video-cell"><div className="video-identity"><span className="video-rank">{String(index + 1).padStart(2, '0')}</span><a className="thumbnail-link" href={videoUrl(video)} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true">{video.thumbnail ? <img src={video.thumbnail} alt="" width="88" height="50" loading="lazy" /> : <span className="thumbnail-placeholder"><Icon name="video" /></span>}</a><div className="video-info"><a className="video-title" href={videoUrl(video)} target="_blank" rel="noreferrer">{video.title}<Icon name="external" size={12} /></a><p>{video.channel}{video.subscribers > 0 && <> · {formatNum(video.subscribers)} subscribers</>}</p><div className="video-badges">{video.small_channel_win && <span className="badge badge-accent">Small-channel win</span>}{bestVideoId === video.video_id && <span className="badge">Highest engagement</span>}</div></div></div></td>
        <td data-label="Views" title={exactNumber(video.views)}>{formatNum(video.views)}</td><td data-label="Likes" title={exactNumber(video.likes)}>{formatNum(video.likes)}</td><td data-label="Comments" title={exactNumber(video.comments)}>{formatNum(video.comments)}</td><td className="engagement-cell" data-label="Engagement"><strong>{engagementRate(video).toFixed(2)}%</strong><span className="engagement-track" aria-hidden="true"><span style={{ width: `${Math.min(100, engagementRate(video))}%` }} /></span></td>
      </tr>)}
    </tbody></table>
    <div className="table-footer"><span>Showing {Math.min(visibleCount, results.length)} of {results.length} videos</span>{visibleCount < results.length && <button className="button button-secondary button-small" onClick={() => setVisibleCount(count => count + 10)}>Show more videos <Icon name="arrow" size={14} /></button>}</div>
  </section>;
}

export default function App() {
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState('');
  const inputRef = useRef(null);
  const research = useTopicSearch();
  const { query, results, phase, loading, startedAt, duration, gapAnalysis, analyzeError, error } = research;
  const analytics = useMemo(() => deriveAnalytics(results, query), [results, query]);
  const hasResults = results.length > 0;
  const sessionKey = `${query}-${research.sessionId}`;
  const submit = event => {
    event.preventDefault();
    if (!draft.trim()) {
      setValidationError('Enter a topic to start your search.');
      inputRef.current?.focus();
      return;
    }
    setValidationError('');
    research.search(draft);
  };

  return <div className="app-shell">
    <Header hasResults={hasResults} />
    <main id="main-content" className="main-content">
      <div className="workspace" id="workspace">
        <section className={`search-section ${phase === 'idle' ? 'search-section-initial' : ''}`} aria-labelledby="page-title">
          <div className="eyebrow">Topic research</div>
          <h1 id="page-title">{phase === 'idle' ? 'Find content opportunities before they get crowded.' : 'Explore your next topic.'}</h1>
          <p className="page-description">Analyze YouTube topics, engagement, and available transcripts to find your next content idea.</p>
          <form className="search-form" onSubmit={submit} noValidate>
            <div className={`search-input-wrap ${validationError ? 'has-error' : ''}`}><Icon name="search" size={21} /><label className="sr-only" htmlFor="topic-search">Search a topic</label><input id="topic-search" ref={inputRef} type="search" placeholder="Search a topic, e.g. AI coding tools" value={draft} onChange={event => { setDraft(event.target.value); setValidationError(''); }} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? 'query-error' : 'search-scope'} autoComplete="off" /><kbd aria-hidden="true">↵</kbd></div>
            <button type="submit" className="button button-primary search-button" disabled={loading}>{loading ? <><span className="spinner spinner-small" aria-hidden="true" />Searching…</> : <>Search <Icon name="arrow" size={17} /></>}</button>
          </form>
          {validationError && <p className="field-error" id="query-error" role="alert">{validationError}</p>}
          <div className="search-meta" id="search-scope"><span><Icon name="video" size={14} />YouTube</span><span>Last 30 days</span><span>Up to 30 videos</span></div>
          {phase === 'idle' && <div className="examples"><span>Try a topic</span>{['AI coding tools', 'Workout', 'Tennis', 'Champions League'].map(topic => <button key={topic} onClick={() => { setDraft(topic); setValidationError(''); inputRef.current?.focus(); }}>{topic}<Icon name="arrow" size={12} /></button>)}</div>}
        </section>

        <div className="sr-only" role="status" aria-live="polite">{phase === 'success' ? `${results.length} videos ready for ${query}.${analyzeError ? ' Content insights are unavailable.' : ' Content analysis complete.'}` : phase === 'empty' ? `No videos found for ${query}.` : ''}</div>
        {loading && <SearchLoadingState key={startedAt} query={query} phase={phase} startedAt={startedAt} videoCount={results.length} />}
        {error && <section className="error-panel" role="alert"><Icon name="alert" size={22} /><div><h2>We couldn’t complete this search.</h2><p>{error}</p><button className="button button-secondary" onClick={() => research.search(query)}>Try again</button></div></section>}
        {phase === 'empty' && <section className="empty-state"><span className="empty-icon"><Icon name="search" size={25} /></span><h2>No videos found for “{query}”</h2><p>Try a broader topic or different wording. This search covers videos published in the last 30 days.</p><button className="button button-secondary" onClick={() => { inputRef.current?.focus(); inputRef.current?.select(); }}>Edit search</button></section>}

        {hasResults && <>
          <div className="results-heading"><div><div className="eyebrow">Research overview</div><h2>Results for “{query}”</h2><p>{results.length} videos analyzed <span>·</span> {loading ? 'Content insights in progress' : analyzeError ? `Video results ready · Insights unavailable · ${duration?.toFixed(1)}s elapsed` : `${research.analysisOnly ? 'Analysis completed' : 'Completed'} in ${duration?.toFixed(1)}s`}</p></div><span className="date-badge"><Icon name="clock" size={14} />Last 30 days</span></div>
          <dl className="metric-strip">{[
            { label: 'Videos analyzed', value: results.length, note: 'In this search sample' },
            { label: 'Average views', value: formatNum(analytics.avgViews), note: 'Across all results' },
            { label: 'Top video views', value: formatNum(analytics.topVideo?.views), note: 'Highest reach in results' },
            { label: 'Best engagement', value: `${analytics.bestEngagement.toFixed(2)}%`, note: 'Likes ÷ views × 100' },
          ].map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd><span>{metric.note}</span></div>)}</dl>
          <OpportunityOverview analytics={analytics} />
          <VideoResults key={sessionKey} results={results} bestVideoId={analytics.bestEngagementVideo?.video_id} />
          <MemoAnalyticsPanels results={results} analytics={analytics} />
          {analytics.recommendation && <section className="panel recommendation-panel" aria-labelledby="recommendation-heading"><div className="panel-heading"><h2 id="recommendation-heading">A starting point for your next video</h2><p>Suggestions from title patterns and publishing data in this sample.</p></div><dl className="recommendation-grid"><div><dt>Format to explore</dt><dd>{analytics.recommendation.format}</dd><span>Inferred from the highest-engagement title</span></div><div><dt>Keyword to explore</dt><dd>{analytics.recommendation.topKeyword}</dd><span>From frequent words in video titles</span></div><div><dt>Leading publishing window</dt><dd>{analytics.recommendation.bestDay || 'Unavailable'}</dd><span>{analytics.recommendation.bestTime ? `${analytics.recommendation.bestTime} UTC` : 'No valid publication dates'}</span></div></dl></section>}
          <InsightsPanel key={`insights-${sessionKey}`} query={query} results={results} analytics={analytics} gapAnalysis={gapAnalysis} analyzeError={analyzeError} analyzing={phase === 'analyzing'} onRetryAnalysis={() => research.search(query, results)} />
          <DataChat key={`chat-${sessionKey}`} query={query} results={results} analytics={analytics} gapAnalysis={gapAnalysis} />
        </>}

        {phase === 'idle' && <section className="getting-started" aria-labelledby="getting-started-heading"><div className="section-heading"><div><h2 id="getting-started-heading">From a topic to a clearer direction</h2><p className="muted">One search brings the signals together.</p></div><span className="eyebrow">Your research, in context</span></div><div className="feature-grid">{[
          { icon: 'video', title: 'See what’s performing', text: 'Compare views, engagement, and the channels finding an audience.' },
          { icon: 'chart', title: 'Understand the patterns', text: 'Explore recurring keywords, publishing windows, and small-channel wins.' },
          { icon: 'target', title: 'Find a different angle', text: 'Review content gaps and develop ideas grounded in your search results.' },
        ].map((feature, index) => <div className="feature" key={feature.title}><div className="feature-top"><Icon name={feature.icon} size={22} /><span>0{index + 1}</span></div><h3>{feature.title}</h3><p>{feature.text}</p></div>)}</div><div className="getting-started-note"><Icon name="clock" size={16} /><p>Good research takes a moment. You’ll see a running timer and status updates while your search is processed.</p></div></section>}
        <Methodology />
        <footer className="page-footer"><span>TrendVision <span className="footer-divider">/</span> A clearer view of what to create next.</span><span>YouTube data · Recent 30-day sample</span></footer>
      </div>
    </main>
  </div>;
}
