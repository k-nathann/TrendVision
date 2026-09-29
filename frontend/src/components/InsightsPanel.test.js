import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
import InsightsPanel from './InsightsPanel';

jest.mock('axios', () => ({ post: jest.fn() }));

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const videos = Array.from({ length: 10 }, (_, index) => ({
  video_id: `video-${index}`, title: `Workflow ${index + 1}`,
  views: 100000 - index * 1000, likes: 5000 - index * 50, subscribers: 10000,
}));
const analytics = {
  avgViews: 95500,
  smallChannelWinCount: 10,
  topKeywords: Array.from({ length: 10 }, (_, index) => ({ word: `keyword-${index}`, count: 10 - index })),
};
const gapAnalysis = {
  saturated: 'Many videos cover initial setup.', gap: 'Explore everyday maintenance.',
  suggested_title: 'Maintaining your coding workflow', reasoning: 'The leading videos leave this unanswered.',
};
const concepts = Array.from({ length: 3 }, (_, index) => ({
  badge: `Concept ${index + 1}`, angle: `Explore maintenance angle ${index + 1}.`,
  titles: Array.from({ length: 3 }, (_, titleIndex) => `Video title ${index + 1}.${titleIndex + 1}`),
  thumbnail_prompt: `A visual brief for concept ${index + 1}.`,
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPanel() {
  return render(<InsightsPanel query="AI coding tools" results={videos} analytics={analytics} gapAnalysis={gapAnalysis} />);
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
  delete navigator.clipboard;
});

test('generates concepts from the first eight videos and keywords, preserving every title and thumbnail prompt', async () => {
  const request = deferred();
  axios.post.mockReturnValue(request.promise);
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: 'Generate 3 concepts' }));

  expect(screen.getByRole('button', { name: 'Generating concepts…' })).toBeDisabled();
  expect(axios.post).toHaveBeenCalledWith(`${API_URL}/ideate`, {
    query: 'AI coding tools',
    top_keywords: ['keyword-0', 'keyword-1', 'keyword-2', 'keyword-3', 'keyword-4', 'keyword-5', 'keyword-6', 'keyword-7'],
    small_channel_win_count: 10,
    avg_views: 95500,
    top_videos: videos.slice(0, 8).map(({ title, views, likes, subscribers }) => ({ title, views, likes, subscribers })),
  }, { signal: expect.any(AbortSignal) });
  fireEvent.click(screen.getByRole('button', { name: 'Generating concepts…' }));
  expect(axios.post).toHaveBeenCalledTimes(1);

  await act(async () => request.resolve({ data: concepts }));
  concepts.forEach(concept => {
    expect(screen.getByRole('heading', { name: concept.badge })).toBeInTheDocument();
    expect(screen.getByText(concept.angle)).toBeInTheDocument();
    concept.titles.forEach(title => expect(screen.getByText(title)).toBeInTheDocument());
    expect(screen.getByText(concept.thumbnail_prompt)).toBeInTheDocument();
  });
  expect(screen.getByRole('button', { name: 'Regenerate concepts' })).toBeEnabled();
});

test('confirms copying only after the clipboard promise resolves and clears the confirmation', async () => {
  jest.useFakeTimers('modern');
  const clipboardRequest = deferred();
  const writeText = jest.fn().mockReturnValue(clipboardRequest.promise);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: 'Copy suggested title' }));

  expect(writeText).toHaveBeenCalledWith(gapAnalysis.suggested_title);
  expect(screen.queryByText('Copied to clipboard.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy suggested title' })).toBeInTheDocument();
  await act(async () => clipboardRequest.resolve());
  expect(screen.getByRole('button', { name: 'suggested title copied' })).toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Clipboard feedback' })).toHaveTextContent('Copied to clipboard.');

  act(() => jest.advanceTimersByTime(2000));
  expect(screen.getByRole('button', { name: 'Copy suggested title' })).toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Clipboard feedback' })).toBeEmptyDOMElement();
});

test('provides manual-copy feedback when the clipboard rejects the write', async () => {
  const clipboardRequest = deferred();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn().mockReturnValue(clipboardRequest.promise) },
  });
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: 'Copy suggested title' }));
  await act(async () => clipboardRequest.reject(new Error('Permission denied')));

  expect(screen.getByRole('status', { name: 'Clipboard feedback' })).toHaveTextContent('Select the text and copy it manually.');
  expect(screen.queryByText('Copied to clipboard.')).not.toBeInTheDocument();
  expect(screen.getByText(gapAnalysis.suggested_title)).toBeInTheDocument();
});

test('keeps existing concepts available when regeneration fails and allows retry', async () => {
  const initialRequest = deferred();
  const regenerateRequest = deferred();
  const retryRequest = deferred();
  axios.post.mockReturnValueOnce(initialRequest.promise)
    .mockReturnValueOnce(regenerateRequest.promise).mockReturnValueOnce(retryRequest.promise);
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: 'Generate 3 concepts' }));
  await act(async () => initialRequest.resolve({ data: concepts }));
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate concepts' }));
  await act(async () => regenerateRequest.reject({ response: { status: 503 } }));

  expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t generate concepts.');
  concepts.forEach(concept => {
    expect(screen.getByText(concept.angle)).toBeInTheDocument();
    concept.titles.forEach(title => expect(screen.getByText(title)).toBeInTheDocument());
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry concepts' }));
  expect(axios.post.mock.calls[2][1]).toEqual(axios.post.mock.calls[0][1]);
  await act(async () => retryRequest.resolve({ data: concepts }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Regenerate concepts' })).toBeEnabled();
});

test('aborts generation when unmounted and ignores a response arriving afterward', async () => {
  const request = deferred();
  axios.post.mockReturnValue(request.promise);
  const { unmount } = renderPanel();
  fireEvent.click(screen.getByRole('button', { name: 'Generate 3 concepts' }));
  const signal = axios.post.mock.calls[0][2].signal;
  expect(signal.aborted).toBe(false);
  unmount();
  expect(signal.aborted).toBe(true);

  // A late invalid body must be ignored before validation or error reporting.
  await act(async () => request.resolve({ data: { invalid: true } }));
  expect(console.error).not.toHaveBeenCalled();
});
