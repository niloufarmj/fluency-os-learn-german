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
function errBox(msg)  { return `<div class="msg-box msg-error">${esc(msg)}</div>`; }
function okBox(msg)   { return `<div class="msg-box msg-success">${esc(msg)}</div>`; }
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

// Native Text-to-Speech (Zero token cost)
function speakGerman(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel(); // Stop current speech
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'de-DE';
  msg.rate = 0.9; // Slightly slower for learning
  
  // Try to find a native Google/Apple German voice
  const voices = window.speechSynthesis.getVoices();
  const deVoice = voices.find(v => v.lang === 'de-DE' || v.lang === 'de_DE');
  if (deVoice) msg.voice = deVoice;
  
  window.speechSynthesis.speak(msg);
}

// Ensure voices are loaded (browser quirk)
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// ══════════════════════════════════════════════
// MODULE: DASHBOARD
// ══════════════════════════════════════════════
async function renderDashboard(c) {
  c.innerHTML = `
    <h2 class="module-title">Dashboard</h2>
    <p class="module-sub">Your daily German learning overview</p>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Current Level</div><div class="stat-value" id="st-lvl">—</div></div>
      <div class="stat-card"><div class="stat-label">Day Streak</div><div class="stat-value" id="st-streak">—</div></div>
      <div class="stat-card"><div class="stat-label">Words Mastered</div><div class="stat-value" id="st-words">—</div></div>
    </div>
    <div class="card">
      <div class="section-label">Today's Plan</div>
      <div id="plan-area">${spin('Generating plan…')}</div>
    </div>
    <div class="card mt-12">
      <div class="section-label">30-Day Activity</div>
      <div id="cal-area"></div>
    </div>
  `;

  try {
    const [plan, profile, vocab] = await Promise.all([
      api('GET','/daily-plan'),
      api('GET','/profile'),
      api('GET','/vocab'),
    ]);
    S.profile = profile; S.vocab = vocab;
    $('sidebar-level').textContent = profile.level;
    $('st-lvl').textContent    = profile.level;
    $('st-streak').textContent = profile.streak || 0;
    $('st-words').textContent  = vocab.filter(w => (w.interval_days||0) >= 21).length;

    buildPlan($('plan-area'), plan.tasks);
    buildCalendar($('cal-area'));
  } catch(e) {
    $('plan-area').innerHTML = errBox(e.message);
  }
}

function buildPlan(el, tasks) {
  const typeMap = { vocab_review:'vocabulary', grammar:'grammar', reading:'reading' };
  const detail = t => {
    if (t.type==='vocab_review') return `Review ${t.count} flashcards`;
    if (t.type==='grammar')      return t.topic;
    if (t.type==='reading')      return `${t.level} level article`;
    return '';
  };
  el.innerHTML = `<div class="task-list">` + tasks.map(t => `
    <div class="task-item" data-mod="${typeMap[t.type]||'dashboard'}">
      <input type="checkbox" onclick="event.stopPropagation()">
      <div class="task-info">
        <div class="task-type">${t.type.replace('_',' ')}</div>
        <div class="task-detail">${esc(detail(t))}</div>
      </div>
      <div class="task-duration">${t.duration_min} min</div>
    </div>
  `).join('') + `</div>`;
  el.querySelectorAll('.task-item').forEach(row =>
    row.addEventListener('click', () => go(row.dataset.mod))
  );
}

function buildCalendar(el) {
  const t = today();
  let html = '<div class="calendar-grid">';
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    let cls = 'cal-day';
    if (ds === t) cls += ' today';
    else if (i < 7 && Math.random() > 0.45) cls += ' met';
    html += `<div class="${cls}" title="${ds}"></div>`;
  }
  el.innerHTML = html + '</div>';
}

// ══════════════════════════════════════════════
// MODULE: VOCABULARY
// ══════════════════════════════════════════════
async function renderVocabulary(c) {
  c.innerHTML = `
    <h2 class="module-title">Vocabulary</h2>
    <p class="module-sub">Spaced repetition flashcard system</p>
    <div class="tabs">
      <div class="tab active" data-t="review">Review Due</div>
      <div class="tab" data-t="add">Add Word</div>
      <div class="tab" data-t="all">All Words</div>
    </div>
    <div id="vtab"></div>
  `;

  c.querySelectorAll('.tab').forEach(tb => tb.addEventListener('click', () => {
    c.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    tb.classList.add('active');
    showVTab($('vtab'), tb.dataset.t);
  }));

  try {
    S.vocab = await api('GET','/vocab');
    showVTab($('vtab'), 'review');
  } catch(e) {
    $('vtab').innerHTML = errBox(e.message);
  }
}

