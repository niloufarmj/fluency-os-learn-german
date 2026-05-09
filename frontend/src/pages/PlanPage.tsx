import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { DailyProgress, EndOfDayTest, PlanTodayResponse } from '../utils/types';
import { Link } from 'react-router-dom';

function speakGerman(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'de-DE';
  msg.rate = 0.9;
  window.speechSynthesis.speak(msg);
}

export function PlanPage() {
  const [data, setData] = useState<PlanTodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [test, setTest] = useState<EndOfDayTest | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitRes, setSubmitRes] = useState<any>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PlanTodayResponse>('/plan/today');
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTasksDone = useMemo(() => {
    const p = data?.progress;
    if (!p) return false;
    return !!(p.tasks.vocab && p.tasks.grammar && p.tasks.reading && p.tasks.roleplay);
  }, [data?.progress]);

  async function mark(task: 'vocab' | 'grammar' | 'reading' | 'roleplay', completed: boolean) {
    if (!data) return;
    const updated = await apiPost<DailyProgress>('/plan/progress', { date: data.effective_date, task, completed });
    setData({ ...data, progress: updated });
  }

  async function generateTest() {
    if (!data) return;
    setTestErr(null);
    setSubmitRes(null);
    try {
      const t = await apiPost<EndOfDayTest>('/plan/test/generate', { date_str: data.effective_date });
      setTest(t);
    } catch (e) {
      setTestErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function submitTest() {
    if (!data) return;
    setTestErr(null);
    try {
      const res = await apiPost<{ progress: DailyProgress; result: any }>('/plan/test/submit', { date: data.effective_date, answers });
      setSubmitRes(res);
      setData({ ...data, progress: res.progress });
    } catch (e) {
      setTestErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" /> Loading today&apos;s plan…
      </div>
    );
  }

  if (error) return <div className="msg-box msg-error">{error}</div>;
  if (!data) return null;

  const { plan, progress, backlog, effective_date } = data;

  return (
    <div>
      <div className="flex between items-center mb-16" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="module-title" style={{ marginBottom: 6 }}>
            Daily Plan
          </h2>
          <div className="text-sm text-muted">
            {backlog ? (
              <>
                You have unfinished work. Showing <strong>{effective_date}</strong> first.
              </>
            ) : (
              <>
                Today: <strong>{effective_date}</strong>
              </>
            )}
          </div>
        </div>
        <button className="btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="section-label">Focus</div>
        <div className="text-sm">{plan.focus}</div>
      </div>

      <div className="card">
        <div className="flex between items-center">
          <div className="section-label" style={{ marginBottom: 0 }}>
            Vocabulary
          </div>
          <button className={`btn btn-sm ${progress.tasks.vocab ? 'btn-primary' : ''}`} onClick={() => void mark('vocab', !progress.tasks.vocab)}>
            {progress.tasks.vocab ? 'Completed ✓' : 'Mark completed'}
          </button>
        </div>
        <div className="mt-12" style={{ marginTop: 12 }}>
          {plan.vocab.map((v) => (
            <div key={v.word} className="vocab-row">
              <div className="vocab-word">{v.word}</div>
              <div className="vocab-trans">
                {v.translation} <span className="text-muted text-xs">({v.part_of_speech})</span>
                <div className="text-xs text-muted mt-8" style={{ marginTop: 8 }}>
                  {v.examples?.[0] || ''}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => speakGerman(v.word)}>
                🔊
              </button>
              <button className="btn btn-sm" onClick={() => void apiPost('/vocab/add', { word: v.word, level: plan.level }).catch(() => {})}>
                Add
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex between items-center">
          <div>
            <div className="section-label" style={{ marginBottom: 0 }}>
              Grammar
            </div>
            <div className="serif" style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>
              {plan.grammar.topic}
            </div>
          </div>
          <button className={`btn btn-sm ${progress.tasks.grammar ? 'btn-primary' : ''}`} onClick={() => void mark('grammar', !progress.tasks.grammar)}>
            {progress.tasks.grammar ? 'Completed ✓' : 'Mark completed'}
          </button>
        </div>
        <div className="explanation-box mt-12">{plan.grammar.explanation}</div>
        {plan.grammar.exercises?.length ? (
          <>
            <div className="section-label mb-8">Exercises</div>
            {plan.grammar.exercises.map((ex, i) => (
              <Exercise key={i} sentence={ex.sentence} answer={ex.answer} hint={ex.hint} />
            ))}
          </>
        ) : null}
      </div>

      <div className="card">
        <div className="flex between items-center">
          <div className="section-label" style={{ marginBottom: 0 }}>
            Reading — {plan.reading.theme}
          </div>
          <button className={`btn btn-sm ${progress.tasks.reading ? 'btn-primary' : ''}`} onClick={() => void mark('reading', !progress.tasks.reading)}>
            {progress.tasks.reading ? 'Completed ✓' : 'Mark completed'}
          </button>
        </div>
        <div className="serif" style={{ fontSize: 22, fontWeight: 900, marginTop: 12 }}>
          {plan.reading.title}
        </div>
        <div className="article-body mt-12" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
          {plan.reading.article}
        </div>
        <div className="mt-16" style={{ marginTop: 16 }}>
          <div className="section-label">Questions</div>
          {plan.reading.questions?.map((q, i) => (
            <details key={i} className="question-item">
              <summary className="q-text">
                {i + 1}. {q.q}
              </summary>
              <div className="a-text">{q.a}</div>
            </details>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex between items-center">
          <div className="section-label" style={{ marginBottom: 0 }}>
            Roleplay
          </div>
          <button className={`btn btn-sm ${progress.tasks.roleplay ? 'btn-primary' : ''}`} onClick={() => void mark('roleplay', !progress.tasks.roleplay)}>
            {progress.tasks.roleplay ? 'Completed ✓' : 'Mark completed'}
          </button>
        </div>
        <div className="serif" style={{ fontSize: 20, fontWeight: 900, marginTop: 12 }}>
          {plan.roleplay.scenario_title}
        </div>
        <div className="text-sm text-muted mt-8" style={{ marginTop: 8 }}>
          Opening: {plan.roleplay.opening}
        </div>
        <div className="mt-12" style={{ marginTop: 12 }}>
          <div className="section-label">Target phrases</div>
          <div className="flex gap-8 flex-wrap">
            {plan.roleplay.target_phrases.map((p, i) => (
              <span key={i} className="vocab-ef">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-16" style={{ marginTop: 16 }}>
          <Link className="btn btn-primary" to="/roleplay">
            Open roleplay
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="section-label">YouTube resources</div>
        <div className="flex gap-12 flex-wrap">
          {plan.youtube.map((y, i) => (
            <div key={i} className="card" style={{ flex: 1, minWidth: 250, padding: 12 }}>
              <div className="text-xs uppercase text-muted mb-8">{y.channel}</div>
              <iframe
                width="100%"
                height="180"
                src={y.url}
                style={{ borderRadius: 4, border: '1px solid var(--border)' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={y.title}
              />
              <div className="text-sm mt-8">{y.title}</div>
              <div className="text-xs text-muted mt-8">{y.why_relevant}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-label">End-of-day test</div>
        {!allTasksDone ? (
          <div className="msg-box msg-info">Finish vocab, grammar, reading, and roleplay to unlock the test.</div>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => void generateTest()} disabled={!!test}>
              {test ? 'Test ready' : 'Generate test'}
            </button>
            {testErr ? <div className="msg-box msg-error mt-12">{testErr}</div> : null}
            {test ? (
              <div className="mt-16">
                {test.questions.map((q: any, i: number) => (
                  <div key={i} className="exercise-item">
                    <div className="exercise-sentence">
                      {i + 1}. {q.prompt}
                    </div>
                    {q.type === 'mc' ? (
                      <div className="answer-grid">
                        {q.options.map((opt: string, oi: number) => (
                          <button
                            key={oi}
                            className="answer-btn"
                            onClick={() => setAnswers((a) => ({ ...a, [String(i)]: oi }))}
                            style={answers[String(i)] === oi ? { borderColor: 'var(--violet)' } : undefined}
                          >
                            <span className="ans-letter">{['A', 'B', 'C', 'D'][oi] || '?'}</span>
                            <span>{opt}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input value={answers[String(i)] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [String(i)]: e.target.value }))} />
                    )}
                  </div>
                ))}
                <button className="btn btn-primary full-w mt-16" onClick={() => void submitTest()}>
                  Submit test
                </button>
                {submitRes ? (
                  <div className={`msg-box ${submitRes?.result?.pass ? 'msg-success' : 'msg-error'} mt-12`}>
                    Score: {submitRes.result.score} — {submitRes.result.pass ? 'Pass' : 'Fail'}
                    <div className="text-sm mt-8">{submitRes.result.feedback}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Exercise({ sentence, answer, hint }: { sentence: string; answer: string; hint?: string }) {
  const [val, setVal] = useState('');
  const [res, setRes] = useState<'idle' | 'correct' | 'wrong'>('idle');
  return (
    <div className="exercise-item">
      <div className="exercise-sentence">{sentence}</div>
      {hint ? (
        <div className="text-xs text-muted mb-8">Hint: {hint}</div>
      ) : null}
      <div className="exercise-row" style={{ display: 'flex', gap: 10 }}>
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Answer…" />
        <button
          className="btn btn-sm"
          onClick={() => setRes(val.trim().toLowerCase() === answer.trim().toLowerCase() ? 'correct' : 'wrong')}
        >
          Check
        </button>
      </div>
      {res === 'idle' ? null : res === 'correct' ? (
        <div className="result-correct">Correct ✓</div>
      ) : (
        <div className="result-wrong">
          Incorrect — correct answer: <strong>{answer}</strong>
        </div>
      )}
    </div>
  );
}

