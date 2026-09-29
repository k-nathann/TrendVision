import { useEffect, useState } from 'react';
import Icon from './Icon';

export default function SearchLoadingState({ query, phase, startedAt, videoCount }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const dataReady = phase === 'analyzing';
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const message = seconds >= 40
    ? 'Still working on your results. Larger searches can take longer because TrendVision processes multiple videos and available transcripts.'
    : seconds >= 20
      ? 'This search is taking a little longer. We’re still working on it.'
      : dataReady
        ? 'Analyzing videos and available transcripts…'
        : seconds >= 8
          ? 'Still gathering YouTube data. Video and transcript analysis comes next.'
          : 'Gathering YouTube data…';

  return (
    <section className="loading-panel" aria-labelledby="loading-title">
      <div className="loading-heading">
        <div className="loading-title-group"><span className="spinner" aria-hidden="true" /><h2 id="loading-title">Analyzing “{query}”</h2></div>
        <div className="elapsed"><Icon name="clock" size={16} /><span role="timer" aria-label={`${elapsed} elapsed`} aria-live="off">{elapsed}</span><span>elapsed</span></div>
      </div>
      <p className="loading-message" role="status" aria-live="polite">{message}</p>
      <ol className="progress-steps" aria-label="Search progress">
        {[
          { label: 'Find relevant videos', done: dataReady, active: !dataReady },
          { label: 'Collect engagement data', done: dataReady, active: !dataReady },
          { label: 'Analyze content & identify gaps', done: false, active: dataReady },
        ].map(step => (
          <li key={step.label} className={step.done ? 'step-done' : step.active ? 'step-active' : 'step-waiting'}>
            <span className="step-icon" aria-hidden="true">{step.done ? <Icon name="check" size={14} /> : <span />}</span>
            <span>{step.label}</span><span className="sr-only">: {step.done ? 'Complete' : step.active ? 'In progress' : 'Waiting'}</span>
          </li>
        ))}
      </ol>
      <p className="loading-note">{dataReady ? `${videoCount} videos retrieved. Your data is ready below while content analysis continues.` : 'Video discovery and engagement data are retrieved together.'} Detailed analysis progress isn’t available.</p>
    </section>
  );
}
