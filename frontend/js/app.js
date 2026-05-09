'use strict';

// ══════════════════════════════════════════════
// ROUTING
// ══════════════════════════════════════════════
function go(mod) {
  S.module = mod;
  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('active', n.dataset.m === mod)
  );
  const main = document.getElementById('main');
  main.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'module';
  main.appendChild(wrap);
  MODULES[mod](wrap);
}

document.getElementById('nav').addEventListener('click', e => {
  const item = e.target.closest('.nav-item');
  if (item) go(item.dataset.m);
});

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().split('T')[0];

function spin(msg = 'Loading…') {
  return `<div class="spinner-wrap"><div class="spinner"></div>${msg}</div>`;
}
function errBox(msg) { return `<div class="msg-box msg-error">${esc(msg)}</div>`; }
function okBox(msg) { return `<div class="msg-box msg-success">${esc(msg)}</div>`; }
function infoBox(msg) { return `<div class="msg-box msg-info">${msg}</div>`; }

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

function speakGerman(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'de-DE';
  msg.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const deVoice = voices.find(v => v.lang === 'de-DE' || v.lang === 'de_DE');
  if (deVoice) msg.voice = deVoice;
  window.speechSynthesis.speak(msg);
}

window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// ══════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem('fluency_theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  updateThemeBtn();
}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme || 'dark';
  setTheme(cur === 'dark' ? 'light' : 'dark');
}

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('fluency_theme', t);
  updateThemeBtn();
}

function updateThemeBtn() {
  const t = document.documentElement.dataset.theme || 'dark';
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.innerHTML = t === 'dark' ? '☀️ &nbsp;Light Mode' : '🌙 &nbsp;Dark Mode';
}

// ══════════════════════════════════════════════
// SIDEBAR PROFILE
// ══════════════════════════════════════════════
function updateSidebarProfile(profile) {
  if (!profile) return;
  const nameEl = document.getElementById('sidebar-user-name');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const levelEl = document.getElementById('sidebar-level');
  if (nameEl) nameEl.textContent = profile.name || 'Learner';
  if (avatarEl) avatarEl.textContent = (profile.name || 'G')[0].toUpperCase();
  if (levelEl) levelEl.textContent = profile.level || 'A2';
}

// ══════════════════════════════════════════════
// VOCABULARY HELPERS
// ══════════════════════════════════════════════
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

function nextLevel(lvl) {
  const map = {A1:'A2', A2:'B1', B1:'B2', B2:'C1', C1:'C2'};
  return map[lvl] || 'B1';
}

function calculateTodayXP(logs) {
  const today = new Date().toISOString().split('T')[0];
  let xp = 0;
  (logs || []).forEach(l => {
    if (l.date && l.date.startsWith(today)) {
      xp += (l.active_minutes || 0) * 10;
      if (l.type === 'roleplay') xp += (l.score || 0) * 5;
      if (l.type === 'placement_exam') xp += 50;
    }
  });
  return Math.min(300, xp);
}

