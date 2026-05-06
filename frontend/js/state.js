// frontend/js/state.js
// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
const S = {
  module:   'dashboard',
  apiKey:   localStorage.getItem('fluency_api_key') || '',
  profile:  null,
  vocab:    [],
  syllabus: [],
  // review
  queue: [], qIdx: 0, qReviewed: 0,
  // chat
  history: [], scenario: null,
  // reading
  article: null,
  // grammar
  grammarData: null,
};

const BASE = 'http://localhost:8000';

// ══════════════════════════════════════════════
// API
// ══════════════════════════════════════════════
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.apiKey) headers['Authorization'] = 'Bearer ' + S.apiKey;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(BASE + path, opts);
    if (!r.ok) {
      const e = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(e.detail || 'Request failed');
    }
    return r.json();
  } catch (e) {
    if (e instanceof TypeError && e.message.includes('fetch')) {
      throw new Error('Cannot reach backend. Run: uvicorn main:app --reload');
    }
    throw e;
  }
}


let activeSeconds = 0;

// Only count time if tab is visible
setInterval(() => {
  if (document.visibilityState === 'visible') {
    activeSeconds++;
    // Save to backend every 60 seconds
    if (activeSeconds % 60 === 0) {
      api('POST', '/track-time', { date: new Date().toISOString(), minutes: 1 });
    }
  }
}, 1000);

// Onboarding specific state
S.onboardingSession = {
  active: false,
  api: null, // Temporary key used for testing/speaking review
  history: [] // Gathers all results [ {questionId: 1, type: 'mc', user_answer: 2, correct: true}, ...]
};