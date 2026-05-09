import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { GrammarExplanation, Profile, Resource, SyllabusTopic } from '../utils/types';

export function GrammarPage() {
  const [syllabus, setSyllabus] = useState<SyllabusTopic[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [topic, setTopic] = useState<SyllabusTopic | null>(null);
  const [data, setData] = useState<GrammarExplanation | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const [syl, prof] = await Promise.all([apiGet<SyllabusTopic[]>('/syllabus'), apiGet<Profile>('/profile')]);
        if (!mounted) return;
        setSyllabus(syl);
        setProfile(prof);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const levels = ['A1', 'A2', 'B1'];
    return levels.map((lv) => ({ lv, topics: syllabus.filter((t) => t.level === lv) }));
  }, [syllabus]);

  async function openTopic(t: SyllabusTopic) {
    setTopic(t);
    setData(null);
    setResources([]);
    setError(null);
    try {
      const [d, r] = await Promise.all([
        apiPost<GrammarExplanation>('/explain-grammar', { topic: t.topic, level: t.level }),
        apiGet<Resource[]>(`/resources?topic=${encodeURIComponent(t.topic)}`),
      ]);
      setData(d);
      setResources(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <h2 className="module-title">Grammar</h2>
      <p className="module-sub">CEFR-structured grammar topics with practice exercises</p>

      {error ? <div className="msg-box msg-error">{error}</div> : null}

      {!topic ? (
        <div id="gram-body">
          {grouped.map(({ lv, topics }) =>
            topics.length ? (
              <div key={lv} style={{ marginBottom: 22 }}>
                <div className="flex items-center gap-12 mb-12">
                  <span
                    className="text-xs uppercase"
                    style={{ color: lv === profile?.level ? 'var(--violet)' : 'var(--ink-mute)' }}
                  >
                    CEFR {lv}
                  </span>
                  {lv === profile?.level ? (
                    <span
                      style={{
                        fontSize: '0.6rem',
                        border: '1px solid var(--violet)',
                        color: 'var(--violet)',
                        padding: '1px 7px',
                        letterSpacing: '0.1em',
                      }}
                    >
                      YOUR LEVEL
                    </span>
                  ) : null}
                </div>
                {topics.map((t) => (
                  <div key={t.topic} className="topic-item" onClick={() => void openTopic(t)}>
                    <div>
                      <div className="topic-name">{t.topic}</div>
                      <div className="topic-desc">{t.description}</div>
                    </div>
                    <span className="topic-arrow">→</span>
                  </div>
                ))}
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <div>
          <div className="back-link" onClick={() => setTopic(null)}>
            ← Back to Topics
          </div>

          <div className="flex between items-center mb-16">
            <div>
              <h3 className="serif" style={{ fontSize: '1.5rem', marginBottom: 3 }}>
                {topic.topic}
              </h3>
              <p className="text-xs text-muted uppercase">CEFR {topic.level}</p>
            </div>
          </div>

          {!data ? (
            <div className="spinner-wrap">
              <div className="spinner" /> Generating explanation &amp; fetching resources…
            </div>
          ) : (
            <div>
              <div className="explanation-box">{data.explanation || ''}</div>

              {resources?.length ? (
                <>
                  <div className="section-label mb-8 mt-24 text-amber">Curated Video Resources</div>
                  <div className="flex gap-12 flex-wrap mb-24">
                    {resources.map((r, i) => (
                      <div key={i} className="card" style={{ flex: 1, minWidth: 250, padding: 12 }}>
                        <div className="text-xs uppercase text-muted mb-8">{r.channel || ''}</div>
                        {r.url ? (
                          <iframe
                            width="100%"
                            height="180"
                            src={r.url}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            style={{ borderRadius: 4, border: '1px solid var(--border)' }}
                            allowFullScreen
                            title={r.title || `resource-${i}`}
                          />
                        ) : null}
                        <div className="text-sm mt-8">{r.title || ''}</div>
                      </div>
                    ))}
                  </div>
                  <hr className="divider" />
                </>
              ) : null}

              {data.examples?.length ? (
                <>
                  <div className="section-label mb-8">Examples</div>
                  {data.examples.map((e, i) => (
                    <div key={i} className="example-line flex between items-center">
                      <span>{e}</span>
                    </div>
                  ))}
                  <hr className="divider" />
                </>
              ) : null}

              <div className="section-label mb-8">Practice Exercises</div>
              {data.exercises?.length ? (
                data.exercises.map((ex, i) => <Exercise key={i} idx={i} ex={ex} />)
              ) : (
                <p className="text-muted text-sm">No exercises available.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Exercise({
  ex,
}: {
  idx: number;
  ex: { sentence?: string; answer?: string; hint?: string };
}) {
  const [val, setVal] = useState('');
  const [res, setRes] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const ans = (ex.answer || '').trim();
  const check = () => {
    const ok = val.trim().toLowerCase() === ans.toLowerCase();
    setRes(ok ? 'correct' : 'wrong');
  };

  return (
    <div className="exercise-item">
      <div className="exercise-sentence">{ex.sentence || ''}</div>
      {ex.hint ? (
        <div className="text-xs text-muted mb-8">Hint: {ex.hint}</div>
      ) : null}
      <div className="exercise-row" style={{ display: 'flex', gap: 10 }}>
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Answer…" />
        <button className="btn btn-sm" onClick={check}>
          Check
        </button>
      </div>
      {res === 'idle' ? null : res === 'correct' ? (
        <div className="result-correct">Correct ✓</div>
      ) : (
        <div className="result-wrong">
          Incorrect — correct answer: <strong>{ans}</strong>
        </div>
      )}
    </div>
  );
}