// ══════════════════════════════════════════════
// MODULE: DASHBOARD
// ══════════════════════════════════════════════
async function renderDashboard(c) {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
  const name = S.profile?.name || 'Learner';

  c.innerHTML = `
    <div class="module">
      <div class="hero-banner">
        <div class="hero-greet">${greet}, ${esc(name)}</div>
        <div class="hero-title">You're crushing it, ${esc(name)}! ${S.profile?.streak || 0} days</div>
        <div class="hero-sub">Ready for today's lesson? Your daily plan is queued and ready to go.</div>
        <div class="hero-actions">
          <button class="btn btn-primary" onclick="go('vocabulary')">
            <span>▶</span> Continue today's plan
          </button>
          <button class="btn" onclick="go('reading')">Browse stories</button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">🔥 Streak</div>
          <div class="stat-value" id="st-streak">—</div>
          <div class="text-xs text-muted mt-4">days • best ${S.profile?.best_streak || '—'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">⚡ XP Today</div>
          <div class="stat-value" id="st-xp">—</div>
          <div class="text-xs text-muted mt-4">of 300 goal</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">🏆 Level</div>
          <div class="stat-value" id="st-lvl">—</div>
          <div class="text-xs text-muted mt-4" id="st-lvl-pct">—</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">🎯 CEFR</div>
          <div class="stat-value" id="st-cefr">—</div>
          <div class="text-xs text-muted mt-4" id="st-cefr-track">—</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-main">
          <div class="card plan-card">
            <div class="plan-header">
              <div class="section-label" style="margin-bottom:0">Today's Plan</div>
              <div class="plan-time" id="plan-time">0 / 30 min</div>
            </div>
            <div class="progress-bar mb-16">
              <div class="progress-fill" id="plan-bar" style="width:0%"></div>
            </div>
            <div id="plan-area">${spin('Generating plan…')}</div>
            <div class="text-xs text-muted mt-12 italic" style="text-align:center;">
              🔒 Complete all tasks to unlock tomorrow's content
            </div>
          </div>

          <div class="wotd-card" id="wotd-card">
            <div>
              <div class="section-label">Word of the Day</div>
              <div class="wotd-word" id="wotd-word">—</div>
              <div class="mt-8">
                <span class="wotd-pos" id="wotd-pos"></span>
                <span class="wotd-trans" id="wotd-trans"></span>
              </div>
            </div>
            <button class="btn btn-ghost" id="wotd-speak" style="font-size:20px;">🔊</button>
          </div>
        </div>

        <div class="dashboard-side">
          <div class="streak-card">
            <div class="streak-flame">🔥</div>
            <div class="streak-count" id="side-streak">0</div>
            <div class="streak-label">Day Streak</div>
            <div class="week-tracker" id="week-tracker"></div>
            <div class="streak-msg" id="streak-msg">Keep going to hit 50!</div>
          </div>

          <div class="card">
            <div class="section-label">Recent Unlocks</div>
            <div class="unlocks-grid" id="unlocks-grid"></div>
          </div>

          <div class="card path-card">
            <div class="path-header">
              <div class="section-label" style="margin-bottom:0">Your Path</div>
              <div class="path-level" id="path-level">A2</div>
            </div>
            <div class="path-track">
              <div class="path-node completed">A1</div>
              <div class="path-line"><div class="path-line-fill" style="width:100%"></div></div>
              <div class="path-node active" id="path-current">A2</div>
              <div class="path-line"><div class="path-line-fill" style="width:0%"></div></div>
              <div class="path-node" id="path-next">B1</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const [plan, profile, vocab, logs] = await Promise.all([
      api('GET','/daily-plan'),
      api('GET','/profile'),
      api('GET','/vocab'),
      api('GET','/logs'),
    ]);
    S.profile = profile; S.vocab = vocab;
    updateSidebarProfile(profile);

    const streak = profile.streak || 0;
    const wordsMastered = vocab.filter(w => (w.interval_days || 0) >= 21).length;
    const xpToday = calculateTodayXP(logs);
    const lvl = profile.level || 'A2';
    const lvlPct = Math.round((wordsMastered % 50) / 50 * 100);

    $('st-streak').textContent = streak;
    $('st-xp').textContent = xpToday;
    $('st-lvl').textContent = 14;
    $('st-lvl-pct').textContent = `${lvlPct}% to lvl 15`;
    $('st-cefr').textContent = lvl;
    $('st-cefr-track').textContent = `tracking ${nextLevel(lvl)} in 6 wks`;
    $('side-streak').textContent = streak;
    $('path-level').textContent = lvl;
    $('path-current').textContent = lvl;
    $('path-next').textContent = nextLevel(lvl);

    const goal = profile.daily_time_minutes || 30;
    const studied = Math.min(goal, Math.floor(activeSeconds / 60));
    const pct = Math.min(100, Math.round((studied / goal) * 100));
    $('plan-time').textContent = `${studied} / ${goal} min`;
    $('plan-bar').style.width = pct + '%';

    const source = vocab.length > 0 ? vocab : DAILY_WORDS;
    const wotd = source[new Date().getDate() % source.length];
    $('wotd-word').textContent = wotd.word;
    $('wotd-pos').textContent = wotd.part_of_speech || '';
    $('wotd-trans').textContent = wotd.translation || '';
    const speakBtn = $('wotd-speak');
    if (speakBtn) speakBtn.onclick = () => speakGerman(wotd.word);

    buildPlan($('plan-area'), plan.tasks, studied, goal);
    buildWeekTracker($('week-tracker'), logs, goal);
    buildUnlocks($('unlocks-grid'), profile, vocab);

  } catch(e) {
    $('plan-area').innerHTML = errBox(e.message);
  }
}

function buildPlan(el, tasks, studied, goal) {
  const typeMap = { vocab_review:'vocabulary', grammar:'grammar', reading:'reading', roleplay:'roleplay' };
  const typeLabels = { vocab_review:'Vocab review', grammar:'Grammar', reading:'Reading', end_of_day_test:'End of Day Test' };
  const typeIcons = { vocab_review:'🗂️', grammar:'🧩', reading:'📖', roleplay:'🎭', end_of_day_test:'📝' };

  const taskGoal = goal / Math.max(1, tasks.length);
  const taskProgress = tasks.map((t, i) => {
    const allocated = Math.min(taskGoal, Math.max(0, studied - i * taskGoal));
    return Math.min(100, Math.round((allocated / taskGoal) * 100));
  });

  el.innerHTML = `<div class="task-list">` + tasks.map((t, i) => {
    const mod = typeMap[t.type] || 'dashboard';
    const progress = taskProgress[i];
    const isDone = progress >= 100;
    const pctClass = isDone ? 'done' : '';
    const pctText = isDone ? '✓' : `${progress}%`;
    const pctBg = isDone ? 'var(--mint)' : `conic-gradient(var(--violet) ${progress * 3.6}deg, transparent 0)`;

    let detail = '';
    if (t.type === 'vocab_review') detail = `Review ${t.count} flashcards`;
    else if (t.type === 'grammar') detail = t.topic;
    else if (t.type === 'reading') detail = `${t.level} level article`;
    else if (t.type === 'end_of_day_test') detail = t.topic || 'Daily assessment';
    else detail = t.type.replace('_',' ');

    return `
    <div class="task-item" data-mod="${mod}">
      <div class="task-check ${pctClass}">${isDone ? '✓' : ''}</div>
      <div class="task-info">
        <div class="task-type">${typeIcons[t.type] || '•'} ${typeLabels[t.type] || t.type.replace('_',' ')}</div>
        <div class="task-detail">${esc(detail)}</div>
      </div>
      <div class="task-meta">
        <div class="task-pct ${pctClass}" style="background:${pctBg}; color:${isDone?'var(--mint)':'var(--ink)'}">${pctText}</div>
        <div class="text-xs text-muted">${t.duration_min} min</div>
      </div>
    </div>`;
  }).join('') + `</div>`;

  el.querySelectorAll('.task-item').forEach(row =>
    row.addEventListener('click', () => go(row.dataset.mod))
  );
}

function buildWeekTracker(el, logs, goal) {
  const days = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  const today = new Date();
  const week = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = (logs || []).filter(l => l.date && l.date.startsWith(dateStr));
    const minutes = dayLogs.reduce((sum, l) => sum + (l.active_minutes || 0), 0);
    const pct = Math.min(100, Math.round((minutes / goal) * 100));
    const isToday = i === 0;
    const dayName = days[(d.getDay() + 6) % 7];
    week.push({ day: dayName, pct, isToday, filled: pct >= 100 });
  }

  el.innerHTML = week.map(d => `
    <div class="day-pill">
      <div class="day-ring ${d.isToday ? 'today' : ''} ${d.filled ? 'filled' : ''}" style="--pct: ${d.pct}">
        <div class="day-ring-inner">${d.isToday ? '★' : d.day}</div>
      </div>
      <div class="day-label">${d.isToday ? 'Today' : d.day}</div>
    </div>
  `).join('');
}

function buildUnlocks(el, profile, vocab) {
  const streak = profile?.streak || 0;
  const words = vocab?.length || 0;
  const unlocks = [
    { icon: '🌅', name: 'Frühaufsteher', locked: streak < 7 },
    { icon: '🔥', name: '30-Day Flame', locked: streak < 30 },
    { icon: '📚', name: 'Wortschatz', locked: words < 50 },
    { icon: '💎', name: 'Perfekt', locked: words < 100 },
    { icon: '🦉', name: 'Philosoph', locked: streak < 14 },
    { icon: '🏃', name: 'Marathon', locked: streak < 50 },
  ];
  el.innerHTML = unlocks.map(u => `
    <div class="unlock-item ${u.locked ? 'locked' : ''}" title="${u.name}">
      <div class="unlock-icon">${u.icon}</div>
      <div style="font-size:10px;">${u.name}</div>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════
// MODULE: VOCABULARY
// ══════════════════════════════════════════════
async function renderVocabulary(c) {
  c.innerHTML = `
    <h2 class="module-title">Vocabulary</h2>
    <p class="module-sub">Spaced repetition flashcard system</p>
    <div class="vocab-layout" id="vocab-layout">
      ${spin('Loading decks…')}
    </div>
  `;

  try {
    S.vocab = await api('GET','/vocab');
    renderVocabLayout($('vocab-layout'));
  } catch(e) {
    $('vocab-layout').innerHTML = errBox(e.message);
  }
}

function buildDecks(vocab) {
  const levels = ['A1','A2','B1','B2'];
  const icons = ['☕','🏙️','💭','💼','🧳'];
  const names = ['Café & Food','Around the city','Feelings & opinions','Work & study','Travel'];
  
  return levels.map((lv, i) => {
    const words = vocab.filter(w => w.level === lv);
    const mastered = words.filter(w => (w.interval_days || 0) >= 7).length;
    const mastery = words.length ? Math.round((mastered / words.length) * 100) : 0;
    return {
      id: lv,
      name: names[i] || lv,
      icon: icons[i] || '📚',
      count: words.length,
      mastery
    };
  }).filter(d => d.count > 0);
}

function renderVocabLayout(el) {
  const t = today();
  const due = S.vocab.filter(w => !w.next_review || w.next_review <= t);
  const decks = buildDecks(S.vocab);

  el.innerHTML = `
    <div class="deck-panel">
      <div class="section-label" style="margin-top:0">Decks</div>
      <div class="deck-list">
        <div class="deck-item active" data-deck="due" onclick="showDeck('due')">
          <div class="deck-icon">🔥</div>
          <div class="deck-info">
            <div class="deck-name">Due today</div>
            <div class="deck-meta">${due.length} cards</div>
          </div>
          <div class="deck-arrow">→</div>
        </div>
        ${decks.map(d => `
          <div class="deck-item" data-deck="${esc(d.id)}" onclick="showDeck('${esc(d.id)}')">
            <div class="deck-icon">${d.icon}</div>
            <div class="deck-info">
              <div class="deck-name">${esc(d.name)}</div>
              <div class="deck-meta">${d.count} cards • ${d.mastery}% mastery</div>
            </div>
            <div class="deck-arrow">→</div>
          </div>
        `).join('')}
      </div>
      <div class="session-stats">
        <div class="section-label" style="margin-top:0">Today's Session</div>
        <div class="stat-row"><span class="stat-label">Reviewed</span><span class="stat-val" id="s-reviewed">0</span></div>
        <div class="stat-row"><span class="stat-label">Got it</span><span class="stat-val" style="color:var(--mint)" id="s-got">0</span></div>
        <div class="stat-row"><span class="stat-label">Stumbled</span><span class="stat-val" style="color:var(--butter)" id="s-stumbled">0</span></div>
        <div class="stat-row"><span class="stat-label">Forgot</span><span class="stat-val" style="color:var(--rose)" id="s-forgot">0</span></div>
      </div>
    </div>
    <div class="review-area" id="review-area"></div>
  `;

  showDeck('due');
}

function showDeck(deckId) {
  const t = today();
  let queue = [];
  if (deckId === 'due') {
    queue = S.vocab.filter(w => !w.next_review || w.next_review <= t);
  } else {
    queue = S.vocab.filter(w => w.level === deckId);
  }

  document.querySelectorAll('.deck-item').forEach(el => {
    el.classList.toggle('active', el.dataset.deck === deckId);
  });

  S.queue = queue;
  S.qIdx = 0;
  S.qReviewed = 0;
  S.sessionStats = { got: 0, stumbled: 0, forgot: 0 };

  renderReviewCard($('review-area'));
}

function renderReviewCard(el) {
  if (S.qIdx >= S.queue.length) {
    el.innerHTML = `
      <div class="review-card">
        <div class="serif" style="font-size:1.6rem;margin-bottom:8px;">Session complete! 🎉</div>
        <div class="text-muted text-sm">Reviewed ${S.qReviewed} cards.</div>
        <button class="btn btn-primary mt-20" onclick="go('dashboard')">Back to Dashboard</button>
      </div>`;
    return;
  }

  const w = S.queue[S.qIdx];
  const sen = (w.sentences && w.sentences[0]) || '';
  const re = new RegExp(`(${w.word})`, 'gi');
  const front = sen
    ? sen.replace(re, '<span style="color:var(--violet);border-bottom:2px dashed var(--violet);">___</span>')
    : `<span class="text-muted">Tap show answer to reveal</span>`;

  el.innerHTML = `
    <div class="review-card" id="review-card">
      <div class="review-tag">${w.level || 'A2'}</div>
      <button class="review-speak btn btn-ghost" style="padding:6px 8px;font-size:16px;" onclick="speakGerman('${esc(w.word)}')">🔊</button>
      
      <div id="card-front">
        <div class="review-word">${esc(w.word)}</div>
        ${w.ipa ? `<div class="review-ipa">/ ${esc(w.ipa)} /</div>` : ''}
        <div class="review-sentence">${front}</div>
        <button class="btn btn-primary mt-24" style="min-width:160px;" onclick="flipReview()">Show answer</button>
      </div>
      
      <div id="card-back" style="display:none;">
        <div class="card-pos">${esc(w.part_of_speech||'')}</div>
        <div class="review-word" style="color:var(--violet);">${esc(w.word)}</div>
        <div class="review-translation">${esc(w.translation||'')}</div>
        <div class="review-sentence text-muted mt-12">${esc(sen)}</div>
        <div class="rate-grid">
          <button class="rate-btn r-again" onclick="rateCard(0)">Again</button>
          <button class="rate-btn r-hard" onclick="rateCard(3)">Hard</button>
          <button class="rate-btn r-good" onclick="rateCard(4)">Good</button>
          <button class="rate-btn r-easy" onclick="rateCard(5)">Easy</button>
        </div>
      </div>
    </div>
    
    <div class="flex between items-center" style="padding:0 8px;">
      <span class="text-xs text-muted">Card ${S.qIdx + 1} of ${S.queue.length}</span>
      <span class="text-xs text-muted">Space to flip</span>
    </div>
  `;
}

function flipReview() {
  const front = document.getElementById('card-front');
  const back = document.getElementById('card-back');
  if (front) front.style.display = 'none';
  if (back) back.style.display = 'block';
}

document.addEventListener('keydown', e => {
  if (S.module !== 'vocabulary') return;
  if (e.code === 'Space') {
    const back = document.getElementById('card-back');
    if (back && back.style.display === 'none') {
      e.preventDefault();
      flipReview();
    }
  }
});

async function rateCard(q) {
  const w = S.queue[S.qIdx];
  if (!S.sessionStats) S.sessionStats = { got: 0, stumbled: 0, forgot: 0 };
  if (q <= 1) S.sessionStats.forgot++;
  else if (q === 3) S.sessionStats.stumbled++;
  else S.sessionStats.got++;

  const gotEl = document.getElementById('s-got');
  const stEl = document.getElementById('s-stumbled');
  const foEl = document.getElementById('s-forgot');
  const revEl = document.getElementById('s-reviewed');
  if (gotEl) gotEl.textContent = S.sessionStats.got;
  if (stEl) stEl.textContent = S.sessionStats.stumbled;
  if (foEl) foEl.textContent = S.sessionStats.forgot;
  if (revEl) revEl.textContent = S.qIdx + 1;

  await api('POST','/vocab/review',{word:w.word, quality:q}).catch(()=>{});
  S.qIdx++; S.qReviewed++;
  renderReviewCard($('review-area'));
}

// ══════════════════════════════════════════════
// MODULE: GRAMMAR (preserved)
// ══════════════════════════════════════════════
async function renderGrammar(c) {
  c.innerHTML = `
    <h2 class="module-title">Grammar</h2>
    <p class="module-sub">CEFR-structured grammar topics with practice exercises</p>
    <div id="gram-body">${spin('Loading syllabus…')}</div>
  `;

  try {
    const [syl, prof] = await Promise.all([
      api('GET','/syllabus'),
      api('GET','/profile'),
    ]);
    S.syllabus = syl; S.profile = prof;
    showTopicList($('gram-body'), syl, prof.level);
  } catch(e) {
    $('gram-body').innerHTML = errBox(e.message);
  }
}

function showTopicList(el, syl, curLevel) {
  const levels = ['A1','A2','B1'];
  let html = '';
  levels.forEach(lv => {
    const topics = syl.filter(t => t.level === lv);
    if (!topics.length) return;
    html += `
      <div style="margin-bottom:22px;">
        <div class="flex items-center gap-12 mb-12">
          <span class="text-xs uppercase" style="color:${lv===curLevel?'var(--violet)':'var(--ink-mute)'}">CEFR ${lv}</span>
          ${lv===curLevel?`<span style="font-size:0.6rem;border:1px solid var(--violet);color:var(--violet);padding:1px 7px;letter-spacing:0.1em;">YOUR LEVEL</span>`:''}
        </div>
        ${topics.map(t => `
          <div class="topic-item" data-topic="${esc(t.topic)}" data-level="${t.level}">
            <div>
              <div class="topic-name">${esc(t.topic)}</div>
              <div class="topic-desc">${esc(t.description)}</div>
            </div>
            <span class="topic-arrow">→</span>
          </div>`).join('')}
      </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.topic-item').forEach(item =>
    item.addEventListener('click', () => openTopic(el, item.dataset.topic, item.dataset.level))
  );
}

async function openTopic(el, topic, level) {
  el.innerHTML = `
    <div class="back-link" id="gram-back">← Back to Topics</div>
    <div class="flex between items-center mb-16">
      <div>
        <h3 class="serif" style="font-size:1.5rem;margin-bottom:3px;">${esc(topic)}</h3>
        <p class="text-xs text-muted uppercase">CEFR ${level}</p>
      </div>
    </div>
    <div id="topic-body">${spin('Generating explanation & fetching resources…')}</div>
  `;
  $('gram-back').addEventListener('click', () => showTopicList(el, S.syllabus, level));

  try {
    const [data, resources] = await Promise.all([
      api('POST','/explain-grammar',{topic, level}),
      api('GET', `/resources?topic=${encodeURIComponent(topic)}`)
    ]);
    S.grammarData = data;
    showExplanation($('topic-body'), data, resources);
  } catch(e) {
    $('topic-body').innerHTML = errBox(e.message);
  }
}

function showExplanation(el, data, resources) {
  const exs = data.exercises || [];
  const exHTML = exs.map((ex, i) => `
    <div class="exercise-item" id="ex${i}">
      <div class="exercise-sentence">${esc(ex.sentence||'')}</div>
      ${ex.hint ? `<div class="text-xs text-muted mb-8">Hint: ${esc(ex.hint)}</div>` : ''}
      <div class="exercise-row">
        <input type="text" id="ei${i}" placeholder="Answer…" data-ans="${esc(ex.answer||'')}">
        <button class="btn btn-sm" onclick="checkEx(${i})">Check</button>
      </div>
      <div id="er${i}"></div>
    </div>`).join('');

  let resourcesHTML = '';
  if (resources && resources.length > 0) {
    resourcesHTML = `
      <div class="section-label mb-8 mt-24 text-amber">Curated Video Resources</div>
      <div class="flex gap-12 flex-wrap mb-24">
        ${resources.map(r => `
          <div class="card" style="flex:1; min-width: 250px; padding: 12px;">
            <div class="text-xs uppercase text-muted mb-8">${esc(r.channel)}</div>
            <iframe width="100%" height="180" src="${r.url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius: 4px; border: 1px solid var(--border);"></iframe>
            <div class="text-sm mt-8">${esc(r.title)}</div>
          </div>
        `).join('')}
      </div>
      <hr class="divider">
    `;
  }

  el.innerHTML = `
    <div class="explanation-box">${esc(data.explanation||'')}</div>
    ${resourcesHTML}
    ${data.examples && data.examples.length ? `
      <div class="section-label mb-8">Examples</div>
      ${data.examples.map(e => `
        <div class="example-line flex between items-center">
          <span>${esc(e)}</span>
          <button class="btn btn-ghost" style="padding:2px; opacity: 0.5;" onclick="speakGerman('${esc(e)}')">🔊</button>
        </div>`).join('')}
      <hr class="divider">
    ` : ''}
    <div class="section-label mb-8">Practice Exercises</div>
    ${exHTML || '<p class="text-muted text-sm">No exercises available.</p>'}
  `;
}

function checkEx(i) {
  const inp = $(`ei${i}`);
  const res = $(`er${i}`);
  const user = inp.value.trim().toLowerCase();
  const ans = inp.dataset.ans.toLowerCase();
  res.innerHTML = user === ans
    ? `<div class="result-correct">Correct ✓</div>`
    : `<div class="result-wrong">Incorrect — correct answer: <strong>${esc(inp.dataset.ans)}</strong></div>`;
}

// ══════════════════════════════════════════════
// MODULE: READING (preserved)
// ══════════════════════════════════════════════
async function renderReading(c) {
  if (!S.profile) S.profile = await api('GET','/profile').catch(()=>({level:'A2'}));

  c.innerHTML = `
    <h2 class="module-title">Reading</h2>
    <p class="module-sub">AI-generated articles — click any word for instant translation</p>
    <div class="card mb-16">
      <div class="section-label">Generate Article</div>
      <div class="flex gap-8">
        <input type="text" id="topic-inp" placeholder="e.g. hiking the Alps, Berlin street food…">
        <button class="btn btn-primary" id="gen-btn" onclick="doGenReading()">Generate</button>
      </div>
    </div>
    <div id="read-body"></div>
  `;
  $('topic-inp').addEventListener('keydown', e => { if(e.key==='Enter') doGenReading(); });
}

async function doGenReading() {
  const inp = $('topic-inp');
  const topic = inp.value.trim();
  if (!topic) return;
  const body = $('read-body');
  const btn = $('gen-btn');
  body.innerHTML = spin('Generating article…');
  btn.disabled = true;

  try {
    const level = S.profile?.level || 'A2';
    const data = await api('POST','/generate-reading',{topic, level});
    S.article = data;
    showArticle(body, data);
  } catch(e) {
    body.innerHTML = errBox(e.message);
  } finally {
    btn.disabled = false;
  }
}

function showArticle(el, data) {
  const artHtml = wrapWords(data.article || '');
  const qHtml = (data.questions||[]).map((q,i) => `
    <div class="question-item">
      <div class="q-text">${i+1}. ${esc(q.q)}</div>
      <div class="reveal-btn" onclick="toggleA(${i})">Show answer ▾</div>
      <div class="a-text" id="qa${i}" style="display:none;">${esc(q.a)}</div>
    </div>`).join('');

  el.innerHTML = `
    <div class="card">
      <div class="section-label">Article</div>
      <div class="article-body" id="art-txt">${artHtml}</div>
    </div>
    <div class="card mt-12">
      <div class="section-label">Comprehension Questions</div>
      ${qHtml || '<p class="text-muted text-sm">No questions available.</p>'}
    </div>`;
}

function wrapWords(text) {
  const paras = text.split(/\n+/).filter(p => p.trim());
  return paras.map(p => {
    const wrapped = p.replace(/([a-zA-ZäöüÄÖÜß\-]+)/g, (m) =>
      `<span class="w" onclick="lookupWord('${m.replace(/'/g,"\\'")}',event)">${m}</span>`
    );
    return `<p>${wrapped}</p>`;
  }).join('');
}

