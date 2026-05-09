import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../utils/api';
import type { LogEntry, VocabItem } from '../utils/types';
import { useApp } from '../state/AppState';
import { Link, useNavigate } from 'react-router-dom';

const DAILY_WORDS = [
  { word: 'die Freiheit', part_of_speech: 'noun', translation: 'freedom' },
  { word: 'gemütlich', part_of_speech: 'adjective', translation: 'cozy, comfortable' },
  { word: 'das Abenteuer', part_of_speech: 'noun', translation: 'adventure' },
  { word: 'aufgeregt', part_of_speech: 'adjective', translation: 'excited, agitated' },
  { word: 'das Fernweh', part_of_speech: 'noun', translation: 'wanderlust' },
  { word: 'die Weltanschauung', part_of_speech: 'noun', translation: 'worldview' },
  { word: 'die Sehnsucht', part_of_speech: 'noun', translation: 'longing, yearning' },
  { word: 'überrascht', part_of_speech: 'adjective', translation: 'surprised' },
  { word: 'der Zusammenhalt', part_of_speech: 'noun', translation: 'cohesion' },
  { word: 'neugierig', part_of_speech: 'adjective', translation: 'curious' },
  { word: 'die Freude', part_of_speech: 'noun', translation: 'joy' },
  { word: 'selbstständig', part_of_speech: 'adjective', translation: 'independent' },
  { word: 'das Heimweh', part_of_speech: 'noun', translation: 'homesickness' },
  { word: 'leidenschaftlich', part_of_speech: 'adjective', translation: 'passionate' },
];

function todayIso() {
  return new Date().toISOString().split('T')[0]!;
}

function calculateTodayXP(logs: LogEntry[]) {
  const t = todayIso();
  let xp = 0;
  for (const l of logs || []) {
    if (l.date && l.date.startsWith(t)) {
      xp += (l.active_minutes || 0) * 10;
      if (l.type === 'roleplay') xp += (l.score || 0) * 5;
      if (l.type === 'placement_exam') xp += 50;
    }
  }
  return Math.min(300, xp);
}

function speakGerman(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'de-DE';
  msg.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const deVoice = voices.find((v) => v.lang === 'de-DE' || v.lang === 'de_DE');
  if (deVoice) msg.voice = deVoice;
  window.speechSynthesis.speak(msg);
}

export function DashboardPage() {
  const { profile, refreshProfile } = useApp();
  const nav = useNavigate();

  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const [v, l] = await Promise.all([apiGet<VocabItem[]>('/vocab'), apiGet<LogEntry[]>('/logs')]);
        if (!mounted) return;
        setVocab(v);
        setLogs(l);
        await refreshProfile();
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshProfile]);

  const greet = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
  }, []);

  const name = profile?.name || 'Learner';
  const streak = profile?.streak || 0;
  const xpToday = calculateTodayXP(logs);

  const source = vocab.length > 0 ? vocab : DAILY_WORDS;
  const wotd = source[new Date().getDate() % source.length] as any;

  return (
    <div>
      <div className="hero-banner">
        <div className="hero-greet">
          {greet}, {name}
        </div>
        <div className="hero-title">
          You&apos;re crushing it, {name}! {streak} days
        </div>
        <div className="hero-sub">Ready for today&apos;s lesson? Your daily plan is queued and ready to go.</div>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => nav('/plan')}>
            <span>▶</span> Continue today&apos;s plan
          </button>
          <Link className="btn" to="/reading">
            Browse stories
          </Link>
        </div>
      </div>

      {error ? (
        <div className="msg-box msg-error">{error}</div>
      ) : (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">🔥 Streak</div>
              <div className="stat-value">{streak}</div>
              <div className="text-xs text-muted mt-4">days • best {profile?.best_streak || '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">⚡ XP Today</div>
              <div className="stat-value">{xpToday}</div>
              <div className="text-xs text-muted mt-4">of 300 goal</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">🏆 Level</div>
              <div className="stat-value">14</div>
              <div className="text-xs text-muted mt-4">—</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">🎯 CEFR</div>
              <div className="stat-value">{profile?.level || 'A2'}</div>
              <div className="text-xs text-muted mt-4">—</div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-main">
              <div className="card plan-card">
                <div className="plan-header">
                  <div className="section-label" style={{ marginBottom: 0 }}>
                    Today&apos;s Plan
                  </div>
                  <div className="plan-time">{profile?.daily_time_minutes || 30} min</div>
                </div>
                <div id="plan-area">
                  <div className="task-list">
                    <div className="task-item" onClick={() => nav('/plan')}>
                      <div className="task-check" />
                      <div className="task-info">
                        <div className="task-type">🧠 Daily Plan</div>
                        <div className="task-detail">Open your ready-to-study lesson for today</div>
                      </div>
                      <div className="task-meta">
                        <div className="task-pct">→</div>
                        <div className="text-xs text-muted">{profile?.daily_time_minutes || 30} min</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted mt-12 italic" style={{ textAlign: 'center' }}>
                  🔒 Complete all tasks to unlock tomorrow&apos;s content
                </div>
              </div>

              <div className="wotd-card">
                <div>
                  <div className="section-label">Word of the Day</div>
                  <div className="wotd-word">{wotd?.word || '—'}</div>
                  <div className="mt-8">
                    <span className="wotd-pos">{wotd?.part_of_speech || ''}</span>{' '}
                    <span className="wotd-trans">{wotd?.translation || ''}</span>
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 20 }} onClick={() => speakGerman(wotd?.word || '')}>
                  🔊
                </button>
              </div>
            </div>

            <div className="dashboard-side">
              <div className="streak-card">
                <div className="streak-flame">🔥</div>
                <div className="streak-count">{streak}</div>
                <div className="streak-label">Day Streak</div>
                <div className="streak-msg">Keep going to hit 50!</div>
              </div>
              <div className="card">
                <div className="section-label">Recent Unlocks</div>
                <div className="unlocks-grid">
                  {[
                    { icon: '🌅', name: 'Frühaufsteher', locked: streak < 7 },
                    { icon: '🔥', name: '30-Day Flame', locked: streak < 30 },
                    { icon: '📚', name: 'Wortschatz', locked: vocab.length < 50 },
                    { icon: '💎', name: 'Perfekt', locked: vocab.length < 100 },
                    { icon: '🦉', name: 'Philosoph', locked: streak < 14 },
                    { icon: '🏃', name: 'Marathon', locked: streak < 50 },
                  ].map((u) => (
                    <div key={u.name} className={`unlock-item ${u.locked ? 'locked' : ''}`} title={u.name}>
                      <div className="unlock-icon">{u.icon}</div>
                      <div style={{ fontSize: 10 }}>{u.name}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card path-card">
                <div className="path-header">
                  <div className="section-label" style={{ marginBottom: 0 }}>
                    Your Path
                  </div>
                  <div className="path-level">{profile?.level || 'A2'}</div>
                </div>
                <div className="path-track">
                  <div className="path-node completed">A1</div>
                  <div className="path-line">
                    <div className="path-line-fill" style={{ width: '100%' }} />
                  </div>
                  <div className="path-node active">{profile?.level || 'A2'}</div>
                  <div className="path-line">
                    <div className="path-line-fill" style={{ width: '0%' }} />
                  </div>
                  <div className="path-node">B1</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

