// ══════════════════════════════════════════════
// ONBOARDING FLOW
// ══════════════════════════════════════════════

let obStep = 0;
let obData = {
  name: '', email: '', apiKey: '', dailyTime: 30,
  goal: '', levelChoice: '', cheerStyle: '',
  testHistory: [], testAnswers: []
};
let localTestQuestions = [];
let currentQuestionIndex = 0;
let speechRecognitionObj = null;

const OB_STEPS = [
  'welcome', 'info', 'goal', 'level', 'test', 'cheer', 'loading', 'result'
];

const GOAL_OPTIONS = [
  { id: 'travel', icon: '✈️', title: 'Travel & culture', desc: 'Order coffee, navigate cities, chat with locals' },
  { id: 'work', icon: '💼', title: 'Work in Germany', desc: 'Job interviews, meetings, professional emails' },
  { id: 'family', icon: '👨‍👩‍👧', title: 'Family & friends', desc: 'Connect with loved ones in German' },
  { id: 'study', icon: '🎓', title: 'Study at a German uni', desc: 'Pass TestDaF, write essays, follow lectures' },
];

const LEVEL_OPTIONS = [
  { id: 'beginner', icon: '🌱', title: 'I\'m a complete beginner', desc: 'Hallo? Was?' },
  { id: 'basics', icon: '📚', title: 'I know some basics', desc: 'I can introduce myself' },
  { id: 'intermediate', icon: '🚀', title: 'I\'m intermediate', desc: 'Conversations, with effort' },
  { id: 'test', icon: '🎯', title: 'Test me', desc: 'Place me with a 30-second quiz' },
];

const CHEER_OPTIONS = [
  { id: 'coach', icon: '🔥', title: 'Coach', quote: '"You\'re crushing it!"' },
  { id: 'calm', icon: '🧘', title: 'Calm', quote: '"Genau. Continue."' },
  { id: 'witty', icon: '🦉', title: 'Witty', quote: '"The Duden is impressed."' },
];

async function startOnboarding() {
  document.querySelector('.sidebar').style.display = 'none';
  const container = document.getElementById('main');
  container.style.marginLeft = '0';
  container.style.maxWidth = '100vw';
  container.style.padding = '0';
  
  obStep = 0;
  obData = {
    name: '', email: '', apiKey: S.apiKey || '', dailyTime: 30,
    goal: '', levelChoice: '', cheerStyle: '',
    testHistory: [], testAnswers: []
  };
  
  renderObStep();
}

function renderObStep() {
  const container = document.getElementById('main');
  const stepId = OB_STEPS[obStep];
  const totalSteps = 5;
  
  let html = `<div class="onboarding-wrap">`;
  
  if (stepId === 'welcome') {
    html += renderWelcome();
  } else if (stepId === 'info') {
    html += renderInfoForm(totalSteps, 1);
  } else if (stepId === 'goal') {
    html += renderGoalChoice(totalSteps, 2);
  } else if (stepId === 'level') {
    html += renderLevelChoice(totalSteps, 3);
  } else if (stepId === 'test') {
    html += renderTestQuestion();
    container.innerHTML = html + `</div>`;
    return;
  } else if (stepId === 'cheer') {
    html += renderCheerChoice(totalSteps, 5);
  } else if (stepId === 'loading') {
    html += renderLoading();
  } else if (stepId === 'result') {
    html += renderResult();
  }
  
  html += `</div>`;
  container.innerHTML = html;
}

function renderDots(current, total) {
  return `<div class="progress-dots">
    ${Array.from({length: total}, (_, i) => `
      <div class="dot-pill ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}"></div>
    `).join('')}
  </div>`;
}

function renderWelcome() {
  return `
    <div class="onboarding-card text-center">
      <div class="welcome-logo">🇩🇪</div>
      <div class="welcome-title">Lerne Deutsch in<br>10 Minuten am Tag.</div>
      <div class="welcome-sub">FluencyOS adapts to how you learn. Real conversations, real progress, real Spaß.</div>
      <button class="btn btn-primary welcome-btn" onclick="obNext()">Let's go →</button>
      <div class="login-hint">Already have an account? <a>Log in</a></div>
    </div>
  `;
}