function toggleA(i) { const a = $(`qa${i}`); a.style.display = a.style.display==='none'?'block':'none'; }

let ttWord = '';
async function lookupWord(word, event) {
  event.stopPropagation();
  const tt = $('word-tooltip');
  const x = Math.min(event.clientX, window.innerWidth - 290);
  const y = Math.min(event.clientY + 12, window.innerHeight - 150);
  tt.style.left = x + 'px';
  tt.style.top = y + 'px';
  tt.style.display = 'block';
  $('tt-word').textContent = word;
  $('tt-pos').textContent = '';
  $('tt-trans').textContent = '';
  $('tt-add-btn').textContent = 'Looking up…';
  $('tt-add-btn').disabled = true;
  ttWord = word;

  try {
    const d = await api('POST','/translate-word',{word, level:S.profile?.level||'A2'});
    $('tt-word').textContent = d.word || word;
    $('tt-pos').textContent = d.part_of_speech || '';
    $('tt-trans').textContent = d.translation || '';
    $('tt-add-btn').textContent = '+ Add to Deck';
    $('tt-add-btn').disabled = false;
  } catch(e) {
    $('tt-trans').textContent = e.message;
    $('tt-add-btn').style.display = 'none';
  }
}

document.addEventListener('click', e => {
  const tt = $('word-tooltip');
  if (!tt.contains(e.target)) tt.style.display = 'none';
});

