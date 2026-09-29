import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BASE_URL, requestError } from '../useTopicSearch';
import Icon from './Icon';

export default function InsightsPanel({
  query = '', results = [], analytics = {}, gapAnalysis,
  analyzeError, analyzing = false, onRetryAnalysis,
}) {
  const [ideas, setIdeas] = useState(null);
  const [ideating, setIdeating] = useState(false);
  const [ideaError, setIdeaError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [copyError, setCopyError] = useState(null);
  const activeRequest = useRef(null);
  const copyTimer = useRef(null);
  const copySequence = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
      activeRequest.current = null;
      clearTimeout(copyTimer.current);
      copySequence.current += 1;
    };
  }, []);

  const generateIdeas = async () => {
    if (!results.length || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const isCurrent = () => mounted.current && activeRequest.current === controller && !controller.signal.aborted;
    setIdeating(true);
    setIdeaError(null);
    try {
      const response = await axios.post(`${BASE_URL}/ideate`, {
        query,
        top_keywords: (analytics.topKeywords || []).slice(0, 8).map(keyword => keyword.word),
        small_channel_win_count: analytics.smallChannelWinCount || 0,
        avg_views: analytics.avgViews || 0,
        top_videos: results.slice(0, 8).map(video => ({
          title: video.title || '', views: video.views || 0,
          likes: video.likes || 0, subscribers: video.subscribers || 0,
        })),
      }, { signal: controller.signal });
      if (!isCurrent()) return;
      const concepts = response.data;
      if (!Array.isArray(concepts) || concepts.length !== 3 || concepts.some(concept =>
        !concept || typeof concept.badge !== 'string' || typeof concept.angle !== 'string' ||
        typeof concept.thumbnail_prompt !== 'string' || !Array.isArray(concept.titles) ||
        concept.titles.length !== 3 || concept.titles.some(title => typeof title !== 'string')
      )) throw new Error('Invalid content concepts response');
      setIdeas(concepts);
      setCopiedId(null);
      setCopyError(null);
    } catch (error) {
      if (!isCurrent()) return;
      console.error('TrendVision concept generation failed:', error);
      setIdeaError(requestError(error));
    } finally {
      if (isCurrent()) {
        setIdeating(false);
        activeRequest.current = null;
      }
    }
  };

  const copyText = async (text, id) => {
    const sequence = ++copySequence.current;
    clearTimeout(copyTimer.current);
    setCopiedId(null);
    setCopyError(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable');
      await navigator.clipboard.writeText(text);
      if (!mounted.current || sequence !== copySequence.current) return;
      setCopiedId(id);
      copyTimer.current = setTimeout(() => {
        if (mounted.current) setCopiedId(null);
      }, 2000);
    } catch (error) {
      if (!mounted.current || sequence !== copySequence.current) return;
      console.error('TrendVision copy failed:', error);
      setCopyError('Couldn’t copy automatically. Select the text and copy it manually.');
    }
  };

  const copyButton = (text, id, label) => (
    <button type="button" className="button button-secondary button-small" onClick={() => copyText(text, id)} aria-label={copiedId === id ? `${label} copied` : `Copy ${label}`}>
      <Icon name={copiedId === id ? 'check' : 'copy'} size={14} />
      {copiedId === id ? 'Copied' : 'Copy'}
    </button>
  );

  return (
    <section id="insights" className="panel insights-panel" aria-labelledby="insights-heading">
      <div className="section-heading">
        <h2 id="insights-heading">Content insights</h2>
        <p>Generated interpretation of {Math.min(results.length, 10)} leading videos, using titles, descriptions, and any available transcripts.</p>
      </div>

      {analyzing && <p className="status-message" role="status">Interpreting the leading videos. Your data is ready to explore above.</p>}

      {analyzeError && (
        <div className="inline-error" role="alert">
          <p><strong>Content analysis is unavailable.</strong> {typeof analyzeError === 'string' ? analyzeError : 'The service didn’t respond successfully. Please try again.'}</p>
          <button type="button" className="button button-secondary button-small" onClick={onRetryAnalysis} disabled={analyzing || !onRetryAnalysis}>Retry analysis</button>
        </div>
      )}

      {gapAnalysis && (
        <>
          <div className="insight-grid">
            <div className="insight-block">
              <h3 className="insight-label">Common angle</h3>
              <p>{gapAnalysis.saturated || 'No common angle was returned.'}</p>
            </div>
            <div className="insight-block insight-block-accent">
              <h3 className="insight-label">Potential content gap</h3>
              <p>{gapAnalysis.gap || 'No content gap was returned.'}</p>
            </div>
          </div>
          <div className="insight-block">
            <h3 className="insight-label">Suggested title</h3>
            <div className="concept-title-row">
              <p className="insight-title">{gapAnalysis.suggested_title || 'No title was returned.'}</p>
              {gapAnalysis.suggested_title && copyButton(gapAnalysis.suggested_title, 'suggested-title', 'suggested title')}
            </div>
          </div>
          {gapAnalysis.reasoning && (
            <div className="insight-block insight-reasoning">
              <h3 className="insight-label">Why this stands out</h3>
              <p>{gapAnalysis.reasoning}</p>
            </div>
          )}
        </>
      )}

      <section className="concepts-section" aria-labelledby="concepts-heading">
        <div className="section-heading-row">
          <div className="section-heading">
            <h3 id="concepts-heading">Content concepts</h3>
            <p>Explore three angles with title options and a thumbnail brief, based on this search.</p>
          </div>
          <button type="button" className="button button-secondary" onClick={generateIdeas} disabled={ideating || !results.length}>
            {ideating ? 'Generating concepts…' : ideas ? 'Regenerate concepts' : 'Generate 3 concepts'}
          </button>
        </div>

        <p className={ideating ? 'status-message' : 'sr-only'} role="status">{ideating ? 'Generating concepts from the video data. This can take a moment.' : ideas && !ideaError ? '3 concepts ready.' : ''}</p>
        {ideaError && (
          <div className="inline-error" role="alert">
            <p><strong>Couldn’t generate concepts.</strong> {ideaError}</p>
            <button type="button" className="button button-secondary button-small" onClick={generateIdeas} disabled={ideating}>Retry concepts</button>
          </div>
        )}

        {ideas && (
          <div className="concepts-list">
            {ideas.map((idea, index) => (
              <article className="concept" key={index}>
                <div className="concept-header">
                  <span className="concept-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <h4>{idea.badge}</h4>
                </div>
                <p className="concept-angle">{idea.angle}</p>
                <h5 className="insight-label">Title options</h5>
                <ul className="concept-titles">
                  {idea.titles.map((title, titleIndex) => (
                    <li className="concept-title-row" key={titleIndex}>
                      <span>{title}</span>
                      {copyButton(title, `title-${index}-${titleIndex}`, `title ${titleIndex + 1} for ${idea.badge}`)}
                    </li>
                  ))}
                </ul>
                <div className="thumbnail-prompt">
                  <div className="section-heading-row">
                    <h5 className="insight-label">Thumbnail prompt</h5>
                    {copyButton(idea.thumbnail_prompt, `thumbnail-${index}`, `thumbnail prompt for ${idea.badge}`)}
                  </div>
                  <p>{idea.thumbnail_prompt}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="copy-feedback" role="status" aria-label="Clipboard feedback">{copyError || (copiedId ? 'Copied to clipboard.' : '')}</p>
    </section>
  );
}
