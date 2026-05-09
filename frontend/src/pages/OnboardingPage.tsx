import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import type { Profile } from '../utils/types';
import { useApp } from '../state/AppState';
import { useNavigate } from 'react-router-dom';

type GoalOption = { id: string; icon: string; title: string; desc: string };
type LevelOption = { id: string; icon: string; title: string; desc: string };
type CheerOption = { id: string; icon: string; title: string; quote: string };

const GOAL_OPTIONS: GoalOption[] = [
  { id: 'travel', icon: '✈️', title: 'Travel & culture', desc: 'Order coffee, navigate cities, chat with locals' },
  { id: 'work', icon: '💼', title: 'Work in Germany', desc: 'Job interviews, meetings, professional emails' },
  { id: 'family', icon: '👨‍👩‍👧', title: 'Family & friends', desc: 'Connect with loved ones in German' },
  { id: 'study', icon: '🎓', title: 'Study at a German uni', desc: 'Pass TestDaF, write essays, follow lectures' },
];

const LEVEL_OPTIONS: LevelOption[] = [
  { id: 'beginner', icon: '🌱', title: "I'm a complete beginner", desc: 'Hallo? Was?' },
  { id: 'basics', icon: '📚', title: 'I know some basics', desc: 'I can introduce myself' },
  { id: 'intermediate', icon: '🚀', title: "I'm intermediate", desc: 'Conversations, with effort' },
  { id: 'test', icon: '🎯', title: 'Test me', desc: 'Place me with a quick quiz' },
];

const CHEER_OPTIONS: CheerOption[] = [
  { id: 'coach', icon: '🔥', title: 'Coach', quote: '"You\'re crushing it!"' },
  { id: 'calm', icon: '🧘', title: 'Calm', quote: '"Genau. Continue."' },
  { id: 'witty', icon: '🦉', title: 'Witty', quote: '"The Duden is impressed."' },
];

type PlacementQuestion = {
  id: number;
  level: string;
  type: string;
  category: string;
  q: string;
  options?: string[];
  correct?: number;
  answer?: string;
  answer_pattern?: string;
  passage?: string;
  transcript?: string;
};

type QuestionHistoryEntry = {
  questionId: number;
  level: string;
  type: string;
  category: string;
  q: string;
  passages?: string | null;
  correct_answer?: unknown;
  user_answer?: unknown;
};

type Step = 'welcome' | 'info' | 'goal' | 'level' | 'test' | 'cheer' | 'loading' | 'result';
const STEPS: Step[] = ['welcome', 'info', 'goal', 'level', 'test', 'cheer', 'loading', 'result'];