$('tt-add-btn').addEventListener('click', async () => {
  $('tt-add-btn').textContent = 'Adding…';
  $('tt-add-btn').disabled = true;
  try {
    await api('POST','/vocab/add',{word:ttWord, level:S.profile?.level||'A2'});
    $('tt-add-btn').textContent = 'Added ✓';
  } catch(e) {
    $('tt-add-btn').textContent = 'Error';
  }
});

// ══════════════════════════════════════════════
// MODULE: ROLEPLAY (preserved)
// ══════════════════════════════════════════════
const SCENARIOS = [
  { level:'A1', icon:'🥖', title:'Buying Bread', desc:'At a German bakery, ordering Brötchen and Brot.', sys:'You are a friendly German bakery employee.' },
  { level:'A1', icon:'☕', title:'Ordering Coffee', desc:'At a café, ordering coffee and a snack.', sys:'You are a German café waiter.' },
  { level:'A2', icon:'🚂', title:'Buying Train Tickets', desc:'At Munich Hauptbahnhof, purchasing a ticket.', sys:'You are a German train station employee.' },
  { level:'A2', icon:'🏥', title:'At the Doctor', desc:'Explaining symptoms to a German doctor.', sys:'You are a German general practitioner.' },
  { level:'B1', icon:'🏠', title:'Arguing with Landlord', desc:'Discussing a repair issue with your Vermieter.', sys:'You are a German landlord.' },
  { level:'B1', icon:'💼', title:'Job Interview', desc:'Interviewing for a position at a German company.', sys:'You are a German HR manager.' },
];

