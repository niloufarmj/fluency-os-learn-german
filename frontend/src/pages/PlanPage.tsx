import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { DailyProgress, EndOfDayTest, PlanTodayResponse } from '../utils/types';
import { useNavigate } from 'react-router-dom';

export function PlanPage() {
  const nav = useNavigate();
  const [data, setData] = useState<PlanTodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<EndOfDayTest | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitRes, setSubmitRes] = useState<{ result: { score: number; pass: boolean; feedback?: string } } | null>(null);

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

  useEffect(() => { void load(); }, []);

  const allTasksDone = useMemo(() => {
    const p = data?.progress;
    if (!p) return false;
    return !!(p.tasks.vocab && p.tasks.grammar && p.tasks.reading && p.tasks.roleplay);
  }, [data?.progress]);

  async function mark(task: keyof DailyProgress['tasks'], completed: boolean) {
    if (!data) return;
    try {
      const updated = await apiPost<DailyProgress>('/plan/progress', { date: data.effective_date, task, completed });
      setData({ ...data, progress: updated });
    } catch {
      // ignore
    }
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
      const res = await apiPost<{ progress: DailyProgress; result: { score: number; pass: boolean; feedback?: string } }>(
        '/plan/test/submit',
        { date: data.effective_date, answers },
      );
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
  const completedCount = [progress.tasks.vocab, progress.tasks.grammar, progress.tasks.reading, progress.tasks.roleplay].filter(Boolean).length;

  type TaskKey = keyof typeof progress.tasks;

  const sections: {
    id: TaskKey | 'resources';
    icon: string;
    title: string;
    subtitle: string;
    detail: string;
    done: boolean;
    route: string;
  }[] = [
    {
      id: 'vocab',
      icon: '🗂️',
      title: 'Vocabulary',
      subtitle: `${plan.vocab.length} words · ${plan.level}`,
      detail: plan.vocab.slice(0, 4).map((v) => v.word).join(' · '),
      done: progress.tasks.vocab,
      route: '/vocabulary',
    },
    {
      id: 'grammar',
      icon: '📐',
      title: 'Grammar',
      subtitle: plan.grammar.topic,
      detail: plan.grammar.explanation.slice(0, 90) + '…',
      done: progress.tasks.grammar,
      route: '/grammar',
    },
    {
      id: 'reading',
      icon: '📖',
      title: 'Reading',
      subtitle: plan.reading.title,
      detail: `Theme: ${plan.reading.theme}`,
      done: progress.tasks.reading,
      route: '/reading',
    },
    {
      id: 'roleplay',
      icon: '🎭',
      title: 'Roleplay',
      subtitle: plan.roleplay.scenario_title,
      detail: plan.roleplay.target_phrases.slice(0, 2).join(' · '),
      done: progress.tasks.roleplay,
      route: '/roleplay',
    },
    {
      id: 'resources',
      icon: '📺',
      title: 'Resources',
      subtitle: `${plan.youtube.length} curated videos`,
      detail: plan.youtube[0]?.title || 'YouTube study materials',
      done: false,
      route: '/resources',
    },
  ];

  return (
    <div>
      <div className="flex between items-center" style={{ marginBottom: 8 }}>
        <div>
          <h2 className="module-title" style={{ marginBottom: 6 }}>
            Today&apos;s Plan
          </h2>
          <div className="text-sm text-muted">
            {backlog ? (
              <>
                Backlog from <strong>{effective_date}</strong>
              </>
            ) : (
              <>
                <strong>{effective_date}</strong> · {plan.focus}
              </>
            )}
          </div>
        </div>
        <button className="btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div className="flex between items-center" style={{ marginBottom: 8 }}>
          <span className="text-xs text-muted">
            {completedCount} of 4 sections completed
          </span>
          <span className="text-xs text-muted">{Math.round((completedCount / 4) * 100)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(completedCount / 4) * 100}%` }} />
        </div>
      </div>

      <div className="hub-grid">
        {sections.map((s) => (
          <div
            key={s.id}
            className={`hub-card${s.done ? ' hub-card-done' : ''}`}
            onClick={() => nav(s.route)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '2rem' }}>{s.icon}</span>
              {s.done && (
                <span style={{ color: 'var(--mint)', fontWeight: 800, fontSize: 12 }}>✓ Done</span>
              )}
            </div>
            <div>
              <div className="hub-card-title">{s.title}</div>
              <div className="hub-card-subtitle">{s.subtitle}</div>
              <div className="hub-card-detail">{s.detail}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  nav(s.route);
                }}
              >
                {s.done ? 'Review →' : 'Start →'}
              </button>
              {s.id !== 'resources' && (
                <button
                  className={`btn btn-sm${s.done ? ' btn-primary' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void mark(s.id as TaskKey, !s.done);
                  }}
                  title={s.done ? 'Mark incomplete' : 'Mark complete'}
                >
                  {s.done ? '✓' : 'Done'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-label">End-of-day Test</div>
        {!allTasksDone ? (
          <div className="msg-box msg-info">Complete all 4 sections to unlock the daily test.</div>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => void generateTest()} disabled={!!test}>
              {test ? 'Test ready ▼' : 'Generate test'}
            </button>
            {testErr ? <div className="msg-box msg-error" style={{ marginTop: 12 }}>{testErr}</div> : null}
            {test ? (
              <div style={{ marginTop: 16 }}>
                {test.questions.map((q, i) => (
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
                            style={
                              answers[String(i)] === oi
                                ? { borderColor: 'var(--violet)', background: 'var(--violet-soft)' }
                                : undefined
                            }
                          >
                            <span className="ans-letter">{(['A', 'B', 'C', 'D'] as const)[oi] ?? '?'}</span>
                            <span>{opt}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        value={String(answers[String(i)] || '')}
                        onChange={(e) => setAnswers((a) => ({ ...a, [String(i)]: e.target.value }))}
                        placeholder="Your answer…"
                      />
                    )}
                  </div>
                ))}
                <button className="btn btn-primary full-w" style={{ marginTop: 16 }} onClick={() => void submitTest()}>
                  Submit test
                </button>
                {submitRes ? (
                  <div
                    className={`msg-box ${submitRes.result.pass ? 'msg-success' : 'msg-error'}`}
                    style={{ marginTop: 12 }}
                  >
                    Score: {submitRes.result.score} —{' '}
                    {submitRes.result.pass ? 'Pass 🎉' : 'Keep practicing'}
                    {submitRes.result.feedback && (
                      <div style={{ fontSize: 13, marginTop: 8 }}>{submitRes.result.feedback}</div>
                    )}
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
