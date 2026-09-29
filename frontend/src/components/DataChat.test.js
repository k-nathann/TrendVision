import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import DataChat from './DataChat';

jest.mock('axios', () => ({ post: jest.fn() }));

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const videos = Array.from({ length: 11 }, (_, index) => ({
  title: `Workflow ${index + 1}`, channel: `Creator ${index + 1}`,
  views: 100000 - index * 1000, description: 'A'.repeat(250),
}));
const gapAnalysis = { gap: 'Explore project maintenance.', reasoning: 'The leading videos focus on setup.' };
const analytics = {
  avgViews: 95000, topVideo: videos[0], bestEngagement: 5.2, smallChannelWinCount: 3,
  topKeywords: [{ word: 'workflow', count: 11 }, { word: 'maintenance', count: 4 }],
  postingData: { topDay: ['Monday', 250000], topTime: ['Afternoon (12pm–6pm)', 300000] },
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function openDiscussion() {
  const view = render(<DataChat query="AI coding tools" results={videos} analytics={analytics} gapAnalysis={gapAnalysis} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open discussion' }));
  return view;
}

function ask(question) {
  const input = screen.getByRole('textbox', { name: 'Ask about these results' });
  fireEvent.change(input, { target: { value: question } });
  userEvent.type(input, '{enter}');
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

test('sends the current research context and displays the answer in the discussion', async () => {
  const request = deferred();
  axios.post.mockReturnValue(request.promise);
  openDiscussion();
  expect(screen.getByRole('button', { name: 'Close discussion' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
  ask('  Which video should I study?  ');

  expect(axios.post).toHaveBeenCalledWith(`${API_URL}/chat`, {
    question: 'Which video should I study?',
    query: 'AI coding tools',
    stats: {
      total_videos: 11, avg_views: 95000, top_views: 100000,
      best_engagement: 5.2, small_channel_wins: 3,
      top_keywords: ['workflow', 'maintenance'],
      best_day: 'Monday', best_time: 'Afternoon (12pm–6pm)',
      top_videos: videos.slice(0, 10).map(({ title, views, channel }) => ({
        title, views, channel, description: 'A'.repeat(200),
      })),
      all_titles: videos.map(video => video.title),
      gap_analysis: gapAnalysis,
    },
  }, { signal: expect.any(AbortSignal) });
  expect(screen.getByRole('textbox', { name: 'Ask about these results' })).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  ask('Another question while waiting');
  expect(axios.post).toHaveBeenCalledTimes(1);

  await act(async () => request.resolve({ data: { answer: 'Start with Workflow 1 and compare its maintenance coverage.' } }));
  const log = screen.getByRole('log', { name: 'Discussion about these results' });
  expect(within(log).getAllByRole('listitem')).toHaveLength(2);
  expect(within(log).getByText('Which video should I study?')).toBeInTheDocument();
  expect(within(log).getByText('Start with Workflow 1 and compare its maintenance coverage.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close discussion' }));
  expect(screen.queryByRole('log')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open discussion' }));
  expect(screen.getByRole('log')).toHaveTextContent('Start with Workflow 1');
});

test('retries the failed question without duplicating the user message or sending an unsent draft', async () => {
  const first = deferred();
  const retry = deferred();
  axios.post.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
  openDiscussion();
  ask('Which keyword stands out?');
  await act(async () => first.reject({ code: 'ERR_NETWORK', message: 'Network Error' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t answer this question.');
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask about these results' }), { target: { value: 'A different question' } });
  fireEvent.click(screen.getByRole('button', { name: 'Retry question' }));

  expect(axios.post.mock.calls[1][1]).toEqual(axios.post.mock.calls[0][1]);
  const log = screen.getByRole('log');
  expect(within(log).getAllByRole('listitem')).toHaveLength(1);
  expect(within(log).getByText('Which keyword stands out?')).toBeInTheDocument();
  await act(async () => retry.resolve({ data: { answer: 'Workflow appears in all 11 titles.' } }));
  expect(within(log).getAllByRole('listitem')).toHaveLength(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Ask about these results' })).toHaveValue('A different question');
});

test('aborts a pending question on unmount and ignores its late response', async () => {
  const request = deferred();
  axios.post.mockReturnValue(request.promise);
  const { unmount } = openDiscussion();
  ask('Which video should I study?');
  const signal = axios.post.mock.calls[0][2].signal;
  expect(signal.aborted).toBe(false);
  unmount();
  expect(signal.aborted).toBe(true);

  await act(async () => request.resolve({ data: { invalid: true } }));
  expect(console.error).not.toHaveBeenCalled();
});