const OPENINGS = {
  'Buying Bread': 'Guten Morgen! Was darf es sein?',
  'Ordering Coffee': 'Willkommen! Was möchten Sie trinken?',
  'Buying Train Tickets': 'Guten Tag! Wohin möchten Sie fahren?',
  'At the Doctor': 'Guten Tag, bitte setzen Sie sich. Was fehlt Ihnen?',
  'Arguing with Landlord': 'Hallo. Was gibt es?',
  'Job Interview': 'Guten Morgen, nehmen Sie bitte Platz. Erzählen Sie mir etwas über sich.',
};

function renderRoleplay(c) {
  S.history = []; S.scenario = null;

  c.innerHTML = `
    <h2 class="module-title">Roleplay</h2>
    <p class="module-sub">Immersive conversation practice with AI characters</p>
    <div id="rp-body">
      <div class="scenario-grid">
        ${SCENARIOS.map((s,i) => `
          <div class="scenario-card" data-i="${i}">
            <div class="sc-level">${s.level}</div>
            <div class="sc-title">${s.icon || '💬'} ${esc(s.title)}</div>
            <div class="sc-desc">${esc(s.desc)}</div>
            <div class="scenario-play">▶ Start Conversation</div>
          </div>`).join('')}
      </div>
    </div>`;

  c.querySelectorAll('.scenario-card').forEach(card =>
    card.addEventListener('click', () => openScenario($('rp-body'), SCENARIOS[+card.dataset.i]))
  );
}