function renderInfoForm(total, idx) {
  return `
    <div class="onboarding-card">
      ${renderDots(idx - 1, total)}
      <div class="ob-step-label">Step ${idx} of ${total}</div>
      <div class="ob-title">Let's get to know you</div>
      <div class="ob-sub">We'll personalize your German learning journey.</div>
      
      <div class="flex-col gap-12">
        <div>
          <label class="setting-label">What is your name?</label>
          <input type="text" id="ob-name" value="${esc(obData.name)}" placeholder="Max Mustermann">
        </div>
        <div>
          <label class="setting-label">Email (optional)</label>
          <input type="email" id="ob-email" value="${esc(obData.email)}" placeholder="max@example.com">
        </div>
        <div>
          <label class="setting-label">Daily learning time</label>
          <select id="ob-time">
            <option value="15" ${obData.dailyTime==15?'selected':''}>15 Minutes (Casual)</option>
            <option value="30" ${obData.dailyTime==30?'selected':''}>30 Minutes (Standard)</option>
            <option value="60" ${obData.dailyTime==60?'selected':''}>60 Minutes (Intensive)</option>
          </select>
        </div>
        <div>
          <label class="setting-label">Gemini API Key for Grading</label>
          <p class="text-xs text-muted mb-8 italic">Grading Speaking/Writing relies on LLM analysis. Enter your key now, or save it later in settings.</p>
          <input type="password" id="ob-key" value="${esc(obData.apiKey)}" placeholder="AIzaSy...">
        </div>
      </div>
      
      <div class="ob-nav mt-24">
        <button class="btn btn-ghost" onclick="obPrev()">Back</button>
        <button class="btn btn-primary" onclick="saveInfo()">Continue</button>
      </div>
    </div>
  `;
}

