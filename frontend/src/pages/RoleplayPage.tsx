import { useMemo, useRef, useState } from 'react';
import { apiPost } from '../utils/api';
import type { ChatMessage, ChatScenarioResponse, DailyPlanDetailed, EndChatReviewResult } from '../utils/types';
import { useApp } from '../state/AppState';
import { apiGet } from '../utils/api';
import { useEffect } from 'react';

type Tab = 'today' | 'scenarios';
type Scenario = { level: string; icon: string; title: string; desc: string; sys: string };

const SCENARIOS: Scenario[] = [
  { level: 'A1', icon: '🥖', title: 'Buying Bread', desc: 'At a German bakery, ordering Brötchen and Brot.', sys: 'You are a friendly German bakery employee.' },
  { level: 'A1', icon: '☕', title: 'Ordering Coffee', desc: 'At a café, ordering coffee and a snack.', sys: 'You are a German café waiter.' },
  { level: 'A2', icon: '🚂', title: 'Buying Train Tickets', desc: 'At Munich Hauptbahnhof, purchasing a ticket.', sys: 'You are a German train station employee.' },
  { level: 'A2', icon: '🏥', title: 'At the Doctor', desc: 'Explaining symptoms to a German doctor.', sys: 'You are a German general practitioner.' },
  { level: 'B1', icon: '🏠', title: 'Arguing with Landlord', desc: 'Discussing a repair issue with your Vermieter.', sys: 'You are a German landlord.' },
  { level: 'B1', icon: '💼', title: 'Job Interview', desc: 'Interviewing for a position at a German company.', sys: 'You are a German HR manager.' },
];

const OPENINGS: Record<string, string> = {
  'Buying Bread': 'Guten Morgen! Was darf es sein?',
  'Ordering Coffee': 'Willkommen! Was möchten Sie trinken?',
  'Buying Train Tickets': 'Guten Tag! Wohin möchten Sie fahren?',
  'At the Doctor': 'Guten Tag, bitte setzen Sie sich. Was fehlt Ihnen?',
  'Arguing with Landlord': 'Hallo. Was gibt es?',
  'Job Interview': 'Guten Morgen, nehmen Sie bitte Platz. Erzählen Sie mir etwas über sich.',
};

