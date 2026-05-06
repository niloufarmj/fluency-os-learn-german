// Local variables for managing the linear test
let localTestQuestions = [];
let currentQuestionIndex = 0;
let userOnboardingData = null; // Store name, time, focus temporarily
let speechRecognitionObj = null;

async function startOnboarding() {
  document.querySelector('.sidebar').style.display = 'none'; 
  const container = document.getElementById('main');
  container.style.marginLeft = '0';
  container.style.maxWidth = '100vw';
  
  // Reset onboarding state
  S.onboardingSession.history = [];
  S.onboardingSession.active = true;

  container.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto; padding-top: 10vh;">
      <h2 class="module-title serif">Welcome to FluencyOS</h2>
      <p class="module-sub">Let's build your custom German curriculum.</p>
      
      <div class="card" id="setup-step-1">
        <div class="section-label">Your Details & Goals</div>
        <input type="text" id="ob-name" placeholder="What is your name?">
        
        <div class="mt-16 text-sm text-muted mb-8">How much time do you have daily?</div>
        <select id="ob-time">
          <option value="15">15 Minutes (Casual)</option>
          <option value="30" selected>30 Minutes (Standard)</option>
          <option value="60">60 Minutes (Intensive)</option>
        </select>
        
        <div class="mt-16 text-sm text-muted mb-8">What is your primary priority?</div>
        <select id="ob-focus">
          <option value="general">General Fluency & Grammar</option>
          <option value="speaking">Speaking & Conversation</option>
          <option value="business">Business German</option>
          <option value="travel">Travel & Survival</option>
        </select>
        
        <div class="mt-16 text-sm text-muted mb-8">Optional: Input Gemini API Key for Grading</div>
        <p class="text-muted text-xs mb-8 italic">(Grading Speaking/Writing relies on LLM analysis. Enter your key now, or save it later in settings.)</p>
        <input type="password" id="ob-key" value="${S.apiKey}" placeholder="AIzaSy...">
        
        <button class="btn btn-primary full-w mt-24" onclick="initiateStaticTest()">Start Static Placement Test →</button>
      </div>
      
      <div id="test-area" style="display:none;"></div>
    </div>
  `;
}

async function initiateStaticTest() {
  const nameInp = document.getElementById('ob-name').value;
  const timeInp = parseInt(document.getElementById('ob-time').value) || 30;
  const focusInp = document.getElementById('ob-focus').value || 'general';
  const keyInp = document.getElementById('ob-key').value.trim();

  if (!nameInp) { alert("Please enter your name."); return; }

  // Temporarily store data until the final grading
  userOnboardingData = {
    name: nameInp,
    time_minutes: timeInp,
    priorities: [focusInp]
  };
  S.onboardingSession.api = keyInp; // Stash key

  document.getElementById('setup-step-1').style.display = 'none';
  const testArea = document.getElementById('test-area');
  testArea.style.display = 'block';
  testArea.innerHTML = spin('Loading comprehensive skill test...');

  try {
    // Get the whole test at once (static JSON, no tokens)
    localTestQuestions = await api('GET', '/placement/get-test');
    currentQuestionIndex = 0;
    renderOnboardingQuestion();
  } catch (e) {
    testArea.innerHTML = errBox(e.message);
  }
}

function renderOnboardingQuestion() {
  if (currentQuestionIndex >= localTestQuestions.length) {
    showFinalGradingSubmit();
    return;
  }

  const q = localTestQuestions[currentQuestionIndex];
  const testArea = document.getElementById('test-area');
  
  // ── Fix: Use utility layout classes added to styles.css ──
  testArea.innerHTML = `
    <div class="card flex-col gap-8">
      <div class="flex between items-center mb-16">
        <!-- MODIFICATION: Level is now removed from UI -->
        <div class="text-xs uppercase text-amber">Onboarding Exam</div> 
        <div class="text-xs text-muted">${q.category} • ${currentQuestionIndex + 1}/${localTestQuestions.length}</div>
      </div>
      
      <div id="question-dynamic-content">
        ${getQuestionUI(q)}
      </div>
    </div>
  `;
}

// Generates the specific UI for standard, reading, listening, writing, or speaking
function getQuestionUI(q) {
  const serifQ = `<div class="serif mb-16" style="font-size: 1.3rem;">${esc(q.q)}</div>`;
  const optionsHtml = (opts, correctIdx) => `
    <div class="flex-col gap-8 mt-16">
      ${opts.map((opt, i) => `
        <button class="btn btn-ghost" onclick="recordStandardAnswer(${q.id}, ${i}, ${correctIdx}, ${q.id})">
          ${esc(opt)}
        </button>
      `).join('')}
    </div>
  `;

  // Standard Multiple Choice
  if (q.type === 'multiple_choice') {
    return serifQ + optionsHtml(q.options, q.correct);
  } 
  
  // IELTS-Style Listening (Hidden Text)
  else if (q.type === 'listening') {
    return `
      <div class="card text-center mb-16" style="background: var(--surface-2);">
        <div class="text-sm text-muted mb-8 italic">Listen to the audio and answer the question.</div>
        <button class="btn btn-primary" onclick="speakGerman('${esc(q.transcript)}')">🔊 Play Audio</button>
      </div>
      ` + serifQ + optionsHtml(q.options, q.correct);
  }

  // Reading Passage + MC Question
  else if (q.type === 'reading') {
    return `
      <div class="explanation-box italic mb-16" style="line-height: 1.6;">${esc(q.passage)}</div>
      ` + serifQ + optionsHtml(q.options, q.correct);
  }

  // Writing (Full Essay or Blank)
  else if (q.type.startsWith('writing')) {
    return serifQ + `
      <textarea id="writing-inp" class="mt-8 full-w" rows="5" placeholder="Schreib auf Deutsch…"></textarea>
      <button class="btn btn-primary full-w mt-20" onclick="recordWritingAnswer(${q.id})">Submit Writing Answer</button>
    `;
  }

  // Speaking (Speech-to-Text)
  else if (q.type.startsWith('speaking')) {
    return serifQ + `
      <div class="card text-center mb-16" id="mic-container" style="background: var(--surface-2);">
        <button class="btn btn-primary" id="mic-button" onclick="toggleSpeakingRecognition()">
          <span class="nav-icon" id="mic-icon">🎤</span> <span id="mic-text">Click to Speak</span>
        </button>
        <p id="mic-status" class="text-sm text-muted mt-8">Wait for prompt, then click to begin.</p>
      </div>
      <div id="stt-result" class="text-amber italic mb-16" style="display:none;"></div>
      <button class="btn btn-primary full-w" id="voice-submit-btn" style="display:none;" onclick="recordSpeakingAnswer(${q.id})">Submit Answer</button>
    `;
  }

  return errBox("Unknown question type: " + q.type);
}

// ── Handlers for recording answers without immediate adaptive grading ──

// MC & Listening
function recordStandardAnswer(questionId, selectedIndex, correctIndex, qid) {
  const q = localTestQuestions.find(it => it.id === qid);
  
  S.onboardingSession.history.push({
    questionId: q.id,
    level: q.level,
    type: q.type,
    category: q.category,
    q: q.q,
    passages: q.type === 'reading' ? q.passage : null,
    correct_answer: correctIndex, // The integer index
    user_answer: selectedIndex // The integer index
  });

  currentQuestionIndex++;
  renderOnboardingQuestion();
}

// Writing Full/Blank
function recordWritingAnswer(questionId) {
  const q = localTestQuestions.find(it => it.id === questionId);
  const text = document.getElementById('writing-inp').value.trim();
  
  if (!text) { alert("Please write your answer."); return; }

  S.onboardingSession.history.push({
    questionId: q.id,
    level: q.level,
    type: q.type,
    category: q.category,
    q: q.q,
    correct_answer: q.answer || null, // Fill-in-the-blank has an answer, essays do not
    user_answer: text // The string written by the user
  });

  currentQuestionIndex++;
  renderOnboardingQuestion();
}

// Speaking Handlers using SpeechRecognition
function toggleSpeakingRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    document.getElementById('mic-status').innerHTML = errBox("Browser lacks Speech Recognition support (Use Chrome/Safari).");
    return;
  }

  if (!speechRecognitionObj) {
    speechRecognitionObj = new SpeechRecognition();
    speechRecognitionObj.lang = 'de-DE'; // Force German recognition
    speechRecognitionObj.interimResults = false;
    speechRecognitionObj.maxAlternatives = 1;

    speechRecognitionObj.onstart = () => {
      document.getElementById('mic-icon').classList.add('mic-icon-active');
      document.getElementById('mic-text').textContent = "Stop Speaking";
      document.getElementById('mic-status').textContent = "Listening... Speak in German now.";
    };

    speechRecognitionObj.onspeechend = () => {
      speechRecognitionObj.stop();
    };

    speechRecognitionObj.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const resultArea = document.getElementById('stt-result');
      resultArea.textContent = transcript;
      resultArea.style.display = 'block';
      
      // Store transcript temporarily in the button's data attribute
      document.getElementById('voice-submit-btn').dataset.transcript = transcript;
      document.getElementById('voice-submit-btn').style.display = 'block';
    };

    speechRecognitionObj.onerror = (event) => {
      document.getElementById('mic-status').innerHTML = errBox("Speech Recognition Error: " + event.error);
      stopSpeakingRecognition();
    };

    speechRecognitionObj.onend = () => {
      stopSpeakingRecognition();
    };
  }

  // Active state handling
  if (document.getElementById('mic-icon').classList.contains('mic-icon-active')) {
    speechRecognitionObj.stop();
  } else {
    speechRecognitionObj.start();
  }
}

function stopSpeakingRecognition() {
  const icon = document.getElementById('mic-icon');
  if (!icon) return; // UI moved
  icon.classList.remove('mic-icon-active');
  document.getElementById('mic-text').textContent = "Click to Speak Again";
  document.getElementById('mic-status').textContent = "Processing transcript...";
}

// Speaking Full/Blank
function recordSpeakingAnswer(questionId) {
  const q = localTestQuestions.find(it => it.id === questionId);
  const transcript = document.getElementById('voice-submit-btn').dataset.transcript;
  
  if (!transcript) { alert("Capture your speech first."); return; }

  S.onboardingSession.history.push({
    questionId: q.id,
    level: q.level,
    type: q.type,
    category: q.category,
    q: q.q,
    correct_answer: q.answer_pattern || null,
    user_answer: transcript // The transcribed string
  });

  currentQuestionIndex++;
  renderOnboardingQuestion();
}

// ── Finalization Screen ──

function showFinalGradingSubmit() {
  S.onboardingSession.active = false; // Test complete
  const testArea = document.getElementById('test-area');
  
  testArea.innerHTML = `
    <div class="card text-center flex-col items-center gap-12" style="padding: 50px;">
      <div class="serif" style="font-size: 1.6rem; color: var(--amber);">Test Complete</div>
      <p class="text-sm text-muted">You have completed all {localTestQuestions.length} skills assessments.</p>
      <p class="text-xs text-muted italic mt-12">Click below to submit your full results package (including your written essays and spoken transcripts) to the AI for advanced CEFR grading.</p>
      <button class="btn btn-primary full-w mt-24" id="final-submit-btn" onclick="gradeAndFinalizeAppSequence()">
        Submit for AI Grading & Deduce Level →
      </button>
    </div>
  `;
}

async function gradeAndFinalizeAppSequence() {
  const submitBtn = document.getElementById('final-submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = spin('Sending results to LLM for final level analysis…');

  // Grad the key, prioritising the onboarding input over global S
  const keyToUse = S.onboardingSession.api || S.apiKey;
  if (!keyToUse) {
    testArea.innerHTML = errBox("LLM Grading requires an API key. You didn't input one in Step 1. Please refresh, start over, and input the key.");
    return;
  }

  try {
    const finalProfile = await api('POST', '/placement/grade-and-finalize', {
      name: userOnboardingData.name,
      time_minutes: userOnboardingData.time_minutes,
      priorities: userOnboardingData.priorities,
      apiKey: keyToUse, // Send the key to backend
      history: S.onboardingSession.history // The gathered package
    });
    
    if (finalProfile.error) throw new Error(finalProfile.error);

    // Update state and UI, and restore sidebar
    S.profile = finalProfile;
    S.onboardingSession.history = []; // Clear local temp storage
    S.apiKey = keyToUse; // Permanently store key used for grading
    localStorage.setItem('fluency_api_key', keyToUse);
    
    // Restore layout
    document.querySelector('.sidebar').style.display = 'flex';
    const container = document.getElementById('main');
    container.style.marginLeft = 'var(--sidebar-w)';
    updateSidebarProfile(finalProfile);
    
    // go('dashboard'); 
    showFinalResultScreen(); // Show deduced level before going to dashboard
  } catch (e) {
    submitBtn.innerHTML = errBox("Submission Failed: " + e.message);
    submitBtn.disabled = false;
  }
}

// Show the final deduced level with LLM reasoning before moving to dashboard
function showFinalResultScreen() {
  const container = document.getElementById('main');
  container.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto; padding-top: 10vh; animation: fadeIn 0.3s ease;">
      <h2 class="module-title serif">Registration Complete</h2>
      <p class="module-sub">Welcome aboard, ${esc(S.profile.name)}!</p>
      
      <div class="card text-center" style="padding: 50px;">
        <div class="text-xs uppercase text-muted mb-8">Your deduced CEFR Level</div>
        <div class="serif" style="font-size: 5rem; line-height: 1; color: var(--amber); font-weight: 900;">${S.profile.level}</div>
        <p class="explanation-box mt-20 italic text-sm" style="line-height: 1.6;">AI Analysis: ${esc(S.profile.level_analysis)}</p>
        <button class="btn btn-primary full-w mt-24" onclick="go('dashboard')">Go to Dashboard →</button>
      </div>
    </div>
  `;
}