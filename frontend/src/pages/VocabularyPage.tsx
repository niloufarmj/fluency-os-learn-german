import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { VocabItem } from '../utils/types';

function todayIso() {
  return new Date().toISOString().split('T')[0]!;
}

type Deck = { id: string; name: string; icon: string; count: number; mastery: number };

function buildDecks(vocab: VocabItem[]): Deck[] {
  const levels = ['A1', 'A2', 'B1', 'B2'];
  const icons = ['☕', '🏙️', '💭', '💼', '🧳'];
  const names = ['Café & Food', 'Around the city', 'Feelings & opinions', 'Work & study', 'Travel'];

  return levels
    .map((lv, i) => {
      const words = vocab.filter((w) => w.level === lv);
      const mastered = words.filter((w) => (w.interval_days || 0) >= 7).length;
      const mastery = words.length ? Math.round((mastered / words.length) * 100) : 0;
      return { id: lv, name: names[i] || lv, icon: icons[i] || '📚', count: words.length, mastery };
    })
    .filter((d) => d.count > 0);
}

function speakGerman(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'de-DE';
  msg.rate = 0.9;
  window.speechSynthesis.speak(msg);
}

export function VocabularyPage() {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [error, setError] = useState<string | null>(null);
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
        const v = await apiGet<VocabItem[]>('/vocab');
        if (!mounted) return;
        setVocab(v);
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
  const decks = useMemo(() => buildDecks(vocab), [vocab]);

  useEffect(() => {
    const q =
      deckId === 'due' ? due : vocab.filter((w) => w.level === deckId);
    setQueue(q);
    setIdx(0);
    setStats({ got: 0, stumbled: 0, forgot: 0 });
    setRevealed(false);
  }, [deckId, due, vocab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' && !revealed) {
        e.preventDefault();
        setRevealed(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [revealed]);

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

  return (
    <div>
      <h2 className="module-title">Vocabulary</h2>
      <p className="module-sub">Spaced repetition flashcard system</p>

      {error ? <div className="msg-box msg-error">{error}</div> : null}

      <div className="vocab-layout">
        <div className="deck-panel">
          <div className="section-label" style={{ marginTop: 0 }}>
            Decks
          </div>

          <div className="deck-list">
            <div className={`deck-item ${deckId === 'due' ? 'active' : ''}`} data-deck="due" onClick={() => setDeckId('due')}>
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
                className={`deck-item ${deckId === d.id ? 'active' : ''}`}
                data-deck={d.id}
                onClick={() => setDeckId(d.id)}
              >
                <div className="deck-icon">{d.icon}</div>
                <div className="deck-info">
                  <div className="deck-name">{d.name}</div>
                  <div className="deck-meta">
                    {d.count} cards • {d.mastery}% mastery
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
              <span className="stat-val">{Math.min(idx, queue.length)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Got it</span>
              <span className="stat-val" style={{ color: 'var(--mint)' }}>
                {stats.got}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Stumbled</span>
              <span className="stat-val" style={{ color: 'var(--butter)' }}>
                {stats.stumbled}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Forgot</span>
              <span className="stat-val" style={{ color: 'var(--rose)' }}>
                {stats.forgot}
              </span>
            </div>
          </div>
        </div>

        <div className="review-area">
          {sessionDone ? (
            <div className="review-card">
              <div className="serif" style={{ fontSize: '1.6rem', marginBottom: 8 }}>
                Session complete! 🎉
              </div>
              <div className="text-muted text-sm">Reviewed {idx} cards.</div>
            </div>
          ) : (
            <div className="review-card" id="review-card">
              <div className="review-tag">{current?.level || 'A2'}</div>
              <button className="review-speak btn btn-ghost" style={{ padding: '6px 8px', fontSize: 16 }} onClick={() => speakGerman(current?.word || '')}>
                🔊
              </button>

              {!revealed ? (
                <div>
                  <div className="review-word">{current?.word}</div>
                  {current?.ipa ? <div className="review-ipa">/ {current.ipa} /</div> : null}
                  <div className="review-sentence">
                    {(current?.sentences && current.sentences[0]) ? (
                      current.sentences[0]!.replace(new RegExp(`(${current.word})`, 'gi'), '___')
                    ) : (
                      <span className="text-muted">Tap show answer to reveal</span>
                    )}
                  </div>
                  <button className="btn btn-primary mt-24" style={{ minWidth: 160 }} onClick={() => setRevealed(true)}>
                    Show answer
                  </button>
                </div>
              ) : (
                <div style={{ width: '100%' }}>
                  <div className="card-pos">{current?.part_of_speech || ''}</div>
                  <div className="review-word" style={{ color: 'var(--violet)' }}>
                    {current?.word}
                  </div>
                  <div className="review-translation">{current?.translation || ''}</div>
                  <div className="review-sentence text-muted mt-12">{(current?.sentences && current.sentences[0]) || ''}</div>
                  <div className="rate-grid">
                    <button className="rate-btn r-again" onClick={() => void rate(0)}>
                      Again
                    </button>
                    <button className="rate-btn r-hard" onClick={() => void rate(3)}>
                      Hard
                    </button>
                    <button className="rate-btn r-good" onClick={() => void rate(4)}>
                      Good
                    </button>
                    <button className="rate-btn r-easy" onClick={() => void rate(5)}>
                      Easy
                    </button>
                  </div>
                </div>
              )}

              <div className="flex between items-center" style={{ padding: '0 8px', position: 'absolute', bottom: 12, left: 12, right: 12 }}>
                <span className="text-xs text-muted">
                  Card {idx + 1} of {queue.length}
                </span>
                <span className="text-xs text-muted">Space to flip</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

