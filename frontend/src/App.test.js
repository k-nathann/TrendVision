import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import App from "./App";

jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  isCancel: jest.fn(),
}));
// Chart sizing relies on the browser's layout engine; these tests exercise the
// real search controls, results, and request lifecycle independently of it.
jest.mock("./components/AnalyticsPanels", () => () => null);

const API_URL = (process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/$/, "");
const makeVideo = (index = 0) => ({
  video_id: `video-${index}`,
  title: `Practical coding workflow ${index + 1}`,
  description: `A complete guide to workflow ${index + 1}.`,
  channel: `Channel ${index + 1}`,
  channel_id: `channel-${index}`,
  published_at: "2026-09-21T14:00:00Z",
  thumbnail: `https://example.com/thumbnail-${index}.jpg`,
  views: 120000 - index * 5000,
  likes: 6000 - index * 250,
  comments: 120 - index,
  subscribers: 15000,
  small_channel_win: true,
});
const analysis = {
  saturated: "Most videos cover introductory setup.",
  gap: "Show a complete workflow for an existing project.",
  suggested_title: "A practical workflow from start to finish",
  reasoning: "The retrieved videos leave project maintenance unanswered.",
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

function searchFor(query) {
  const input = screen.getByRole("searchbox", { name: "Search a topic" });
  fireEvent.change(input, { target: { value: query } });
  userEvent.type(input, "{enter}");
}

async function resolveRequest(request, data) {
  await act(async () => {
    request.resolve({ data });
  });
}

async function rejectRequest(request, error) {
  await act(async () => {
    request.reject(error);
  });
}

function expectActiveIntervals(count) {
  const cleared = new Set(clearInterval.mock.calls.map(([interval]) => interval));
  const active = setInterval.mock.results.filter(({ value }) => !cleared.has(value));
  expect(active).toHaveLength(count);
}

beforeEach(() => {
  jest.useFakeTimers("modern");
  jest.resetAllMocks();
  axios.isCancel.mockReturnValue(false);
  jest.spyOn(global, "setInterval");
  jest.spyOn(global, "clearInterval");
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("rejects a whitespace-only query without making an API request", () => {
  render(<App />);
  searchFor("   ");

  expect(axios.get).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(/enter|topic|search/i);
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: "Search a topic" })).toHaveAttribute("aria-invalid", "true");
});

test("immediately shows the submitted query and one timer, safely encodes special queries, and prevents overlapping searches", () => {
  axios.get.mockReturnValue(deferred().promise);
  render(<App />);
  searchFor("  C++ & R&D #1?  ");

  expect(screen.getByRole("heading", { name: "Analyzing “C++ & R&D #1?”" })).toBeInTheDocument();
  expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  expect(screen.getByText(/elapsed/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Search(?:ing…)?$/ })).toBeDisabled();
  const progress = screen.getByRole("list", { name: "Search progress" });
  expect(progress).not.toHaveTextContent("Complete");
  const steps = within(progress).getAllByRole("listitem");
  expect(steps[0]).toHaveTextContent("Find relevant videos: In progress");
  expect(steps[2]).toHaveTextContent("Analyze content & identify gaps: Waiting");
  expect(axios.get).toHaveBeenCalledWith(`${API_URL}/search`, {
    params: { q: "C++ & R&D #1?", max_results: 30 },
    signal: expect.any(AbortSignal),
  });

  searchFor("a second query");
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("heading", { name: "Analyzing “C++ & R&D #1?”" })).toBeInTheDocument();
  expectActiveIntervals(1);
});

test("updates elapsed time and long-running guidance without cancelling a slow search", () => {
  axios.get.mockReturnValue(deferred().promise);
  render(<App />);
  searchFor("AI coding tools");
  expect(screen.getByText(/gathering youtube data/i)).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(8000));
  expect(screen.getByRole("timer")).toHaveTextContent("00:08");
  expect(screen.getByText(/still gathering youtube data/i)).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(12000));
  expect(screen.getByRole("timer")).toHaveTextContent("00:20");
  expect(screen.getByText(/taking a little longer/i)).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(20000));
  expect(screen.getByRole("timer")).toHaveTextContent("00:40");
  expect(screen.getByText(/larger searches|multiple videos/i)).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(25000));
  expect(screen.getByRole("timer")).toHaveTextContent("01:05");
  expect(axios.get.mock.calls[0][1].signal.aborted).toBe(false);
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(axios.post).not.toHaveBeenCalled();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