export function OnboardingPage() {
  const { apiKey, setApiKey, refreshProfile } = useApp();
  const nav = useNavigate();

  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dailyTime, setDailyTime] = useState(30);
  const [localKey, setLocalKey] = useState(apiKey);

  const [goal, setGoal] = useState('');
  const [levelChoice, setLevelChoice] = useState('');
  const [cheer, setCheer] = useState('');

  const [testQuestions, setTestQuestions] = useState<PlacementQuestion[]>([]);
  const [testIdx, setTestIdx] = useState(0);
  const [history, setHistory] = useState<QuestionHistoryEntry[]>([]);
  const [testAnswer, setTestAnswer] = useState<string>('');
  const [testSelected, setTestSelected] = useState<number | null>(null);
  const [loadingErr, setLoadingErr] = useState<string | null>(null);
  const [resultProfile, setResultProfile] = useState<Profile | null>(null);

  useEffect(() => {
    // full-screen onboarding: hide sidebar spacing by using existing CSS container
    document.body.style.display = 'block';
    return () => {
      document.body.style.display = '';
    };
  }, []);

  const totalSteps = 5;
  const dotsIdx = useMemo(() => {
    const map: Record<Step, number> = { welcome: 0, info: 1, goal: 2, level: 3, test: 4, cheer: 5, loading: 5, result: 5 };
    return map[step] ?? 0;
  }, [step]);

  function next() {
    const i = STEPS.indexOf(step);
    setStep(STEPS[Math.min(STEPS.length - 1, i + 1)]!);
  }
  function prev() {
    const i = STEPS.indexOf(step);
    setStep(STEPS[Math.max(0, i - 1)]!);
  }

  async function startTest() {
    setLoadingErr(null);
    setStep('test');
    try {
      const qs = await apiGet<PlacementQuestion[]>('/placement/get-test');
      setTestQuestions(qs);
      setTestIdx(0);
      setHistory([]);
      setTestAnswer('');
      setTestSelected(null);
    } catch (e) {
      setLoadingErr(e instanceof Error ? e.message : String(e));
    }
  }

  function recordAnswer(entry: QuestionHistoryEntry) {
    setHistory((h) => [...h, entry]);
    setTestIdx((i) => i + 1);
    setTestAnswer('');
    setTestSelected(null);
  }

  async function finalize() {
    setLoadingErr(null);
    setStep('loading');

    const keyToUse = localKey || apiKey;
    if (!keyToUse) {
      setLoadingErr('LLM Grading requires an API key. Please go back and enter your key.');
      setStep('info');
      return;
    }

    try {
      const p = await apiPost<Profile>('/placement/grade-and-finalize', {
        name,
        time_minutes: dailyTime,
        priorities: [goal],
        apiKey: keyToUse,
        history,
      });
      if ((p as any).error) throw new Error((p as any).error);
      setResultProfile(p);
      setApiKey(keyToUse);
      await refreshProfile();
      setStep('result');
    } catch (e) {
      setLoadingErr(e instanceof Error ? e.message : String(e));
      setStep('cheer');
    }
  }

  const q = testQuestions[testIdx];
  const testDone = testQuestions.length > 0 && testIdx >= testQuestions.length;

  useEffect(() => {
    if (step === 'test' && testDone) setStep('cheer');
  }, [step, testDone]);

  function renderQuestionTitle(qt: PlacementQuestion | undefined) {
    if (!qt) return 'Placement Test';
    if (qt.type === 'multiple_choice' || qt.type === 'listening' || qt.type === 'reading') return 'Choose the correct answer';
    if (qt.type === 'writing_blank') return 'Fill in the blank';
    if (qt.type === 'writing_full') return 'Write your answer';
    if (qt.type === 'speaking_blank') return 'Speaking (type what you say)';
    if (qt.type === 'speaking_full') return 'Speaking (type what you say)';
    return 'Answer';
  }

  return (
    <div className="onboarding-wrap">
      <div className="onboarding-card">
        {step !== 'welcome' && step !== 'loading' && step !== 'result' ? (
          <div className="progress-dots">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className={`dot-pill ${i < dotsIdx - 1 ? 'done' : ''} ${i === dotsIdx - 1 ? 'active' : ''}`} />
            ))}
          </div>
        ) : null}

        {step === 'welcome' ? (
          <div className="text-center">
            <div className="welcome-logo">🇩🇪</div>
            <div className="welcome-title">
              Lerne Deutsch in
              <br />
              10 Minuten am Tag.
            </div>
            <div className="welcome-sub">
              FluencyOS adapts to how you learn. Real conversations, real progress, real Spaß.
            </div>
            <button className="btn btn-primary welcome-btn" onClick={() => setStep('info')}>
              Let&apos;s go →
            </button>
          </div>
        ) : null}

        {step === 'info' ? (
          <>
            <div className="ob-step-label">Step 1 of {totalSteps}</div>
            <div className="ob-title">Let&apos;s get to know you</div>
            <div className="ob-sub">We&apos;ll personalize your German learning journey.</div>

            <div className="flex-col gap-12">
              <div>
                <label className="setting-label">What is your name?</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Max Mustermann" />
              </div>
              <div>
                <label className="setting-label">Email (optional)</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="max@example.com" />
              </div>
              <div>
                <label className="setting-label">Daily learning time</label>
                <select value={dailyTime} onChange={(e) => setDailyTime(parseInt(e.target.value, 10))}>
                  <option value={15}>15 Minutes (Casual)</option>
                  <option value={30}>30 Minutes (Standard)</option>
                  <option value={60}>60 Minutes (Intensive)</option>
                </select>
              </div>
              <div>
                <label className="setting-label">Gemini API Key for Grading</label>
                <p className="text-xs text-muted mb-8 italic">
                  Speaking/Writing grading relies on LLM analysis. Enter your key now, or save it later in settings.
                </p>
                <input
                  type="password"
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="AIzaSy..."
                />
              </div>
            </div>

            {loadingErr ? <div className="msg-box msg-error">{loadingErr}</div> : null}

            <div className="ob-nav mt-24">
              <button className="btn btn-ghost" onClick={() => setStep('welcome')}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!name.trim()) {
                    setLoadingErr('Please enter your name.');
                    return;
                  }
                  setLoadingErr(null);
                  next();
                }}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 'goal' ? (
          <>
            <div className="ob-step-label">Step 2 of {totalSteps}</div>
            <div className="ob-title">Why are you learning German?</div>
            <div className="ob-sub">We&apos;ll personalize your lessons.</div>

            <div className="option-grid">
              {GOAL_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  className={`option-card ${goal === opt.id ? 'selected' : ''}`}
                  onClick={() => setGoal(opt.id)}
                >
                  <div className="option-icon">{opt.icon}</div>
                  <div className="option-title">{opt.title}</div>
                  <div className="option-desc">{opt.desc}</div>
                </div>
              ))}
            </div>

            <div className="ob-nav">
              <button className="btn btn-ghost" onClick={prev}>
                Back
              </button>
              <button className="btn btn-primary" onClick={next} disabled={!goal}>
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 'level' ? (
          <>
            <div className="ob-step-label">Step 3 of {totalSteps}</div>
            <div className="ob-title">How much German do you already know?</div>
            <div className="ob-sub">No judgment — we&apos;ll meet you where you are.</div>

            <div className="option-grid">
              {LEVEL_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  className={`option-card ${levelChoice === opt.id ? 'selected' : ''}`}
                  onClick={() => setLevelChoice(opt.id)}
                >
                  <div className="option-icon">{opt.icon}</div>
                  <div className="option-title">{opt.title}</div>
                  <div className="option-desc">{opt.desc}</div>
                </div>
              ))}
            </div>

            <div className="ob-nav">
              <button className="btn btn-ghost" onClick={prev}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!levelChoice) return;
                  void startTest(); // Step 4 is ALWAYS the placement test.
                }}
                disabled={!levelChoice}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 'test' ? (
          loadingErr ? (
            <div className="msg-box msg-error">{loadingErr}</div>
          ) : !q ? (
            <div className="spinner-wrap">
              <div className="spinner" /> Loading placement test…
            </div>
          ) : (
            <>
              <div className="ob-step-label">Step 4 of {totalSteps} • Quick Placement</div>
              <div className="ob-title">{renderQuestionTitle(q)}</div>
              <div className="ob-sub">
                Question {testIdx + 1} of {testQuestions.length}
              </div>

              <div className="blank-box">
                {q.type === 'reading' && q.passage ? (
                  <div className="text-sm text-muted" style={{ marginBottom: 12, textAlign: 'left' }}>
                    <div className="section-label" style={{ marginBottom: 8 }}>
                      Reading passage
                    </div>
                    {q.passage}
                  </div>
                ) : null}

                {q.type === 'listening' && q.transcript ? (
                  <div className="text-sm text-muted" style={{ marginBottom: 12, textAlign: 'left' }}>
                    <div className="section-label" style={{ marginBottom: 8 }}>
                      Listening transcript
                    </div>
                    {q.transcript}
                  </div>
                ) : null}

                <div
                  className="blank-text"
                  dangerouslySetInnerHTML={{
                    __html: q.q.replace(/___/g, '<span class="blank-gap">___</span>'),
                  }}
                />
              </div>

              {q.type === 'multiple_choice' || q.type === 'listening' || q.type === 'reading' ? (
                <div className="answer-grid">
                  {(q.options || []).map((opt, i) => (
                    <button
                      key={i}
                      className="answer-btn"
                      style={testSelected === i ? { borderColor: 'var(--violet)' } : undefined}
                      onClick={() => {
                        setTestSelected(i);
                      }}
                    >
                      <span className="ans-letter">{['A', 'B', 'C', 'D'][i] || '?'}</span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {q.type === 'writing_blank' ? (
                <div>
                  <input
                    value={testAnswer}
                    onChange={(e) => setTestAnswer(e.target.value)}
                    placeholder="Type your answer…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const text = testAnswer.trim();
                        if (!text) return;
                        recordAnswer({
                          questionId: q.id,
                          level: q.level,
                          type: q.type,
                          category: q.category,
                          q: q.q,
                          passages: null,
                          correct_answer: q.answer ?? null,
                          user_answer: text,
                        });
                      }
                    }}
                  />
                </div>
              ) : null}

              {q.type === 'writing_full' || q.type === 'speaking_blank' || q.type === 'speaking_full' ? (
                <div>
                  <textarea
                    value={testAnswer}
                    onChange={(e) => setTestAnswer(e.target.value)}
                    rows={4}
                    placeholder={q.type.startsWith('speaking') ? 'Type what you say…' : 'Schreib auf Deutsch…'}
                  />
                  <div className="text-xs text-muted mt-8 italic">
                    Note: speech-to-text recording isn&apos;t wired yet in the React rewrite — typing is used for now.
                  </div>
                </div>
              ) : null}

              <div className="ob-nav">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    if (testIdx > 0) {
                      setTestIdx((i) => i - 1);
                      setHistory((h) => h.slice(0, -1));
                      return;
                    }
                    setStep('level');
                  }}
                >
                  Back
                </button>

                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    // Mark that the user cannot continue (questions above their level).
                    recordAnswer({
                      questionId: q.id,
                      level: q.level,
                      type: q.type,
                      category: q.category,
                      q: q.q,
                      passages: q.type === 'reading' ? q.passage ?? null : q.type === 'listening' ? q.transcript ?? null : null,
                      correct_answer: q.correct ?? q.answer ?? q.answer_pattern ?? null,
                      user_answer: '__CANT_ANSWER_ANYMORE__',
                    });
                    setStep('cheer');
                  }}
                >
                  I can&apos;t answer anymore
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (q.type === 'multiple_choice' || q.type === 'listening' || q.type === 'reading') {
                      if (testSelected === null) return;
                      recordAnswer({
                        questionId: q.id,
                        level: q.level,
                        type: q.type,
                        category: q.category,
                        q: q.q,
                        passages: q.type === 'reading' ? q.passage ?? null : q.type === 'listening' ? q.transcript ?? null : null,
                        correct_answer: q.correct ?? null,
                        user_answer: testSelected,
                      });
                      return;
                    }

                    const text = testAnswer.trim();
                    if (!text) return;
                    recordAnswer({
                      questionId: q.id,
                      level: q.level,
                      type: q.type,
                      category: q.category,
                      q: q.q,
                      passages: q.type === 'reading' ? q.passage ?? null : q.type === 'listening' ? q.transcript ?? null : null,
                      correct_answer: q.answer ?? q.answer_pattern ?? null,
                      user_answer: text,
                    });
                  }}
                  disabled={
                    (q.type === 'multiple_choice' || q.type === 'listening' || q.type === 'reading')
                      ? testSelected === null
                      : !testAnswer.trim()
                  }
                >
                  Next
                </button>
              </div>
            </>
          )
        ) : null}

        {step === 'cheer' ? (
          <>
            <div className="ob-step-label">Step 5 of {totalSteps}</div>
            <div className="ob-title">How should we cheer you on?</div>
            <div className="ob-sub">You can change this any time.</div>

            <div className="cheer-grid">
              {CHEER_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  className={`cheer-card ${cheer === opt.id ? 'selected' : ''}`}
                  onClick={() => setCheer(opt.id)}
                >
                  <div className="cheer-emoji">{opt.icon}</div>
                  <div className="cheer-name">{opt.title}</div>
                  <div className="cheer-quote">{opt.quote}</div>
                </div>
              ))}
            </div>

            {loadingErr ? <div className="msg-box msg-error">{loadingErr}</div> : null}

            <div className="ob-nav">
              <button className="btn btn-ghost" onClick={() => setStep('test')}>
                Back
              </button>
              <button className="btn btn-primary" onClick={() => void finalize()} disabled={!cheer}>
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 'loading' ? (
          <div className="text-center" style={{ padding: 60 }}>
            <div className="spinner-wrap" style={{ padding: 0, marginBottom: 20 }}>
              <div className="spinner" />
            </div>
            <div className="serif" style={{ fontSize: '1.4rem', marginBottom: 8 }}>
              Analyzing your responses…
            </div>
            <p className="text-muted text-sm">We&apos;re determining your CEFR level and building your personalized plan.</p>
          </div>
        ) : null}

        {step === 'result' ? (
          <div className="text-center">
            <div className="serif" style={{ fontSize: '1.6rem', color: 'var(--violet)', marginBottom: 8 }}>
              Registration Complete
            </div>
            <p className="text-muted text-sm">Welcome aboard, {resultProfile?.name || name}!</p>
            <div style={{ margin: '32px 0' }}>
              <div className="text-xs uppercase text-muted mb-8">Your deduced CEFR Level</div>
              <div
                className="serif"
                style={{ fontSize: '5rem', lineHeight: 1, color: 'var(--violet)', fontWeight: 900 }}
              >
                {resultProfile?.level || 'A2'}
              </div>
              <p className="explanation-box mt-20 italic text-sm" style={{ lineHeight: 1.6 }}>
                {resultProfile?.level_analysis || 'Based on your placement test, this is the level we recommend starting with.'}
              </p>
            </div>
            <button className="btn btn-primary full-w" onClick={() => nav('/dashboard')}>
              Go to Dashboard →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