export function RoleplayPage() {
  const { profile } = useApp();
  const [tab, setTab] = useState<Tab>('today');
  const [plan, setPlan] = useState<DailyPlanDetailed | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [review, setReview] = useState<EndChatReviewResult | null>(null);
  const [reviewErr, setReviewErr] = useState<string | null>(null);

  const msgsRef = useRef<HTMLDivElement | null>(null);
  const opening = useMemo(() => (scenario ? OPENINGS[scenario.title] || 'Guten Tag!' : ''), [scenario]);

  useEffect(() => {
    let mounted = true;
    apiGet<{ plan: DailyPlanDetailed }>('/plan/today')
      .then((p) => { if (mounted) setPlan(p.plan); })
      .catch(() => {})
      .finally(() => { if (mounted) setPlanLoading(false); });
    return () => { mounted = false; };
  }, []);

  function start(sc: Scenario) {
    setScenario(sc);
    setReview(null);
    setReviewErr(null);
    const initial: ChatMessage[] = [{ role: 'assistant', content: OPENINGS[sc.title] || 'Guten Tag!' }];
    setHistory(initial);
    setText('');
  }

  function startFromPlan() {
    if (!plan) return;
    const sc: Scenario = {
      level: plan.level,
      icon: '🎭',
      title: plan.roleplay.scenario_title,
      desc: plan.roleplay.opening,
      sys: `You are playing the role in the scenario: ${plan.roleplay.scenario_title}. Open with: "${plan.roleplay.opening}"`,
    };
    setScenario(sc);
    setReview(null);
    setReviewErr(null);
    setHistory([{ role: 'assistant', content: plan.roleplay.opening }]);
    setText('');
  }

  async function send() {
    const msg = text.trim();
    if (!msg || !scenario) return;
    setText('');
    setSending(true);
    const nextHist: ChatMessage[] = [...history, { role: 'user', content: msg }];
    setHistory(nextHist);
    try {
      const d = await apiPost<ChatScenarioResponse>('/chat-scenario', {
        scenario: scenario.title,
        level: scenario.level,
        history: nextHist,
      });
      const finalHist: ChatMessage[] = [...nextHist, { role: 'assistant', content: d.reply }];
      setHistory(finalHist);
      setTimeout(() => {
        const el = msgsRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
    } catch (e) {
      setHistory((h) => [
        ...h,
        { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : String(e)}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function endConversation() {
    if (!scenario) return;
    if (history.length < 2) {
      alert('Have a short conversation first!');
      return;
    }
    setReview(null);
    setReviewErr(null);
    try {
      const level = scenario.level || profile?.level || 'A2';
      const d = await apiPost<EndChatReviewResult>('/end-chat-review', { transcript: history, level });
      setReview(d);
    } catch (e) {
      setReviewErr(e instanceof Error ? e.message : String(e));
    }
  }

  // When in a conversation, show the chat view
  if (scenario) {
    return (
      <div>
        <div className="back-link" onClick={() => setScenario(null)}>
          ← Back
        </div>

        <div className="flex between items-center mb-16">
          <div>
            <div className="sc-level">{scenario.level}</div>
            <div className="serif" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {scenario.title}
            </div>
            {scenario.desc && (
              <div className="text-sm text-muted">{scenario.desc}</div>
            )}
          </div>
          <button className="btn" onClick={() => void endConversation()} disabled={sending}>
            End &amp; Review
          </button>
        </div>

        <div className="chat-wrap">
          <div className="chat-msgs" id="chat-msgs" ref={msgsRef}>
            {history.length === 0 ? <div className="msg assistant">{opening}</div> : null}
            {history.map((m, i) => (
              <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'assistant'}`}>
                {m.content}
              </div>
            ))}
            {sending ? (
              <div className="typing">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
            ) : null}
          </div>
          <div className="chat-bar">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Schreib auf Deutsch…"
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              disabled={sending}
              autoComplete="off"
            />
            <button className="btn btn-primary" onClick={() => void send()} disabled={sending}>
              Send
            </button>
          </div>
        </div>

        {review || reviewErr ? (
          <div
            className="overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setReview(null);
                setReviewErr(null);
              }
            }}
          >
            <div className="modal">
              <div className="modal-title">Conversation Review</div>
              {reviewErr ? <div className="msg-box msg-error">{reviewErr}</div> : null}
              {review ? (
                <div>
                  <div className="score-big">
                    {review.score}
                    <span className="score-denom">/10</span>
                  </div>
                  <div className="score-summary">{review.summary || ''}</div>
                  <div className="section-label">Mistakes &amp; Corrections</div>
                  {review.mistakes?.length ? (
                    review.mistakes.map((m, i) => (
                      <div key={i} className="mistake-item">
                        <div className="mistake-orig">✗ {m.original}</div>
                        <div className="mistake-fix">✓ {m.correction}</div>
                        <div className="mistake-why">{m.explanation}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted text-sm">No major mistakes found!</p>
                  )}
                  <button
                    className="btn btn-primary full-w mt-24"
                    onClick={() => { setReview(null); setReviewErr(null); }}
                  >
                    Close
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <h2 className="module-title">Roleplay</h2>
      <p className="module-sub">Practice real-life German conversations with AI characters</p>

      <div className="tab-bar">
        <button className={`tab-btn${tab === 'today' ? ' active' : ''}`} onClick={() => setTab('today')}>
          Today&apos;s Roleplay
        </button>
        <button className={`tab-btn${tab === 'scenarios' ? ' active' : ''}`} onClick={() => setTab('scenarios')}>
          All Scenarios
        </button>
      </div>

      {/* ── TODAY'S ROLEPLAY ── */}
      {tab === 'today' && (
        <div>
          {planLoading ? (
            <div className="spinner-wrap"><div className="spinner" /> Loading today&apos;s roleplay…</div>
          ) : !plan ? (
            <div className="msg-box msg-info">Could not load today&apos;s plan. Check your API key in Settings.</div>
          ) : (
            <>
              <div className="today-focus-bar">
                <span style={{ fontSize: 20 }}>🎭</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pink)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Today&apos;s Scenario
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{plan.roleplay.scenario_title}</div>
                </div>
                <span
                  style={{ marginLeft: 'auto', fontSize: 11, background: 'var(--pink-soft)', color: 'var(--pink)', padding: '3px 10px', borderRadius: 8 }}
                >
                  {plan.level}
                </span>
              </div>

              <div className="card">
                <div className="section-label">Scenario Overview</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Opening line:</div>
                <div
                  style={{
                    background: 'var(--bg-sunken)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    fontStyle: 'italic',
                    fontSize: 15,
                    color: 'var(--ink)',
                    marginBottom: 16,
                  }}
                >
                  &ldquo;{plan.roleplay.opening}&rdquo;
                </div>

                <div className="section-label">Target Phrases</div>
                <div className="flex gap-8 flex-wrap" style={{ marginBottom: 20 }}>
                  {plan.roleplay.target_phrases.map((p, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'var(--violet-soft)',
                        color: 'var(--violet)',
                        border: '1px solid rgba(139,92,246,0.2)',
                        borderRadius: 8,
                        padding: '5px 12px',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>

                <button className="btn btn-primary" style={{ minWidth: 200 }} onClick={startFromPlan}>
                  ▶ Start Conversation
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ALL SCENARIOS ── */}
      {tab === 'scenarios' && (
        <div>
          {(['A1', 'A2', 'B1'] as const).map((level) => {
            const levelScenarios = SCENARIOS.filter((s) => s.level === level);
            return (
              <div key={level} style={{ marginBottom: 24 }}>
                <div className="section-label">{level} Scenarios</div>
                <div className="scenario-grid">
                  {levelScenarios.map((s) => (
                    <div key={s.title} className="scenario-card" onClick={() => start(s)}>
                      <div className="sc-level">{s.level}</div>
                      <div className="sc-title">
                        {s.icon} {s.title}
                      </div>
                      <div className="sc-desc">{s.desc}</div>
                      <div className="scenario-play" style={{ marginTop: 16, color: 'var(--violet)', fontWeight: 700, fontSize: 13 }}>
                        ▶ Start Conversation
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
