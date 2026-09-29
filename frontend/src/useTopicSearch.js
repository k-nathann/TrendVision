import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

export const BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export function requestError(error) {
  const status = error.response?.status;
  if (['ECONNABORTED', 'ETIMEDOUT'].includes(error.code) || status === 408 || status === 504) {
    return 'The analysis service timed out. Please try this search again.';
  }
  if (!error.response && (error.request || error.code === 'ERR_NETWORK')) {
    return 'We couldn’t reach the TrendVision analysis service. Check your connection and try again.';
  }
  if (status === 400 || status === 422) return 'The service couldn’t use this query. Try a more specific topic.';
  if (status === 429) return 'The service is busy right now. Wait a moment, then try again.';
  return 'The TrendVision analysis service didn’t respond successfully. Please try again.';
}

const initialState = {
  phase: 'idle', query: '', results: [], gapAnalysis: null,
  error: null, analyzeError: null, startedAt: null, duration: null, analysisOnly: false, sessionId: null,
};

export default function useTopicSearch() {
  const [state, setState] = useState(initialState);
  const activeRequest = useRef(null);

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);

  const run = useCallback(async (topic, existingVideos = null) => {
    const query = topic.trim();
    // Ref guard prevents two requests even before React has disabled the button.
    if (!query || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const startedAt = Date.now();
    const isCurrent = () => activeRequest.current === controller && !controller.signal.aborted;
    let videos = existingVideos;
    setState(previous => ({
      ...initialState, query, startedAt, results: videos || [],
      phase: videos ? 'analyzing' : 'searching', analysisOnly: Boolean(videos),
      sessionId: videos ? previous.sessionId : startedAt,
    }));

    try {
      if (!videos) {
        const response = await axios.get(`${BASE_URL}/search`, {
          params: { q: query, max_results: 30 }, signal: controller.signal,
        });
        if (!isCurrent()) return;
        if (!Array.isArray(response.data?.results) || response.data.results.some(video =>
          !video || typeof video.video_id !== 'string' || typeof video.title !== 'string'
        )) throw new Error('Invalid video results response');
        videos = response.data.results;
        setState(previous => ({ ...previous, results: videos, phase: videos.length ? 'analyzing' : 'empty' }));
      }

      if (videos.length) {
        try {
          const response = await axios.post(`${BASE_URL}/analyze`, {
            query,
            videos: videos.slice(0, 10).map(video => ({
              video_id: video.video_id, title: video.title,
              description: video.description || '', views: video.views,
              likes: video.likes, subscribers: video.subscribers,
            })),
          }, { signal: controller.signal });
          if (!isCurrent()) return;
          if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data) ||
            !['saturated', 'gap', 'suggested_title'].every(key => typeof response.data[key] === 'string') ||
            (response.data.reasoning != null && typeof response.data.reasoning !== 'string')) {
            throw new Error('Invalid content analysis response');
          }
          setState(previous => ({ ...previous, gapAnalysis: response.data }));
        } catch (error) {
          if (!isCurrent()) return;
          console.error('TrendVision content analysis failed:', error);
          setState(previous => ({ ...previous, analyzeError: requestError(error) }));
        }
      }
      if (isCurrent()) setState(previous => ({ ...previous, phase: videos.length ? 'success' : 'empty' }));
    } catch (error) {
      if (!isCurrent()) return;
      console.error('TrendVision search failed:', error);
      setState(previous => ({ ...previous, phase: 'error', error: requestError(error) }));
    } finally {
      if (isCurrent()) {
        setState(previous => ({ ...previous, duration: (Date.now() - startedAt) / 1000 }));
        activeRequest.current = null;
      }
    }
  }, []);

  return { ...state, loading: state.phase === 'searching' || state.phase === 'analyzing', search: run };
}