test("shows real video results during analysis, sends only the first ten videos, and stops the timer after analysis", async () => {
  const searchRequest = deferred();
  const analyzeRequest = deferred();
  const videos = Array.from({ length: 12 }, (_, index) => makeVideo(index));
  axios.get.mockReturnValue(searchRequest.promise);
  axios.post.mockReturnValue(analyzeRequest.promise);
  render(<App />);
  searchFor("AI coding tools");
  act(() => jest.advanceTimersByTime(3000));

  await resolveRequest(searchRequest, { query: "AI coding tools", results: videos });
  expect(screen.getAllByText(videos[0].title).length).toBeGreaterThan(0);
  const steps = within(screen.getByRole("list", { name: "Search progress" })).getAllByRole("listitem");
  expect(steps[0]).toHaveTextContent("Find relevant videos: Complete");
  expect(steps[1]).toHaveTextContent("Collect engagement data: Complete");
  expect(steps[2]).toHaveTextContent("Analyze content & identify gaps: In progress");
  const table = screen.getByRole("table");
  const rows = within(table).getAllByRole("row");
  expect(rows).toHaveLength(11);
  expect(within(rows[1]).getByRole("cell", { name: "120.0K" })).toHaveAttribute("title", "120,000");
  expect(within(rows[1]).getByRole("cell", { name: "6.0K" })).toBeInTheDocument();
  expect(within(rows[1]).getByRole("cell", { name: "120" })).toBeInTheDocument();
  expect(within(rows[1]).getByRole("cell", { name: "5.00%" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show more videos" }));
  expect(within(table).getAllByRole("row")).toHaveLength(13);
  expect(screen.queryByRole("button", { name: "Show more videos" })).not.toBeInTheDocument();
  expect(screen.getByRole("timer")).toHaveTextContent("00:03");
  expect(screen.getByRole("button", { name: /^Search(?:ing…)?$/ })).toBeDisabled();
  expect(axios.post).toHaveBeenCalledWith(`${API_URL}/analyze`, {
    query: "AI coding tools",
    videos: videos.slice(0, 10).map(({ video_id, title, description, views, likes, subscribers }) => ({
      video_id, title, description, views, likes, subscribers,
    })),
  }, { signal: expect.any(AbortSignal) });

  act(() => jest.advanceTimersByTime(4000));
  expect(screen.getByRole("timer")).toHaveTextContent("00:07");
  await resolveRequest(analyzeRequest, analysis);

  expect(screen.getByRole("heading", { name: "Results for “AI coding tools”" })).toBeInTheDocument();
  expect(screen.getByText(analysis.gap)).toBeInTheDocument();
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Search(?:ing…)?$/ })).toBeEnabled();
  expectActiveIntervals(0);
});

test("holds the submitted result context while editing the input and resets the timer for a new search", async () => {
  const firstSearch = deferred();
  const firstAnalysis = deferred();
  const secondSearch = deferred();
  axios.get.mockReturnValueOnce(firstSearch.promise).mockReturnValueOnce(secondSearch.promise);
  axios.post.mockReturnValueOnce(firstAnalysis.promise);
  render(<App />);
  searchFor("original topic");
  act(() => jest.advanceTimersByTime(12000));
  await resolveRequest(firstSearch, { results: [makeVideo()] });
  await resolveRequest(firstAnalysis, analysis);

  fireEvent.change(screen.getByRole("searchbox", { name: "Search a topic" }), { target: { value: "next topic" } });
  expect(screen.getByRole("heading", { name: "Results for “original topic”" })).toBeInTheDocument();
  searchFor("next topic");

  expect(screen.getByRole("heading", { name: "Analyzing “next topic”" })).toBeInTheDocument();
  expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  expect(screen.queryByText(analysis.gap)).not.toBeInTheDocument();
  expectActiveIntervals(1);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByRole("timer")).toHaveTextContent("00:01");
});