function showVTab(el, tab) {
  if (tab==='review') vReview(el);
  else if (tab==='add') vAdd(el);
  else vAll(el);
}

function vReview(el) {
  const t = today();
  S.queue    = S.vocab.filter(w => !w.next_review || w.next_review <= t);
  S.qIdx     = 0;
  S.qReviewed= 0;

  if (!S.queue.length) {
    el.innerHTML = `
      <div class="card text-center" style="padding:52px;">
        <div class="serif" style="font-size:1.5rem;margin-bottom:8px;">All caught up!</div>
        <div class="text-muted text-sm">No words due today. Add words to grow your deck.</div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="flex between items-center mb-8">
      <span class="text-muted text-xs" id="prog-txt">0 / ${S.queue.length} reviewed</span>
      <span class="text-muted text-xs">${S.queue.length} due today</span>
    </div>
    <div class="progress-bar mb-16"><div class="progress-fill" id="prog-bar" style="width:0%"></div></div>
    <div id="card-area"></div>
  `;
  drawCard($('card-area'));
}

function drawCard(el) {
  if (S.qIdx >= S.queue.length) {
    el.innerHTML = `
      <div class="card text-center" style="padding:52px;">
        <div class="serif" style="font-size:1.5rem;margin-bottom:8px;">Session complete</div>
        <div class="text-muted text-sm">Reviewed ${S.qReviewed} cards.</div>
      </div>`;
    return;
  }

  const w   = S.queue[S.qIdx];
  const sen = (w.sentences && w.sentences[0]) || '';
  const re  = new RegExp(`(${w.word})`, 'gi');
  const front = sen
    ? sen.replace(re, '<span class="card-blank">___</span>')
    : `<span class="text-muted">No example — reveal to see the word.</span>`;

  el.innerHTML = `
    <div class="flashcard">
      <div class="flashcard-inner" id="fc">
        <div class="flashcard-front">
          <div class="text-xs text-muted uppercase mb-8">${w.level}</div>
          <div class="card-sentence">${front}</div>
          <button class="btn btn-sm mt-20" onclick="flipCard()">Reveal Answer</button>
        </div>
        <div class="flashcard-back">
          <div class="card-pos">${esc(w.part_of_speech||'')}</div>
          <div class="flex items-center gap-8 justify-center mb-8">
            <div class="card-word" style="margin-bottom:0;">${esc(w.word)}</div>
            <button class="btn btn-ghost" style="padding:4px;" onclick="speakGerman('${esc(w.word)}')">🔊</button>
          </div>
          <div class="card-translation">${esc(w.translation||'')}</div>
          <div class="flex items-start justify-center gap-8 mt-16">
            <div class="card-sentence">${esc(sen)}</div>
            ${sen ? `<button class="btn btn-ghost" style="padding:2px;" onclick="speakGerman('${esc(sen)}')">🔊</button>` : ''}
          </div>
          <div class="quality-btns">
            <!-- Quality buttons remain the same -->
            <button class="q-btn q-blackout" onclick="rate(0)">0 — Blackout</button>
            <button class="q-btn" onclick="rate(3)">3 — Hard</button>
            <button class="q-btn q-good" onclick="rate(4)">4 — Good</button>
            <button class="q-btn q-easy" onclick="rate(5)">5 — Easy</button>
          </div>
        </div>
      </div>
    </div>`;
}

function flipCard() {
  $('fc') && $('fc').classList.add('flipped');
}

async function rate(q) {
  const w = S.queue[S.qIdx];
  await api('POST','/vocab/review',{word:w.word, quality:q}).catch(()=>{});
  S.qIdx++; S.qReviewed++;
  const pct = (S.qReviewed / S.queue.length) * 100;
  const pt  = $('prog-txt');
  const pb  = $('prog-bar');
  if (pt) pt.textContent = `${S.qReviewed} / ${S.queue.length} reviewed`;
  if (pb) pb.style.width = pct + '%';
  drawCard($('card-area'));
}

function vAdd(el) {
  el.innerHTML = `
    <div class="card">
      <div class="section-label">Add New Word</div>
      <div class="flex gap-8 mb-8">
        <input type="text" id="word-inp" placeholder="Enter a German word…">
        <button class="btn btn-primary" id="add-btn" onclick="doAddWord()">Add</button>
      </div>
      <div id="add-res"></div>
    </div>`;
  $('word-inp').addEventListener('keydown', e => { if(e.key==='Enter') doAddWord(); });
}

async function doAddWord() {
  const inp = $('word-inp');
  const w   = inp.value.trim();
  if (!w) return;
  const res = $('add-res');
  const btn = $('add-btn');
  res.innerHTML = spin('Generating examples…');
  btn.disabled  = true;

  try {
    if (!S.profile) S.profile = await api('GET','/profile');
    const entry = await api('POST','/vocab/add',{word:w, level:S.profile.level});
    let html = okBox(`Added "${entry.word}" to your deck`);
    if (entry.translation) {
      html += `<div class="text-sm mt-8"><span class="text-muted">Translation:</span> <strong>${esc(entry.translation)}</strong>`;
      if (entry.part_of_speech) html += ` <span class="text-muted">(${esc(entry.part_of_speech)})</span>`;
      html += '</div>';
    }
    if (entry.sentences && entry.sentences.length) {
      html += `<div class="section-label mt-16">Example Sentences</div>`;
      entry.sentences.forEach((s,i) =>
        html += `<div class="example-line">${i+1}. ${esc(s)}</div>`
      );
    }
    res.innerHTML = html;
    inp.value = '';
    S.vocab = await api('GET','/vocab');
  } catch(e) {
    res.innerHTML = errBox(e.message);
  } finally {
    btn.disabled = false;
  }
}

function vAll(el) {
  if (!S.vocab.length) {
    el.innerHTML = `<p class="text-muted text-sm">No words yet. Use "Add Word" to build your deck.</p>`;
    return;
  }
  const t = today();
  el.innerHTML = `<div class="vocab-list">` + S.vocab.map(w => {
    const due = w.next_review && w.next_review <= t;
    return `
      <div class="vocab-row">
        <span class="vocab-word">${esc(w.word)}</span>
        <span class="vocab-trans">${esc(w.translation||'')}</span>
        <span class="${due?'vocab-due text-amber':'text-muted'} text-xs">${due ? 'Due now' : 'Next: '+fmtDate(w.next_review)}</span>
        <span class="vocab-ef">EF ${w.ease_factor||2.5}</span>
      </div>`;
  }).join('') + `</div>`;
}

// ══════════════════════════════════════════════
// MODULE: GRAMMAR
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
          <span class="text-xs uppercase" style="color:${lv===curLevel?'var(--amber)':'var(--text-muted)'}">CEFR ${lv}</span>
          ${lv===curLevel?`<span style="font-size:0.6rem;border:1px solid var(--amber);color:var(--amber);padding:1px 7px;letter-spacing:0.1em;">YOUR LEVEL</span>`:''}
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
    item.addEventListener('click', () =>
      openTopic(el, item.dataset.topic, item.dataset.level)
    )
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
    // Fetch AI Explanation AND External Resources simultaneously
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

  // Generate External Resources HTML
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
  const inp  = $(`ei${i}`);
  const res  = $(`er${i}`);
  const user = inp.value.trim().toLowerCase();
  const ans  = inp.dataset.ans.toLowerCase();
  res.innerHTML = user === ans
    ? `<div class="result-correct">Correct ✓</div>`
    : `<div class="result-wrong">Incorrect — correct answer: <strong>${esc(inp.dataset.ans)}</strong></div>`;
}