function renderGoalChoice(total, idx) {
  return `
    <div class="onboarding-card">
      ${renderDots(idx - 1, total)}
      <div class="ob-step-label">Step ${idx} of ${total}</div>
      <div class="ob-title">Why are you learning German?</div>
      <div class="ob-sub">We'll personalize your lessons.</div>
      
      <div class="option-grid">
        ${GOAL_OPTIONS.map(opt => `
          <div class="option-card ${obData.goal===opt.id?'selected':''}" onclick="selectGoal('${opt.id}')">
            <div class="option-icon">${opt.icon}</div>
            <div class="option-title">${esc(opt.title)}</div>
            <div class="option-desc">${esc(opt.desc)}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="ob-nav">
        <button class="btn btn-ghost" onclick="obPrev()">Back</button>
        <button class="btn btn-primary" onclick="obNext()" ${!obData.goal?'disabled':''}>Continue</button>
      </div>
    </div>
  `;
}

function renderLevelChoice(total, idx) {
  return `
    <div class="onboarding-card">
      ${renderDots(idx - 1, total)}
      <div class="ob-step-label">Step ${idx} of ${total}</div>
      <div class="ob-title">How much German do you already know?</div>
      <div class="ob-sub">No judgment — we'll meet you where you are.</div>
      
      <div class="option-grid">
        ${LEVEL_OPTIONS.map(opt => `
          <div class="option-card ${obData.levelChoice===opt.id?'selected':''}" onclick="selectLevel('${opt.id}')">
            <div class="option-icon">${opt.icon}</div>
            <div class="option-title">${esc(opt.title)}</div>
            <div class="option-desc">${esc(opt.desc)}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="ob-nav">
        <button class="btn btn-ghost" onclick="obPrev()">Back</button>
        <button class="btn btn-primary" onclick="startTest()" ${!obData.levelChoice?'disabled':''}>Continue</button>
      </div>
    </div>
  `;
}

async function startTest() {
  obStep = OB_STEPS.indexOf('test');
  const container = document.getElementById('main');
  container.innerHTML = `<div class="onboarding-wrap"><div class="onboarding-card">${spin('Loading placement test…')}</div></div>`;
  
  try {
    localTestQuestions = await api('GET', '/placement/get-test');
    currentQuestionIndex = 0;
    renderTestQuestion();
  } catch(e) {
    container.innerHTML = `<div class="onboarding-wrap"><div class="onboarding-card">${errBox(e.message)}</div></div>`;
  }
}

function renderTestQuestion() {
  if (currentQuestionIndex >= localTestQuestions.length) {
    obStep = OB_STEPS.indexOf('cheer');
    renderObStep();
    return;
  }

  const q = localTestQuestions[currentQuestionIndex];
  const container = document.getElementById('main');
  
  container.innerHTML = `
    <div class="onboarding-wrap">
      <div class="onboarding-card">
        ${renderDots(3, 5)}
        <div class="ob-step-label">Step 4 of 5 • Quick Placement</div>
        <div class="ob-title">Fill in the blank</div>
        <div class="ob-sub">Question ${currentQuestionIndex + 1} of ${localTestQuestions.length}</div>
        
        <div class="blank-box">
          <div class="blank-text">${formatQuestion(q)}</div>
        </div>
        
        ${getTestOptions(q)}
        
        <div class="ob-nav">
          <button class="btn btn-ghost" onclick="testBack()">Back</button>
          <button class="btn btn-ghost" onclick="skipTest()">Skip quiz →</button>
        </div>
      </div>
    </div>
  `;
}

function formatQuestion(q) {
  if (q.type === 'multiple_choice' || q.type === 'listening' || q.type === 'reading') {
    return esc(q.q).replace(/___/g, '<span class="blank-gap">___</span>');
  }
  if (q.type === 'writing_blank') {
    return esc(q.q).replace(/___/g, '<span class="blank-gap">___</span>');
  }
  if (q.type === 'speaking_blank') {
    return esc(q.q).replace(/___/g, '<span class="blank-gap">___</span>');
  }
  return esc(q.q);
}

function getTestOptions(q) {
  if (q.type === 'multiple_choice' || q.type === 'listening' || q.type === 'reading') {
    const labels = ['A','B','C','D'];
    return `<div class="answer-grid">
      ${q.options.map((opt, i) => `
        <button class="answer-btn" onclick="recordTestAnswer(${q.id}, ${i}, ${q.correct})">
          <span class="ans-letter">${labels[i]}</span>
          <span>${esc(opt)}</span>
        </button>
      `).join('')}
    </div>`;
  }
  if (q.type === 'writing_blank') {
    return `
      <input type="text" id="test-ans" class="mt-8" placeholder="Type your answer…" onkeydown="if(event.key==='Enter')recordBlankAnswer(${q.id})">
      <button class="btn btn-primary full-w mt-16" onclick="recordBlankAnswer(${q.id})">Submit</button>
    `;
  }
  if (q.type === 'speaking_blank') {
    return `
      <div class="card text-center mt-16" style="background:var(--bg-sunken);">
        <button class="btn btn-primary" id="mic-btn" onclick="toggleSpeaking()">
          <span id="mic-icon">🎤</span> <span id="mic-txt">Click to Speak</span>
        </button>
        <p id="mic-status" class="text-sm text-muted mt-8">Wait for prompt, then click to begin.</p>
      </div>
      <div id="stt-res" class="text-amber italic mt-16" style="display:none;"></div>
      <button class="btn btn-primary full-w mt-16" id="voice-submit" style="display:none;" onclick="recordSpeaking(${q.id})">Submit Answer</button>
    `;
  }
  if (q.type === 'writing_full' || q.type === 'speaking_full') {
    return `
      <textarea id="test-ans" class="mt-8" rows="4" placeholder="${q.type.startsWith('speaking') ? 'Speech will appear here…' : 'Schreib auf Deutsch…'}"></textarea>
      ${q.type.startsWith('speaking') ? `
        <button class="btn btn-primary mt-12" onclick="toggleSpeaking()">🎤 Record Speech</button>
      ` : ''}
      <button class="btn btn-primary full-w mt-16" onclick="recordFullAnswer(${q.id}, '${q.type}')">Submit</button>
    `;
  }
  return '';
}

function recordTestAnswer(qid, selected, correct) {
  const q = localTestQuestions.find(it => it.id === qid);
  obData.testHistory.push({
    questionId: q.id, level: q.level, type: q.type, category: q.category,
    q: q.q, correct_answer: correct, user_answer: selected
  });
  currentQuestionIndex++;
  renderTestQuestion();
}

function recordBlankAnswer(qid) {
  const inp = document.getElementById('test-ans');
  const text = inp?.value.trim();
  if (!text) return;
  const q = localTestQuestions.find(it => it.id === qid);
  obData.testHistory.push({
    questionId: q.id, level: q.level, type: q.type, category: q.category,
    q: q.q, correct_answer: q.answer, user_answer: text
  });
  currentQuestionIndex++;
  renderTestQuestion();
}

function recordFullAnswer(qid, type) {
  const text = document.getElementById('test-ans')?.value.trim();
  if (!text) return;
  const q = localTestQuestions.find(it => it.id === qid);
  obData.testHistory.push({
    questionId: q.id, level: q.level, type: type, category: q.category,
    q: q.q, correct_answer: q.answer || null, user_answer: text
  });
  currentQuestionIndex++;
  renderTestQuestion();
}

function recordSpeaking(qid) {
  const transcript = document.getElementById('voice-submit')?.dataset.transcript;
  if (!transcript) return;
  const q = localTestQuestions.find(it => it.id === qid);
  obData.testHistory.push({
    questionId: q.id, level: q.level, type: q.type, category: q.category,
    q: q.q, correct_answer: q.answer_pattern || null, user_answer: transcript
  });
  currentQuestionIndex++;
  renderTestQuestion();
}

function testBack() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    obData.testHistory.pop();
    renderTestQuestion();
  } else {
    obStep = OB_STEPS.indexOf('level');
    renderObStep();
  }
}

