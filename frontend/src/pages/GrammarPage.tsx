import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { DailyPlanDetailed, GrammarExplanation, Profile, Resource, SyllabusTopic } from '../utils/types';

type Tab = 'today' | 'overview' | 'browse';
type OverviewMode = 'level' | 'topic';

export function GrammarPage() {
  const [tab, setTab] = useState<Tab>('today');
  const [overviewMode, setOverviewMode] = useState<OverviewMode>('level');
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [syllabus, setSyllabus] = useState<SyllabusTopic[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<DailyPlanDetailed | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  // Browse tab state
  const [topic, setTopic] = useState<SyllabusTopic | null>(null);
  const [data, setData] = useState<GrammarExplanation | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Today's Learning exercise state
  const [todayExerciseDone, setTodayExerciseDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const [syl, prof, p] = await Promise.all([
          apiGet<SyllabusTopic[]>('/syllabus'),
          apiGet<Profile>('/profile'),
          apiGet<{ plan: DailyPlanDetailed }>('/plan/today').catch(() => null),
        ]);
        if (!mounted) return;
        setSyllabus(syl);
        setProfile(prof);
        if (p) setPlan(p.plan);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setPlanLoading(false);
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

  const filteredGrouped = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return grouped;
    return grouped.map((g) => ({
      ...g,
      topics: g.topics.filter(
        (t) => t.topic.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
      ),
    })).filter((g) => g.topics.length > 0);
  }, [grouped, search]);

  // Group by first letter of topic (for 'topic' overview mode)
  const byTopic = useMemo(() => {
    const q = search.toLowerCase();
    const all = syllabus.filter(
      (t) => !q || t.topic.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
    const groups: Record<string, SyllabusTopic[]> = {};
    for (const t of all) {
      const letter = t.topic[0]?.toUpperCase() ?? '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter]!.push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [syllabus, search]);

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

  function toggleGroup(key: string) {
    setExpandedGroups((g) => ({ ...g, [key]: g[key] === false }));
  }

  function isExpanded(key: string) {
    return expandedGroups[key] !== false;
  }

  return (
    <div>
      <h2 className="module-title">Grammar</h2>
      <p className="module-sub">Learn today&apos;s topic, explore what you&apos;ve covered, and browse the full syllabus</p>

      {error ? <div className="msg-box msg-error">{error}</div> : null}

      <div className="tab-bar">
        <button className={`tab-btn${tab === 'today' ? ' active' : ''}`} onClick={() => { setTab('today'); setTopic(null); }}>
          Today&apos;s Learning
        </button>
        <button className={`tab-btn${tab === 'overview' ? ' active' : ''}`} onClick={() => { setTab('overview'); setTopic(null); }}>
          Overview
        </button>
        <button className={`tab-btn${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
          Browse All
        </button>
      </div>

      {/* ── TODAY'S LEARNING ── */}
      {tab === 'today' && (
        <div>
          {planLoading ? (
            <div className="spinner-wrap">
              <div className="spinner" /> Loading today&apos;s grammar…
            </div>
          ) : !plan ? (
            <div className="msg-box msg-info">Could not load today&apos;s plan. Check your API key in Settings.</div>
          ) : (
            <>
              <div className="today-focus-bar">
                <span style={{ fontSize: 20 }}>📐</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Today&apos;s Grammar
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{plan.grammar.topic}</div>
                </div>
                <span
                  style={{ marginLeft: 'auto', fontSize: 11, background: 'var(--blue-soft)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 8 }}
                >
                  {plan.level}
                </span>
              </div>

              <div className="card">
                <div className="section-label">Explanation</div>
                <div className="explanation-box">{plan.grammar.explanation}</div>
              </div>

              {plan.grammar.examples?.length ? (
                <div className="card">
                  <div className="section-label">Examples</div>
                  {plan.grammar.examples.map((e, i) => (
                    <div key={i} className="example-line flex between items-center">
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {plan.grammar.exercises?.length ? (
                <div className="card">
                  <div className="section-label">Practice Exercises</div>
                  {plan.grammar.exercises.map((ex, i) => (
                    <Exercise key={i} idx={i} ex={ex} />
                  ))}
                  {!todayExerciseDone && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 16 }}
                      onClick={() => setTodayExerciseDone(true)}
                    >
                      Mark grammar as done ✓
                    </button>
                  )}
                  {todayExerciseDone && (
                    <div className="msg-box msg-success" style={{ marginTop: 12 }}>
                      Grammar practice completed! 🎉
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          {/* Today's grammar topic pinned at the top */}
          {plan && (
            <div
              className="card"
              style={{
                marginBottom: 16,
                borderColor: 'rgba(59,130,246,0.3)',
                background: 'linear-gradient(135deg, var(--bg-elev) 0%, rgba(59,130,246,0.04) 100%)',
              }}
            >
              <div className="flex between items-center">
                <div>
                  <div className="section-label" style={{ color: 'var(--blue)', marginBottom: 4 }}>
                    📅 Today&apos;s Grammar
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                    {plan.grammar.topic}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 3 }}>
                    {plan.level} · {plan.focus}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setTab('today')}>
                  Review →
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div className="search-wrap" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search grammar topics…"
              />
            </div>
            <div className="toggle-group">
              <button
                className={`toggle-opt${overviewMode === 'level' ? ' active' : ''}`}
                onClick={() => setOverviewMode('level')}
              >
                By Level
              </button>
              <button
                className={`toggle-opt${overviewMode === 'topic' ? ' active' : ''}`}
                onClick={() => setOverviewMode('topic')}
              >
                A–Z
              </button>
            </div>
          </div>

          {overviewMode === 'level' ? (
            filteredGrouped.length === 0 ? (
              <div className="text-muted text-sm">No topics match your search.</div>
            ) : (
              filteredGrouped.map(({ lv, topics }) => {
                if (!topics.length) return null;
                const expanded = isExpanded(`level-${lv}`);
                return (
                  <div key={lv} className="overview-group">
                    <div className="overview-group-header" onClick={() => toggleGroup(`level-${lv}`)}>
                      <span style={{ fontSize: 18 }}>📐</span>
                      <span className="overview-group-title">CEFR {lv}</span>
                      {lv === profile?.level && (
                        <span
                          style={{
                            fontSize: 10,
                            border: '1px solid var(--violet)',
                            color: 'var(--violet)',
                            padding: '1px 7px',
                            borderRadius: 4,
                            letterSpacing: '0.1em',
                          }}
                        >
                          YOUR LEVEL
                        </span>
                      )}
                      <span className="overview-group-count">{topics.length} topics</span>
                      <span style={{ color: 'var(--ink-mute)', marginLeft: 8 }}>{expanded ? '▴' : '▾'}</span>
                    </div>
                    {expanded && (
                      <div className="overview-word-list">
                        {topics.map((t) => (
                          <div
                            key={t.topic}
                            className="overview-word-row"
                            style={{ cursor: 'pointer' }}
                            onClick={() => { setTab('browse'); void openTopic(t); }}
                          >
                            <span className="overview-word-text" style={{ minWidth: 200 }}>{t.topic}</span>
                            <span className="overview-word-trans" style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>{t.description}</span>
                            <span style={{ color: 'var(--violet)', fontWeight: 700, flexShrink: 0 }}>→</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            byTopic.length === 0 ? (
              <div className="text-muted text-sm">No topics match your search.</div>
            ) : (
              byTopic.map(([letter, topics]) => {
                const expanded = isExpanded(`alpha-${letter}`);
                return (
                  <div key={letter} className="overview-group">
                    <div className="overview-group-header" onClick={() => toggleGroup(`alpha-${letter}`)}>
                      <span style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--violet)', width: 28 }}>{letter}</span>
                      <span className="overview-group-title" style={{ flex: 1 }} />
                      <span className="overview-group-count">{topics.length}</span>
                      <span style={{ color: 'var(--ink-mute)', marginLeft: 8 }}>{expanded ? '▴' : '▾'}</span>
                    </div>
                    {expanded && (
                      <div className="overview-word-list">
                        {topics.map((t) => (
                          <div
                            key={t.topic}
                            className="overview-word-row"
                            style={{ cursor: 'pointer' }}
                            onClick={() => { setTab('browse'); void openTopic(t); }}
                          >
                            <span className="overview-word-text" style={{ minWidth: 200 }}>{t.topic}</span>
                            <span className="overview-word-pos">{t.level}</span>
                            <span className="overview-word-trans" style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>{t.description}</span>
                            <span style={{ color: 'var(--violet)', fontWeight: 700, flexShrink: 0 }}>→</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>
      )}

      {/* ── BROWSE ALL ── */}
      {tab === 'browse' && (
        <div>
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

  return (
    <div className="exercise-item">
      <div className="exercise-sentence">{ex.sentence || ''}</div>
      {ex.hint ? <div className="text-xs text-muted mb-8">Hint: {ex.hint}</div> : null}
      <div className="exercise-row" style={{ display: 'flex', gap: 10 }}>
        <input
          value={val}
          onChange={(e) => { setVal(e.target.value); setRes('idle'); }}
          placeholder="Answer…"
          onKeyDown={(e) => { if (e.key === 'Enter') setRes(val.trim().toLowerCase() === ans.toLowerCase() ? 'correct' : 'wrong'); }}
        />
        <button
          className="btn btn-sm"
          onClick={() => setRes(val.trim().toLowerCase() === ans.toLowerCase() ? 'correct' : 'wrong')}
        >
          Check
        </button>
      </div>
      {res === 'correct' ? (
        <div className="result-correct">Correct ✓</div>
      ) : res === 'wrong' ? (
        <div className="result-wrong">
          Incorrect — correct answer: <strong>{ans}</strong>
        </div>
      ) : null}
    </div>
  );
}
