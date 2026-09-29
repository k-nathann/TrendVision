import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BASE_URL, requestError } from '../useTopicSearch';
import Icon from './Icon';

export default function DataChat({ query = '', results = [], analytics = {}, gapAnalysis }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const activeRequest = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, []);

  const sendQuestion = async (question, retry = false) => {
    const text = question.trim();
    if (!text || activeRequest.current || !results.length) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const isCurrent = () => mounted.current && activeRequest.current === controller && !controller.signal.aborted;
    if (!retry) {
      setInput('');
      setMessages(previous => [...previous, { role: 'user', text }]);
    }
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${BASE_URL}/chat`, {
        question: text,
        query,
        stats: {
          total_videos: results.length,
          avg_views: analytics.avgViews || 0,
          top_views: analytics.topVideo?.views || 0,
          best_engagement: analytics.bestEngagement || 0,
          small_channel_wins: analytics.smallChannelWinCount || 0,
          top_keywords: (analytics.topKeywords || []).map(keyword => keyword.word),
          best_day: analytics.postingData?.topDay?.[0] || '',
          best_time: analytics.postingData?.topTime?.[0] || '',
          top_videos: results.slice(0, 10).map(video => ({
            title: video.title || '', views: video.views || 0,
            channel: video.channel || '', description: video.description?.slice(0, 200) || '',
          })),
          all_titles: results.map(video => video.title || ''),
          gap_analysis: gapAnalysis || {},
        },
      }, { signal: controller.signal });
      if (!isCurrent()) return;
      if (typeof response.data?.answer !== 'string' || !response.data.answer.trim()) {
        throw new Error('Invalid discussion response');
      }
      setMessages(previous => [...previous, { role: 'assistant', text: response.data.answer }]);
    } catch (requestFailure) {
      if (!isCurrent()) return;
      console.error('TrendVision discussion failed:', requestFailure);
      setError({ question: text, message: requestError(requestFailure) });
    } finally {
      if (isCurrent()) {
        setLoading(false);
        activeRequest.current = null;
      }
    }
  };

  const submit = event => {
    event.preventDefault();
    sendQuestion(input);
  };

  return (
    <section id="discussion" className="panel discussion-panel" aria-labelledby="discussion-heading">
      <div className="section-heading-row">
        <div className="section-heading">
          <h2 id="discussion-heading">Ask about these results</h2>
          <p>Get an explanation grounded in your current search data.</p>
        </div>
        <button type="button" className="button button-secondary" onClick={() => setOpen(previous => !previous)} aria-expanded={open} aria-controls="discussion-body">
          <Icon name={open ? 'close' : 'message'} size={16} />
          {open ? 'Close discussion' : 'Open discussion'}
        </button>
      </div>

      {open && (
        <div id="discussion-body" className="discussion-body">
          {!messages.length && <p className="discussion-intro">Ask about engagement, keywords, posting patterns, or which videos to study for “{query}”.</p>}
          <ol className="chat-messages" role="log" aria-label="Discussion about these results" aria-live="polite" aria-relevant="additions">
            {messages.map((message, index) => (
              <li className={`chat-message chat-message-${message.role}`} key={index}>
                <span className="chat-message-label">{message.role === 'user' ? 'You' : 'TrendVision'}</span>
                <p>{message.text}</p>
              </li>
            ))}
          </ol>
          {loading && <p className="status-message" role="status">Preparing an answer from your results…</p>}
          {error && (
            <div className="inline-error" role="alert">
              <p><strong>Couldn’t answer this question.</strong> {error.message}</p>
              <button type="button" className="button button-secondary button-small" onClick={() => sendQuestion(error.question, true)} disabled={loading}>Retry question</button>
            </div>
          )}
          <form className="chat-form" onSubmit={submit}>
            <label className="field-label" htmlFor="discussion-question">Ask about these results</label>
            <div className="chat-input-row">
              <input id="discussion-question" type="text" value={input} onChange={event => setInput(event.target.value)} placeholder="Which video should I study first?" autoComplete="off" required />
              <button type="submit" className="button button-primary" disabled={loading || !input.trim() || !results.length}>
                {loading ? 'Sending…' : 'Send question'}
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