function skipTest() {
  currentQuestionIndex = localTestQuestions.length;
  obData.testHistory = [];
  renderTestQuestion();
}

function toggleSpeaking() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const st = document.getElementById('mic-status');
    if (st) st.innerHTML = errBox('Browser lacks Speech Recognition support.');
    return;
  }
  
  if (!speechRecognitionObj) {
    speechRecognitionObj = new SpeechRecognition();
    speechRecognitionObj.lang = 'de-DE';
    speechRecognitionObj.interimResults = false;
    speechRecognitionObj.maxAlternatives = 1;
    
    speechRecognitionObj.onstart = () => {
      const icon = document.getElementById('mic-icon');
      const txt = document.getElementById('mic-txt');
      const status = document.getElementById('mic-status');
      if (icon) icon.textContent = '⏹';
      if (txt) txt.textContent = 'Stop';
      if (status) status.textContent = 'Listening... Speak in German now.';
    };
    
    speechRecognitionObj.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const res = document.getElementById('stt-res');
      const submit = document.getElementById('voice-submit');
      const ans = document.getElementById('test-ans');
      if (res) { res.textContent = transcript; res.style.display = 'block'; }
      if (submit) { submit.dataset.transcript = transcript; submit.style.display = 'block'; }
      if (ans) ans.value = transcript;
    };
    
    speechRecognitionObj.onerror = (event) => {
      const status = document.getElementById('mic-status');
      if (status) status.innerHTML = errBox('Error: ' + event.error);
      stopSpeaking();
    };
    
    speechRecognitionObj.onend = () => stopSpeaking();
  }
  
  const icon = document.getElementById('mic-icon');
  if (icon && icon.textContent === '⏹') {
    speechRecognitionObj.stop();
  } else {
    speechRecognitionObj.start();
  }
}

function stopSpeaking() {
  const icon = document.getElementById('mic-icon');
  const txt = document.getElementById('mic-txt');
  const status = document.getElementById('mic-status');
  if (icon) icon.textContent = '🎤';
  if (txt) txt.textContent = 'Click to Speak Again';
  if (status) status.textContent = 'Processing...';
}

