import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { DailyPlanDetailed, VocabItem } from '../utils/types';

type Tab = 'today' | 'overview' | 'practice';
type OverviewMode = 'date' | 'theme';

function todayIso() {
  return new Date().toISOString().split('T')[0]!;
}

const THEME_NAMES: Record<string, string> = {
  A1: 'Basics & Greetings',
  A2: 'Everyday Life',
  B1: 'Work & Society',
  B2: 'Advanced Topics',
};
const THEME_ICONS: Record<string, string> = {
  A1: '☕',
  A2: '🏙️',
  B1: '💼',
  B2: '🌐',
};

function speakGerman(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'de-DE';
  msg.rate = 0.9;
  window.speechSynthesis.speak(msg);
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function VocabularyPage() {
  const [tab, setTab] = useState<Tab>('today');
  const [overviewMode, setOverviewMode] = useState<OverviewMode>('date');
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [plan, setPlan] = useState<DailyPlanDetailed | null>(null);
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Practice tab state
  const [deckId, setDeckId] = useState<string>('due');
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [stats, setStats] = useState({ got: 0, stumbled: 0, forgot: 0 });
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const [v, p] = await Promise.all([
          apiGet<VocabItem[]>('/vocab'),
          apiGet<{ plan: DailyPlanDetailed }>('/plan/today').catch(() => null),
        ]);
        if (!mounted) return;
        setVocab(v);
        if (p) setPlan(p.plan);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const due = useMemo(() => vocab.filter((w) => !w.next_review || w.next_review <= todayIso()), [vocab]);

  const decks = useMemo(() => {
    const levels = ['A1', 'A2', 'B1', 'B2'];
    return levels
      .map((lv) => {
        const words = vocab.filter((w) => w.level === lv);
        const mastered = words.filter((w) => (w.interval_days || 0) >= 7).length;
        return {
          id: lv,
          name: THEME_NAMES[lv] || lv,
          icon: THEME_ICONS[lv] || '📚',
          count: words.length,
          mastery: words.length ? Math.round((mastered / words.length) * 100) : 0,
        };
      })
      .filter((d) => d.count > 0);
  }, [vocab]);

  const byDate = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? vocab.filter(
          (w) => w.word?.toLowerCase().includes(q) || w.translation?.toLowerCase().includes(q),
        )
      : vocab;
    const groups: Record<string, VocabItem[]> = {};
    for (const w of filtered) {
      const d = w.added_date || 'Unknown';
      if (!groups[d]) groups[d] = [];
      groups[d]!.push(w);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [vocab, search]);

  const byTheme = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? vocab.filter(
          (w) => w.word?.toLowerCase().includes(q) || w.translation?.toLowerCase().includes(q),
        )
      : vocab;
    const levels = ['A1', 'A2', 'B1', 'B2'];
    return levels
      .map((lv) => ({
        id: lv,
        name: THEME_NAMES[lv] || lv,
        icon: THEME_ICONS[lv] || '📚',
        words: filtered.filter((w) => w.level === lv),
      }))
      .filter((g) => g.words.length > 0);
  }, [vocab, search]);

  useEffect(() => {
    const q = deckId === 'due' ? due : vocab.filter((w) => w.level === deckId);
    setQueue(q);
    setIdx(0);
    setStats({ got: 0, stumbled: 0, forgot: 0 });
    setRevealed(false);
  }, [deckId, due, vocab]);

  useEffect(() => {
    if (tab !== 'practice') return;
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' && !revealed) {
        e.preventDefault();
        setRevealed(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tab, revealed]);

  const current = queue[idx];
  const sessionDone = idx >= queue.length;

  async function rate(q: number) {
    const w = current;
    if (!w) return;
    setStats((s) => {
      if (q <= 1) return { ...s, forgot: s.forgot + 1 };
      if (q === 3) return { ...s, stumbled: s.stumbled + 1 };
      return { ...s, got: s.got + 1 };
    });
    void apiPost('/vocab/review', { word: w.word, quality: q }).catch(() => {});
    setIdx((i) => i + 1);
    setRevealed(false);
  }

  async function addToDecks(word: string, level: string) {
    try {
      await apiPost('/vocab/add', { word, level });
      setAddedWords((s) => new Set(s).add(word));
    } catch {
      // ignore
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
      <h2 className="module-title">Vocabulary</h2>
      <p className="module-sub">Learn today&apos;s words, explore your collection, and practice with flashcards</p>

      {error ? <div className="msg-box msg-error">{error}</div> : null}

      <div className="tab-bar">
        <button className={`tab-btn${tab === 'today' ? ' active' : ''}`} onClick={() => setTab('today')}>
          Today&apos;s Learning
        </button>
        <button className={`tab-btn${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={`tab-btn${tab === 'practice' ? ' active' : ''}`} onClick={() => setTab('practice')}>
          Practice
        </button>
      </div>

      {/* ── TODAY'S LEARNING ── */}
      {tab === 'today' && (
        <div>
          {!plan ? (
            <div className="msg-box msg-info">Loading today&apos;s plan…</div>
          ) : (
            <>
              <div className="today-focus-bar">
                <span style={{ fontSize: 20 }}>🎯</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Today&apos;s Focus
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{plan.focus}</div>
                </div>
                <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                  {plan.vocab.length} words · {plan.level}
                </span>
              </div>
              <div className="today-vocab-grid">
                {plan.vocab.map((v) => (
                  <div key={v.word} className="today-vocab-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="today-vocab-word">{v.word}</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '3px 6px', fontSize: 14 }}
                          onClick={() => speakGerman(v.word)}
                        >
                          🔊
                        </button>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--ink-mute)',
                          border: '1px solid var(--line)',
                          padding: '2px 8px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {v.part_of_speech}
                      </span>
                    </div>
                    <div className="today-vocab-translation">{v.translation}</div>
                    {v.examples?.[0] && (
                      <div className="today-vocab-example">&ldquo;{v.examples[0]}&rdquo;</div>
                    )}
                    <button
                      className={`btn btn-sm${addedWords.has(v.word) ? ' btn-primary' : ''}`}
                      style={{ marginTop: 4 }}
                      disabled={addedWords.has(v.word)}
                      onClick={() => void addToDecks(v.word, plan.level)}
                    >
                      {addedWords.has(v.word) ? '✓ Added to deck' : '+ Add to deck'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div className="search-wrap" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search words or translations…"
              />
            </div>
            <div className="toggle-group">
              <button
                className={`toggle-opt${overviewMode === 'date' ? ' active' : ''}`}
                onClick={() => setOverviewMode('date')}
              >
                By Date
              </button>
              <button
                className={`toggle-opt${overviewMode === 'theme' ? ' active' : ''}`}
                onClick={() => setOverviewMode('theme')}
              >
                By Theme
              </button>
            </div>
          </div>

          {overviewMode === 'date' ? (
            byDate.length === 0 ? (
              <div className="text-muted text-sm">No vocabulary words yet. Start today&apos;s lesson to add words.</div>
            ) : (
              byDate.map(([date, words]) => {
                const expanded = isExpanded(date);
                return (
                  <div key={date} className="overview-group">
                    <div className="overview-group-header" onClick={() => toggleGroup(date)}>
                      <span style={{ fontSize: 18 }}>📅</span>
                      <span className="overview-group-title">
                        {date === 'Unknown' ? 'Unknown date' : formatDate(date)}
                      </span>
                      <span className="overview-group-count">
                        {words.length} word{words.length !== 1 ? 's' : ''}
                      </span>
                      <span style={{ color: 'var(--ink-mute)', marginLeft: 8 }}>{expanded ? '▴' : '▾'}</span>
                    </div>
                    {expanded && (
                      <div className="overview-word-list">
                        {words.map((w) => (
                          <div key={w.word} className="overview-word-row">
                            <span className="overview-word-text">{w.word}</span>
                            <span className="overview-word-pos">{w.part_of_speech || '—'}</span>
                            <span className="overview-word-trans">{w.translation || '—'}</span>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '3px 6px', flexShrink: 0 }}
                              onClick={() => speakGerman(w.word)}
                            >
                              🔊
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            byTheme.length === 0 ? (
              <div className="text-muted text-sm">No vocabulary words yet.</div>
            ) : (
              byTheme.map((g) => {
                const key = `theme-${g.id}`;
                const expanded = isExpanded(key);
                return (
                  <div key={g.id} className="overview-group">
                    <div className="overview-group-header" onClick={() => toggleGroup(key)}>
                      <span style={{ fontSize: 18 }}>{g.icon}</span>
                      <span className="overview-group-title">{g.name}</span>
                      <span className="overview-group-count">
                        {g.words.length} words · {g.id}
                      </span>
                      <span style={{ color: 'var(--ink-mute)', marginLeft: 8 }}>{expanded ? '▴' : '▾'}</span>
                    </div>
                    {expanded && (
                      <div className="overview-word-list">
                        {g.words.map((w) => (
                          <div key={w.word} className="overview-word-row">
                            <span className="overview-word-text">{w.word}</span>
                            <span className="overview-word-pos">{w.part_of_speech || '—'}</span>
                            <span className="overview-word-trans">{w.translation || '—'}</span>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '3px 6px', flexShrink: 0 }}
                              onClick={() => speakGerman(w.word)}
                            >
                              🔊
                            </button>
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

      {/* ── PRACTICE ── */}
      {tab === 'practice' && (
        <div className="vocab-layout">
          <div className="deck-panel">
            <div className="section-label" style={{ marginTop: 0 }}>
              Decks
            </div>
            <div className="deck-list">
              <div
                className={`deck-item${deckId === 'due' ? ' active' : ''}`}
                onClick={() => setDeckId('due')}
              >
                <div className="deck-icon">🔥</div>
                <div className="deck-info">
                  <div className="deck-name">Due today</div>
                  <div className="deck-meta">{due.length} cards</div>
                </div>
                <div className="deck-arrow">→</div>
              </div>
              {decks.map((d) => (
                <div
                  key={d.id}
                  className={`deck-item${deckId === d.id ? ' active' : ''}`}
                  onClick={() => setDeckId(d.id)}
                >
                  <div className="deck-icon">{d.icon}</div>
                  <div className="deck-info">
                    <div className="deck-name">{d.name}</div>
                    <div className="deck-meta">
                      {d.count} cards · {d.mastery}%
                    </div>
                  </div>
                  <div className="deck-arrow">→</div>
                </div>
              ))}
            </div>

            <div className="session-stats">
              <div className="section-label" style={{ marginTop: 0 }}>
                Today&apos;s Session
              </div>
              <div className="stat-row">
                <span className="stat-label">Reviewed</span>
                <span className="stat-val">{Math.min(idx, queue.length)}/{queue.length}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Got it</span>
                <span className="stat-val" style={{ color: 'var(--mint)' }}>{stats.got}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Stumbled</span>
                <span className="stat-val" style={{ color: 'var(--butter)' }}>{stats.stumbled}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Forgot</span>
                <span className="stat-val" style={{ color: 'var(--rose)' }}>{stats.forgot}</span>
              </div>
            </div>
          </div>

          <div className="review-area">
            {queue.length === 0 ? (
              <div className="review-card">
                <div className="serif" style={{ fontSize: '1.4rem', marginBottom: 8 }}>
                  No cards in this deck
                </div>
                <div className="text-muted text-sm">Add words from Today&apos;s Learning to grow your deck.</div>
              </div>
            ) : sessionDone ? (
              <div className="review-card">
                <div className="serif" style={{ fontSize: '1.6rem', marginBottom: 8 }}>
                  Session complete! 🎉
                </div>
                <div className="text-muted text-sm">
                  Reviewed {idx} cards — Got it: {stats.got} · Stumbled: {stats.stumbled} · Forgot: {stats.forgot}
                </div>
              </div>
            ) : (
              <div className="review-card" id="review-card">
                <div className="review-tag">{current?.level || 'A2'}</div>
                <button
                  className="review-speak btn btn-ghost"
                  style={{ padding: '6px 8px', fontSize: 16 }}
                  onClick={() => speakGerman(current?.word || '')}
                >
                  🔊
                </button>

                {!revealed ? (
                  <div>
                    <div className="review-word">{current?.word}</div>
                    {current?.ipa ? <div className="review-ipa">/ {current.ipa} /</div> : null}
                    <div className="review-sentence">
                      {current?.sentences?.[0] ? (
                        current.sentences[0]!.replace(new RegExp(`(${current.word})`, 'gi'), '___')
                      ) : (
                        <span className="text-muted">Press Space or tap to reveal</span>
                      )}
                    </div>
                    <button
                      className="btn btn-primary mt-24"
                      style={{ minWidth: 160 }}
                      onClick={() => setRevealed(true)}
                    >
                      Show answer
                    </button>
                  </div>
                ) : (
                  <div style={{ width: '100%' }}>
                    <div className="card-pos">{current?.part_of_speech || ''}</div>
                    <div className="review-word" style={{ color: 'var(--violet)' }}>{current?.word}</div>
                    <div className="review-translation">{current?.translation || ''}</div>
                    <div className="review-sentence text-muted mt-12">{current?.sentences?.[0] || ''}</div>
                    <div className="rate-grid">
                      <button className="rate-btn r-again" onClick={() => void rate(0)}>Again</button>
                      <button className="rate-btn r-hard" onClick={() => void rate(3)}>Hard</button>
                      <button className="rate-btn r-good" onClick={() => void rate(4)}>Good</button>
                      <button className="rate-btn r-easy" onClick={() => void rate(5)}>Easy</button>
                    </div>
                  </div>
                )}

                <div
                  className="flex between items-center"
                  style={{ padding: '0 8px', position: 'absolute', bottom: 12, left: 12, right: 12 }}
                >
                  <span className="text-xs text-muted">
                    Card {idx + 1} of {queue.length}
                  </span>
                  <span className="text-xs text-muted">Space to flip · keys 1–4 to rate</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