function openScenario(el, sc) {
  S.scenario = sc;
  S.history = [];
  const opening = OPENINGS[sc.title] || 'Guten Tag!';
  S.history.push({ role:'assistant', content: opening });

  el.innerHTML = `
    <div class="back-link" id="rp-back">← Back to Scenarios</div>
    <div class="flex between items-center mb-16">
      <div>
        <div class="sc-level">${sc.level}</div>
        <div class="serif" style="font-size:1.4rem;font-weight:700;">${esc(sc.title)}</div>
      </div>
      <button class="btn" onclick="endConvo()">End Conversation</button>
    </div>
    <div class="chat-wrap">
      <div class="chat-msgs" id="chat-msgs">
        <div class="msg assistant">${esc(opening)}</div>
      </div>
      <div class="chat-bar">
        <input type="text" id="chat-inp" placeholder="Schreib auf Deutsch…" autocomplete="off">
        <button class="btn btn-primary" onclick="sendMsg()">Send</button>
      </div>
    </div>`;

  $('rp-back').addEventListener('click', () => renderRoleplay(document.querySelector('.module')));
  $('chat-inp').addEventListener('keydown', e => { if(e.key==='Enter') sendMsg(); });
}

async function sendMsg() {
  const inp = $('chat-inp');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';

  const msgs = $('chat-msgs');
  S.history.push({ role:'user', content: text });

  const uEl = document.createElement('div');
  uEl.className = 'msg user';
  uEl.textContent = text;
  msgs.appendChild(uEl);

  const tyEl = document.createElement('div');
  tyEl.className = 'typing';
  tyEl.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  msgs.appendChild(tyEl);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const d = await api('POST','/chat-scenario',{
      scenario: S.scenario.title,
      level: S.scenario.level,
      history: S.history,
    });
    tyEl.remove();
    S.history.push({ role:'assistant', content: d.reply });
    const aEl = document.createElement('div');
    aEl.className = 'msg assistant';
    aEl.textContent = d.reply;
    msgs.appendChild(aEl);
    msgs.scrollTop = msgs.scrollHeight;
  } catch(e) {
    tyEl.remove();
    const errEl = document.createElement('div');
    errEl.innerHTML = errBox(e.message);
    msgs.appendChild(errEl);
  }
}