function renderCheerChoice(total, idx) {
  return `
    <div class="onboarding-card">
      ${renderDots(idx - 1, total)}
      <div class="ob-step-label">Step ${idx} of ${total}</div>
      <div class="ob-title">How should we cheer you on?</div>
      <div class="ob-sub">You can change this any time.</div>
      
      <div class="cheer-grid">
        ${CHEER_OPTIONS.map(opt => `
          <div class="cheer-card ${obData.cheerStyle===opt.id?'selected':''}" onclick="selectCheer('${opt.id}')">
            <div class="cheer-emoji">${opt.icon}</div>
            <div class="cheer-name">${esc(opt.title)}</div>
            <div class="cheer-quote">${esc(opt.quote)}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="ob-nav">
        <button class="btn btn-ghost" onclick="obPrev()">Back</button>
        <button class="btn btn-primary" onclick="finalizeOnboarding()" ${!obData.cheerStyle?'disabled':''}>Continue</button>
      </div>
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="onboarding-card text-center" style="padding:60px;">
      <div class="spinner-wrap" style="padding:0;margin-bottom:20px;">
        <div class="spinner"></div>
      </div>
      <div class="serif" style="font-size:1.4rem;margin-bottom:8px;">Analyzing your responses…</div>
      <p class="text-muted text-sm">We're determining your CEFR level and building your personalized plan.</p>
    </div>
  `;
}

function renderResult() {
  const profile = S.profile || {};
  return `
    <div class="onboarding-card text-center">
      <div class="serif" style="font-size:1.6rem;color:var(--violet);margin-bottom:8px;">Registration Complete</div>
      <p class="text-muted text-sm">Welcome aboard, ${esc(profile.name || obData.name)}!</p>
      
      <div style="margin:32px 0;">
        <div class="text-xs uppercase text-muted mb-8">Your deduced CEFR Level</div>
        <div class="serif" style="font-size:5rem;line-height:1;color:var(--violet);font-weight:900;">${profile.level || 'A2'}</div>
        <p class="explanation-box mt-20 italic text-sm" style="line-height:1.6;">
          ${esc(profile.level_analysis || 'Based on your placement test, this is the level we recommend starting with.')}
        </p>
      </div>
      
      <button class="btn btn-primary full-w" onclick="finishOnboarding()">Go to Dashboard →</button>
    </div>
  `;
}

// Navigation
function obNext() {
  if (obStep < OB_STEPS.length - 1) {
    obStep++;
    renderObStep();
  }
}

function obPrev() {
  if (obStep > 0) {
    obStep--;
    renderObStep();
  }
}

// Selection handlers
function selectGoal(id) {
  obData.goal = id;
  renderObStep();
}

function selectLevel(id) {
  obData.levelChoice = id;
  renderObStep();
}

function selectCheer(id) {
  obData.cheerStyle = id;
  renderObStep();
}

function saveInfo() {
  const name = document.getElementById('ob-name')?.value.trim();
  const email = document.getElementById('ob-email')?.value.trim();
  const time = parseInt(document.getElementById('ob-time')?.value) || 30;
  const key = document.getElementById('ob-key')?.value.trim();
  
  if (!name) { alert('Please enter your name.'); return; }
  
  obData.name = name;
  obData.email = email;
  obData.dailyTime = time;
  obData.apiKey = key;
  if (key) {
    S.apiKey = key;
    localStorage.setItem('fluency_api_key', key);
  }
  
  obNext();
}

async function finalizeOnboarding() {
  obStep = OB_STEPS.indexOf('loading');
  renderObStep();
  
  const keyToUse = obData.apiKey || S.apiKey;
  if (!keyToUse) {
    document.querySelector('.onboarding-wrap').innerHTML = `
      <div class="onboarding-card">${errBox('LLM Grading requires an API key. Please go back and enter your key.')}</div>
    `;
    return;
  }
  
  try {
    const finalProfile = await api('POST', '/placement/grade-and-finalize', {
      name: obData.name,
      time_minutes: obData.dailyTime,
      priorities: [obData.goal],
      apiKey: keyToUse,
      history: obData.testHistory
    });
    
    if (finalProfile.error) throw new Error(finalProfile.error);
    
    S.profile = finalProfile;
    S.apiKey = keyToUse;
    localStorage.setItem('fluency_api_key', keyToUse);
    
    obStep = OB_STEPS.indexOf('result');
    renderObStep();
  } catch(e) {
    document.querySelector('.onboarding-wrap').innerHTML = `
      <div class="onboarding-card">${errBox('Submission Failed: ' + e.message)}</div>
    `;
  }
}

function finishOnboarding() {
  document.querySelector('.sidebar').style.display = 'flex';
  const container = document.getElementById('main');
  container.style.marginLeft = 'var(--sidebar-w)';
  container.style.maxWidth = 'calc(100vw - var(--sidebar-w))';
  container.style.padding = '32px 40px 60px';
  updateSidebarProfile(S.profile);
  go('dashboard');
}