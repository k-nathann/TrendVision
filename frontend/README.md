# TrendVision frontend

The existing Create React App application uses React, Axios, and Recharts. No additional runtime dependencies were added for the dashboard redesign.

## Run locally

From this directory:

```sh
npm start
```

The frontend uses `REACT_APP_API_URL`, falling back to `http://localhost:8000`. Run the existing FastAPI service separately. Environment configuration and backend endpoint contracts are unchanged.

## Checks

```sh
CI=true npm test -- --watchAll=false --runInBand
./node_modules/.bin/eslint src
CI=true npm run build
```

There is no separate lint script in the existing package. ESLint uses its existing `react-app` configuration. Tests mock remote services, so they do not consume YouTube quota or model credits.

## UI structure

- `src/App.js`: workspace/navigation, search form, results summary, qualitative opportunity signal, sortable/paginated video table, and methodology.
- `src/App.css` and `src/index.css`: shared neutral/teal styles, responsive layouts, focus states, and reduced-motion support.
- `src/useTopicSearch.js`: request lifecycle, query snapshots, response validation, duplicate prevention, cancellation on unmount, and friendly errors.
- `src/analytics.js`: the existing engagement, keyword, publishing-window, and recommendation calculations, with missing-date handling.
- `src/components/AnalyticsPanels.js`: existing scatter/bar charts, title keywords, and complete UTC publishing breakdown.
- `src/components/SearchLoadingState.js`: elapsed time and honest request-level progress.
- `src/components/InsightsPanel.js`: content gap analysis, concept generation/regeneration, and clipboard feedback.
- `src/components/DataChat.js`: expandable discussion using the current result context.
- `src/components/Icon.js`: small inline functional SVG icons.

## Search behavior

`GET /search` retrieves up to 30 recent videos. Results appear immediately when that request succeeds; `POST /analyze` then receives the leading 10 videos. These calls depend on one another. Idea generation and discussion retain their separate `/ideate` and `/chat` requests and original payloads.

The running timer starts at `00:00`, updates once per second from the actual start timestamp, and covers search plus automatic analysis. Its interval lives only in the loading component and is cleared when processing finishes, fails, or unmounts. Each new search resets it. Timer ticks do not rerender the charts. Requests have no new frontend timeout or elapsed-time cancellation.

The interface marks video discovery and engagement collection complete only after `/search` returns. Analysis remains indeterminate until `/analyze` settles. Guidance changes at 8, 20, and 40 seconds without inventing percentages or transcript-level completion. A failed analysis keeps video data available and can be retried independently. Analysis retry preserves generated concepts and discussion, restarts its own timer, and labels its duration as analysis time.

Queries are passed through Axios `params` so punctuation is encoded correctly. Submitted queries remain separate from editable input. Request guards prevent duplicates and late responses cannot write into an unmounted search. A new search clears the previous result context and cancels any unfinished concept/discussion requests.

## Data interpretation

No numeric opportunity score exists in the API. The existing qualitative signal is preserved: high for at least two small-channel wins, medium for one, low for none. Each win is a returned video with more than 50,000 views and a reported channel subscriber count above zero and below 100,000. No demand, competition, or momentum scores are fabricated.

Engagement remains likes / views × 100. Publishing recommendations use combined views by UTC day/window, not causal predictions. Title keywords, inferred video format, full video metrics, thumbnails, source links, generated titles, thumbnail prompts, and discussion remain available.

Derived analytics are memoized; the chart panels avoid renders caused by search input edits. Excessive motion and Framer Motion usage were removed from the rendered UI without removing existing dependencies. Video thumbnails load lazily.

## Existing backend observations

These were found during inspection and were left outside the frontend redesign:

- YouTube search, video metadata, and channel metadata calls are dependent and sequential. Transcript retrieval already uses a thread pool.
- The YouTube `requests.get` calls have no explicit timeout or HTTP status validation. Some upstream failures can appear as empty results; the current frontend contract cannot distinguish those from a genuine empty search.
- `_fetch_transcript` calls `YouTubeTranscriptApi.get_transcript`, while the installed library exposes instance `fetch`/`list`. The exception fallback may therefore omit transcripts. UI copy does not guarantee transcript coverage.
- The discussion prompt describes transcript-derived interpretations as verified, although the service does not return transcript coverage. Its prompt and backend behavior were preserved.

## Manual verification

Automated tests cover request contracts, loading/timer boundaries and cleanup, duplicate prevention, special-character queries, real table values, pagination, errors/retries, concepts/copying, and discussion. Browser checks use fixture responses rather than live services.

Before release, run a live search with configured credentials to confirm upstream availability and transcript coverage. Check real clipboard permissions and YouTube links in the target browser. A VoiceOver/NVDA pass remains useful for the table and chart navigation, especially after responsive stacking.