// ══════════════════════════════════════════════
// MODULE: READING
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
  const inp   = $('topic-inp');
  const topic = inp.value.trim();
  if (!topic) return;
  const body  = $('read-body');
  const btn   = $('gen-btn');
  body.innerHTML = spin('Generating article…');
  btn.disabled   = true;

  try {
    const level = S.profile?.level || 'A2';
    const data  = await api('POST','/generate-reading',{topic, level});
    S.article   = data;
    showArticle(body, data);
  } catch(e) {
    body.innerHTML = errBox(e.message);
  } finally {
    btn.disabled = false;
  }
}

function showArticle(el, data) {
  const artHtml = wrapWords(data.article || '');
  const qHtml   = (data.questions||[]).map((q,i) => `
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

// Word tooltip
let ttWord = '';
async function lookupWord(word, event) {
  event.stopPropagation();
  const tt = $('word-tooltip');
  const x  = Math.min(event.clientX, window.innerWidth  - 270);
  const y  = Math.min(event.clientY + 12, window.innerHeight - 130);
  tt.style.left    = x + 'px';
  tt.style.top     = y + 'px';
  tt.style.display = 'block';
  $('tt-word').textContent  = word;
  $('tt-pos').textContent   = '';
  $('tt-trans').textContent = '';
  $('tt-add-btn').textContent = 'Looking up…';
  $('tt-add-btn').disabled  = true;
  ttWord = word;

  try {
    const d = await api('POST','/translate-word',{word, level:S.profile?.level||'A2'});
    $('tt-word').textContent  = d.word  || word;
    $('tt-pos').textContent   = d.part_of_speech || '';
    $('tt-trans').textContent = d.translation || '';
    $('tt-add-btn').textContent = '+ Add to Deck';
    $('tt-add-btn').disabled  = false;
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
// MODULE: ROLEPLAY
// ══════════════════════════════════════════════
const SCENARIOS = [
  { level:'A1', title:'Buying Bread',         desc:'At a German bakery, ordering Brötchen and Brot.',          sys:'You are a friendly German bakery employee. The customer wants to buy bread and rolls.' },
  { level:'A1', title:'Ordering Coffee',      desc:'At a café, ordering coffee and a snack.',                  sys:'You are a German café waiter. The customer is ordering coffee and food.' },
  { level:'A2', title:'Buying Train Tickets', desc:'At Munich Hauptbahnhof, purchasing a ticket.',             sys:'You are a German train station employee at Munich Hauptbahnhof. The user wants to buy a train ticket.' },
  { level:'A2', title:'At the Doctor',        desc:'Explaining symptoms to a German doctor.',                  sys:'You are a German general practitioner (Arzt). The patient is describing their symptoms.' },
  { level:'B1', title:'Arguing with Landlord',desc:'Discussing a repair issue with your Vermieter.',          sys:'You are a German landlord (Vermieter). The tenant has a complaint about something broken in the apartment.' },
  { level:'B1', title:'Job Interview',        desc:'Interviewing for a position at a German company.',        sys:'You are a German HR manager conducting a job interview at a mid-sized German company.' },
];

const OPENINGS = {
  'Buying Bread':          'Guten Morgen! Was darf es sein?',
  'Ordering Coffee':       'Willkommen! Was möchten Sie trinken?',
  'Buying Train Tickets':  'Guten Tag! Wohin möchten Sie fahren?',
  'At the Doctor':         'Guten Tag, bitte setzen Sie sich. Was fehlt Ihnen?',
  'Arguing with Landlord': 'Hallo. Was gibt es?',
  'Job Interview':         'Guten Morgen, nehmen Sie bitte Platz. Erzählen Sie mir etwas über sich.',
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
            <div class="sc-title">${esc(s.title)}</div>
            <div class="sc-desc">${esc(s.desc)}</div>
          </div>`).join('')}
      </div>
    </div>`;

  c.querySelectorAll('.scenario-card').forEach(card =>
    card.addEventListener('click', () => openScenario($('rp-body'), SCENARIOS[+card.dataset.i]))
  );
}

function openScenario(el, sc) {
  S.scenario = sc;
  S.history  = [];
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
  const inp  = $('chat-inp');
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
      level:    S.scenario.level,
      history:  S.history,
    });
    tyEl.remove();
    S.history.push({ role:'assistant', content: d.reply });
    const aEl = document.createElement('div');
    aEl.className   = 'msg assistant';
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
// MODULE: SETTINGS
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
  } catch(e) { /* show form anyway */ }

  $('set-body').innerHTML = `
    <div class="card">
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
  const st  = $('key-status');
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
      name:               $('s-name').value || undefined,
      level:              $('s-level').value || undefined,
      daily_time_minutes: parseInt($('s-time').value) || undefined,
    });
    S.profile = p;
    $('sidebar-level').textContent = p.level;
    st.innerHTML = okBox('Settings saved!');
  } catch(e) {
    st.innerHTML = errBox(e.message);
  }
}


async function renderOnboarding(c) {
  await startOnboarding();
}

// ══════════════════════════════════════════════
// MODULES MAP & INIT
// ══════════════════════════════════════════════
const MODULES = {
  dashboard:  renderDashboard,
  onboarding: renderOnboarding,
  vocabulary: renderVocabulary,
  grammar:    renderGrammar,
  reading:    renderReading,
  roleplay:   renderRoleplay,
  settings:   renderSettings,
};

async function bootApp() {
  try {
    S.profile = await api('GET', '/profile');
    
    // If no profile exists, or onboarding isn't finished
    if (!S.profile || !S.profile.onboarded) {
      renderOnboarding();
    } else {
      document.getElementById('sidebar-level').textContent = S.profile.level;
      go('dashboard');
    }
  } catch(e) {
    renderOnboarding();
  }
}

// Boot the app instead of forcing the dashboard
bootApp();