async function endConvo() {
  if (S.history.length < 2) { alert('Have a short conversation first!'); return; }

  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="modal">
      <div class="modal-title">Conversation Review</div>
      <div id="rev-body">${spin('Analysing your conversation…')}</div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });

  try {
    const level = S.scenario?.level || S.profile?.level || 'A2';
    const d = await api('POST','/end-chat-review',{ transcript:S.history, level });
    const mistakes = (d.mistakes||[]).map(m => `
      <div class="mistake-item">
        <div class="mistake-orig">✗ ${esc(m.original)}</div>
        <div class="mistake-fix">✓ ${esc(m.correction)}</div>
        <div class="mistake-why">${esc(m.explanation)}</div>
      </div>`).join('');

    $('rev-body').innerHTML = `
      <div class="score-big">${d.score}<span class="score-denom">/10</span></div>
      <div class="score-summary">${esc(d.summary||'')}</div>
      <div class="section-label">Mistakes &amp; Corrections</div>
      ${mistakes || '<p class="text-muted text-sm">No major mistakes found!</p>'}
      <button class="btn btn-primary full-w mt-24" onclick="this.closest('.overlay').remove()">Close</button>`;
  } catch(e) {
    $('rev-body').innerHTML = errBox(e.message) + `<button class="btn mt-12" onclick="this.closest('.overlay').remove()">Close</button>`;
  }
}