test("shows a dedicated empty-result state and does not start transcript analysis", async () => {
  const request = deferred();
  axios.get.mockReturnValue(request.promise);
  render(<App />);
  searchFor("an obscure topic");
  await resolveRequest(request, { results: [] });

  expect(screen.getByRole("heading", { name: /no .*results|no .*videos/i })).toBeInTheDocument();
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  expectActiveIntervals(0);
});

test.each([
  ["network failure", { code: "ERR_NETWORK", message: "Network Error" }],
  ["timeout", { code: "ECONNABORTED", message: "timeout of 1000ms exceeded" }],
  ["server failure", { response: { status: 500, data: { detail: "PRIVATE stack trace" } } }],
])("exits loading on %s and retries the submitted query without exposing internal errors", async (_name, error) => {
  const first = deferred();
  const retry = deferred();
  axios.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
  render(<App />);
  searchFor("original topic");
  act(() => jest.advanceTimersByTime(4000));
  await rejectRequest(first, error);

  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  expect(screen.queryByText(/PRIVATE stack trace|timeout of 1000ms exceeded/)).not.toBeInTheDocument();
  expectActiveIntervals(0);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search a topic" }), { target: { value: "unsent draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(axios.get).toHaveBeenLastCalledWith(`${API_URL}/search`, {
    params: { q: "original topic", max_results: 30 },
    signal: expect.any(AbortSignal),
  });
  expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  await resolveRequest(retry, { results: [] });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("retains search data after analysis failure and retries only the analysis with its original context", async () => {
  const searchRequest = deferred();
  const firstAnalysis = deferred();
  const secondAnalysis = deferred();
  const video = makeVideo();
  axios.get.mockReturnValue(searchRequest.promise);
  axios.post.mockReturnValueOnce(firstAnalysis.promise).mockReturnValueOnce(secondAnalysis.promise);
  render(<App />);
  searchFor("original topic");
  await resolveRequest(searchRequest, { results: [video] });
  await rejectRequest(firstAnalysis, { response: { status: 503 } });

  expect(screen.getByRole("heading", { name: "Results for “original topic”" })).toBeInTheDocument();
  expect(screen.getAllByText(video.title).length).toBeGreaterThan(0);
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  expectActiveIntervals(0);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search a topic" }), { target: { value: "unsent draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Retry analysis" }));

  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledTimes(2);
  expect(axios.post.mock.calls[1][1]).toEqual(axios.post.mock.calls[0][1]);
  expect(screen.getByRole("timer")).toHaveTextContent("00:00");
  await resolveRequest(secondAnalysis, analysis);
  expect(screen.getByText(analysis.gap)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry analysis" })).not.toBeInTheDocument();
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
});

test("aborts an in-flight search and removes its interval on unmount", async () => {
  const request = deferred();
  axios.get.mockReturnValue(request.promise);
  const { unmount } = render(<App />);
  searchFor("AI coding tools");
  const signal = axios.get.mock.calls[0][1].signal;
  expect(signal.aborted).toBe(false);

  unmount();
  expect(signal.aborted).toBe(true);
  expectActiveIntervals(0);
  await resolveRequest(request, { results: [makeVideo()] });
  expect(axios.post).not.toHaveBeenCalled();
});

test("aborts pending transcript analysis and clears the timer on unmount", async () => {
  const searchRequest = deferred();
  const analyzeRequest = deferred();
  axios.get.mockReturnValue(searchRequest.promise);
  axios.post.mockReturnValue(analyzeRequest.promise);
  const { unmount } = render(<App />);
  searchFor("AI coding tools");
  await resolveRequest(searchRequest, { results: [makeVideo()] });
  const signal = axios.post.mock.calls[0][2].signal;

  unmount();
  expect(signal.aborted).toBe(true);
  expectActiveIntervals(0);
  await resolveRequest(analyzeRequest, analysis);
});