// ══════════════════════════════════════════════
// MODULE: SETTINGS (preserved)
// ══════════════════════════════════════════════
async function renderSettings(c) {
  c.innerHTML = `
    <h2 class="module-title">Settings</h2>
    <p class="module-sub">Configure your learning preferences</p>
    <div id="set-body">${spin()}</div>`;

  let profile = { name:'', level:'A2', daily_time_minutes:30 };
  try {
    profile = await api('GET','/profile');
    S.profile = profile;
  } catch(e) {}

  const isDark = document.documentElement.dataset.theme === 'dark';

  $('set-body').innerHTML = `
    <div class="card">
      <div class="setting-group">
        <label class="setting-label">Appearance</label>
        <div class="appearance-btns">
          <button class="btn ${!isDark ? 'btn-primary' : ''}" onclick="setTheme('light')">☀️ &nbsp;Light Mode</button>
          <button class="btn ${isDark  ? 'btn-primary' : ''}" onclick="setTheme('dark')">🌙 &nbsp;Dark Mode</button>
        </div>
      </div>
      <hr class="divider">
      <div class="setting-group">
        <label class="setting-label">Google Gemini API Key</label>
        <div class="flex gap-8">
          <input type="password" id="s-key" value="${esc(S.apiKey)}" placeholder="AIzaSy...">
          <button class="btn" onclick="testKey()">Test</button>
        </div>
        <div id="key-status"></div>
      </div>
      <hr class="divider">
      <div class="setting-group">
        <label class="setting-label">Your Name</label>
        <input type="text" id="s-name" value="${esc(profile.name||'')}">
      </div>
      <div class="setting-group">
        <label class="setting-label">CEFR Level</label>
        <select id="s-level">
          ${['A1','A2','B1','B2'].map(l =>
            `<option value="${l}" ${profile.level===l?'selected':''}>${l} — ${
              {A1:'Beginner',A2:'Elementary',B1:'Intermediate',B2:'Upper Intermediate'}[l]
            }</option>`
          ).join('')}
        </select>
      </div>
      <div class="setting-group">
        <label class="setting-label">Daily Time Goal</label>
        <div class="range-row">
          <input type="range" id="s-time" min="15" max="60" step="15" value="${profile.daily_time_minutes||30}"
            oninput="$('time-val').textContent=this.value+' min'">
          <span class="range-val" id="time-val">${profile.daily_time_minutes||30} min</span>
        </div>
      </div>
      <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
      <div id="save-status"></div>
    </div>`;

  if (!S.apiKey) {
    $('key-status').innerHTML = infoBox('Enter your Google Gemini API key to enable all features.');
  }
}

async function testKey() {
  const key = $('s-key').value.trim();
  const st = $('key-status');
  if (!key) { st.innerHTML = errBox('Enter an API key first.'); return; }
  st.innerHTML = spin('Testing…');
  S.apiKey = key;
  localStorage.setItem('fluency_api_key', key);
  try {
    await api('POST','/generate-vocab-context',{word:'Hallo',level:'A1'});
    st.innerHTML = okBox('API key is valid!');
  } catch(e) {
    st.innerHTML = errBox('Invalid key or backend error: ' + e.message);
  }
}

async function saveSettings() {
  const key = $('s-key').value.trim();
  if (key) { S.apiKey = key; localStorage.setItem('fluency_api_key', key); }
  const st = $('save-status');
  st.innerHTML = spin('Saving…');
  try {
    const p = await api('POST','/profile/update',{
      name: $('s-name').value || undefined,
      level: $('s-level').value || undefined,
      daily_time_minutes: parseInt($('s-time').value) || undefined,
    });
    S.profile = p;
    $('sidebar-level').textContent = p.level;
    st.innerHTML = okBox('Settings saved!');
  } catch(e) {
    st.innerHTML = errBox(e.message);
  }
}

// ══════════════════════════════════════════════
// MODULE: ONBOARDING
// ══════════════════════════════════════════════
async function renderOnboarding(c) {
  await startOnboarding();
}

// ══════════════════════════════════════════════
// MODULES MAP & INIT
// ══════════════════════════════════════════════
const MODULES = {
  dashboard: renderDashboard,
  onboarding: renderOnboarding,
  vocabulary: renderVocabulary,
  grammar: renderGrammar,
  reading: renderReading,
  roleplay: renderRoleplay,
  settings: renderSettings,
};

async function bootApp() {
  initTheme();
  try {
    S.profile = await api('GET', '/profile');
    if (!S.profile || !S.profile.onboarded) {
      renderOnboarding();
    } else {
      updateSidebarProfile(S.profile);
      go('dashboard');
    }
  } catch(e) {
    renderOnboarding();
  }
}

bootApp();